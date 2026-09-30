package docker

import (
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"

	"gettako.dev/tako/internal/protocol"
	"gettako.dev/tako/internal/storage"
)

// BackupManager handles executing database dumps and volume backups inside Docker containers
// and streaming the resulting compressed archives directly to S3.
type BackupManager struct {
	cli DockerExecClient
}

func NewBackupManager(cli DockerExecClient) *BackupManager {
	return &BackupManager{cli: cli}
}

// FindActiveContainer locates the running container for the given service.
func (bm *BackupManager) FindActiveContainer(ctx context.Context, serviceID string) (string, error) {
	containers, err := bm.cli.ContainerList(ctx, container.ListOptions{All: true})
	if err != nil {
		return "", fmt.Errorf("failed to list containers: %w", err)
	}

	for _, c := range containers {
		if (c.Labels["tako.service_id"] == serviceID ||
			(len(c.Names) > 0 && strings.HasPrefix(strings.TrimPrefix(c.Names[0], "/"), "tako-"+serviceID))) &&
			c.State == "running" {
			return c.ID, nil
		}
	}

	// Fallback to any container for this service if not currently running
	for _, c := range containers {
		if c.Labels["tako.service_id"] == serviceID ||
			(len(c.Names) > 0 && strings.HasPrefix(strings.TrimPrefix(c.Names[0], "/"), "tako-"+serviceID)) {
			return c.ID, nil
		}
	}

	return "", fmt.Errorf("no container found for service %s", serviceID)
}

// ExecuteBackup runs the dump command inside the container, gzips the output, and uploads it to S3.
func (bm *BackupManager) ExecuteBackup(ctx context.Context, cmd *protocol.BackupCommand) (int64, error) {
	if cmd.GetS3Config() == nil || cmd.GetS3Config().GetBucket() == "" {
		return 0, fmt.Errorf("missing S3 configuration in backup command")
	}

	containerID, err := bm.FindActiveContainer(ctx, cmd.GetServiceId())
	if err != nil {
		return 0, err
	}

	var dumpCmd []string
	var dumpEnv []string
	isAlreadyGzipped := false

	switch cmd.GetBackupType() {
	case "volume":
		mountPath := cmd.GetVolumeMountPath()
		if mountPath == "" {
			mountPath = "/data"
		}
		dumpCmd = []string{"tar", "-czf", "-", "-C", mountPath, "."}
		isAlreadyGzipped = true

	case "database":
		engine := strings.ToLower(cmd.GetDatabaseEngine())
		user := cmd.GetDatabaseUser()
		pass := cmd.GetDatabasePassword()
		dbName := cmd.GetDatabaseName()

		switch engine {
		case "postgres", "postgresql":
			if user == "" {
				user = "postgres"
			}
			if dbName == "" {
				dbName = "app"
			}
			dumpCmd = []string{"pg_dump", "-U", user, "-d", dbName, "-Fc"}
			if pass != "" {
				dumpEnv = append(dumpEnv, "PGPASSWORD="+pass)
			}
			// pg_dump -Fc produces an internally compressed custom archive
			isAlreadyGzipped = true

		case "mysql", "mariadb":
			if user == "" {
				user = "root"
			}
			if dbName == "" {
				dbName = "app"
			}
			args := []string{"mysqldump", "-u", user}
			if pass != "" {
				args = append(args, "-p"+pass)
			}
			args = append(args, dbName)
			dumpCmd = args

		case "redis":
			args := []string{"redis-cli"}
			if pass != "" {
				args = append(args, "-a", pass)
			}
			args = append(args, "--rdb", "-")
			dumpCmd = args

		default:
			return 0, fmt.Errorf("unsupported database engine for backup: %s", engine)
		}

	default:
		return 0, fmt.Errorf("unsupported backup type: %s", cmd.GetBackupType())
	}

	slog.Info("executing backup inside container",
		slog.String("service_id", cmd.GetServiceId()),
		slog.String("container_id", containerID[:12]),
		slog.String("command", strings.Join(dumpCmd, " ")),
	)

	execResp, err := bm.cli.ContainerExecCreate(ctx, containerID, container.ExecOptions{
		Cmd:          dumpCmd,
		Env:          dumpEnv,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          false,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to create exec for backup: %w", err)
	}

	attachResp, err := bm.cli.ContainerExecAttach(ctx, execResp.ID, container.ExecAttachOptions{})
	if err != nil {
		return 0, fmt.Errorf("failed to attach to backup exec: %w", err)
	}
	defer attachResp.Close()

	// Stage output to temporary file to know exact size and buffer cleanly
	tmpFile, err := os.CreateTemp("", "tako-agent-backup-*")
	if err != nil {
		return 0, fmt.Errorf("failed to create temp file for backup: %w", err)
	}
	defer func() {
		tmpFile.Close()
		_ = os.Remove(tmpFile.Name())
	}()

	var copyErr error
	if isAlreadyGzipped {
		_, copyErr = io.Copy(tmpFile, attachResp.Reader)
	} else {
		gz := gzip.NewWriter(tmpFile)
		_, copyErr = io.Copy(gz, attachResp.Reader)
		if closeErr := gz.Close(); closeErr != nil && copyErr == nil {
			copyErr = closeErr
		}
	}
	if copyErr != nil {
		return 0, fmt.Errorf("failed to write backup data: %w", copyErr)
	}

	stat, err := tmpFile.Stat()
	if err != nil {
		return 0, fmt.Errorf("failed to stat temp backup file: %w", err)
	}
	sizeBytes := stat.Size()
	if sizeBytes <= 0 {
		return 0, fmt.Errorf("backup produced empty output (0 bytes)")
	}

	// Seek to beginning for reading
	if _, err := tmpFile.Seek(0, io.SeekStart); err != nil {
		return 0, fmt.Errorf("failed to rewind temp backup file: %w", err)
	}

	// Upload to S3
	s3Cfg := storage.S3Config{
		EndpointURL: cmd.GetS3Config().GetEndpointUrl(),
		Bucket:      cmd.GetS3Config().GetBucket(),
		Region:      cmd.GetS3Config().GetRegion(),
		AccessKey:   cmd.GetS3Config().GetAccessKey(),
		SecretKey:   cmd.GetS3Config().GetSecretKey(),
	}

	s3Client, err := storage.NewS3Client(ctx, s3Cfg)
	if err != nil {
		return 0, fmt.Errorf("failed to initialize S3 client: %w", err)
	}

	slog.Info("uploading backup to S3",
		slog.String("bucket", s3Cfg.Bucket),
		slog.String("key", cmd.GetS3Key()),
		slog.Int64("bytes", sizeBytes),
	)

	if err := s3Client.Upload(ctx, cmd.GetS3Key(), tmpFile, sizeBytes, "application/gzip"); err != nil {
		return 0, fmt.Errorf("failed to upload backup to S3: %w", err)
	}

	return sizeBytes, nil
}

// ExecuteRestore downloads the backup from S3 and feeds it into the restore tool inside the container.
func (bm *BackupManager) ExecuteRestore(ctx context.Context, cmd *protocol.RestoreCommand) error {
	if cmd.GetS3Config() == nil || cmd.GetS3Config().GetBucket() == "" {
		return fmt.Errorf("missing S3 configuration in restore command")
	}

	containerID, err := bm.FindActiveContainer(ctx, cmd.GetServiceId())
	if err != nil {
		return err
	}

	var restoreCmd []string
	var restoreEnv []string
	isGzipped := strings.HasSuffix(cmd.GetS3Key(), ".gz")

	switch cmd.GetBackupType() {
	case "volume":
		mountPath := cmd.GetVolumeMountPath()
		if mountPath == "" {
			mountPath = "/data"
		}
		restoreCmd = []string{"tar", "-xzf", "-", "-C", mountPath}
		isGzipped = false // tar -xzf handles decompressing itself

	case "database":
		engine := strings.ToLower(cmd.GetDatabaseEngine())
		user := cmd.GetDatabaseUser()
		pass := cmd.GetDatabasePassword()
		dbName := cmd.GetDatabaseName()

		switch engine {
		case "postgres", "postgresql":
			if user == "" {
				user = "postgres"
			}
			if dbName == "" {
				dbName = "app"
			}
			restoreCmd = []string{"pg_restore", "-U", user, "-d", dbName, "--clean", "--if-exists"}
			if pass != "" {
				restoreEnv = append(restoreEnv, "PGPASSWORD="+pass)
			}
			isGzipped = false

		case "mysql", "mariadb":
			if user == "" {
				user = "root"
			}
			if dbName == "" {
				dbName = "app"
			}
			args := []string{"mysql", "-u", user}
			if pass != "" {
				args = append(args, "-p"+pass)
			}
			args = append(args, dbName)
			restoreCmd = args

		default:
			return fmt.Errorf("unsupported database engine for restore: %s", engine)
		}

	default:
		return fmt.Errorf("unsupported restore type: %s", cmd.GetBackupType())
	}

	s3Cfg := storage.S3Config{
		EndpointURL: cmd.GetS3Config().GetEndpointUrl(),
		Bucket:      cmd.GetS3Config().GetBucket(),
		Region:      cmd.GetS3Config().GetRegion(),
		AccessKey:   cmd.GetS3Config().GetAccessKey(),
		SecretKey:   cmd.GetS3Config().GetSecretKey(),
	}

	s3Client, err := storage.NewS3Client(ctx, s3Cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize S3 client: %w", err)
	}

	slog.Info("downloading backup from S3 for restore",
		slog.String("bucket", s3Cfg.Bucket),
		slog.String("key", cmd.GetS3Key()),
	)

	s3Body, err := s3Client.Download(ctx, cmd.GetS3Key())
	if err != nil {
		return fmt.Errorf("failed to download backup from S3: %w", err)
	}
	defer s3Body.Close()

	var inputReader io.Reader = s3Body
	if isGzipped {
		gz, err := gzip.NewReader(s3Body)
		if err != nil {
			return fmt.Errorf("failed to open gzip reader: %w", err)
		}
		defer gz.Close()
		inputReader = gz
	}

	execResp, err := bm.cli.ContainerExecCreate(ctx, containerID, container.ExecOptions{
		Cmd:          restoreCmd,
		Env:          restoreEnv,
		AttachStdin:  true,
		AttachStdout: true,
		AttachStderr: true,
		Tty:          false,
	})
	if err != nil {
		return fmt.Errorf("failed to create exec for restore: %w", err)
	}

	attachResp, err := bm.cli.ContainerExecAttach(ctx, execResp.ID, container.ExecAttachOptions{})
	if err != nil {
		return fmt.Errorf("failed to attach to restore exec: %w", err)
	}
	defer attachResp.Close()

	var errBuf bytes.Buffer
	go func() {
		_, _ = io.Copy(&errBuf, attachResp.Reader)
	}()

	if _, err := io.Copy(attachResp.Conn, inputReader); err != nil {
		return fmt.Errorf("failed to pipe backup stream to container: %w", err)
	}
	_ = attachResp.CloseWrite()

	// Wait briefly for command completion
	for i := 0; i < 60; i++ {
		inspect, err := bm.cli.ContainerExecInspect(ctx, execResp.ID)
		if err == nil && !inspect.Running {
			if inspect.ExitCode != 0 {
				return fmt.Errorf("restore command exited with code %d: %s", inspect.ExitCode, errBuf.String())
			}
			return nil
		}
		time.Sleep(500 * time.Millisecond)
	}

	return nil
}
