package docker

import (
	"archive/tar"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types"

	"gettako.dev/tako/internal/protocol"
)

type GitMetadata struct {
	CommitSHA     string
	CommitAuthor  string
	CommitMessage string
	Branch        string
}

type BuildResult struct {
	ImageTag      string
	CommitSHA     string
	CommitAuthor  string
	CommitMessage string
}

type LogSender interface {
	SendBuildLog(chunk *protocol.BuildLogChunk) error
	SendStatusTransition(transition *protocol.DeploymentStatusTransition) error
	SendContainerLog(chunk *protocol.ContainerLogChunk) error
}

type DockerImageBuilder interface {
	ImageBuild(ctx context.Context, buildContext io.Reader, options types.ImageBuildOptions) (types.ImageBuildResponse, error)
}

type Builder struct {
	dockerCli DockerImageBuilder
	buildsDir string
}

func NewBuilder(dockerCli DockerImageBuilder, buildsDir string) *Builder {
	if buildsDir == "" {
		buildsDir = filepath.Join(os.TempDir(), "tako-builds")
	}
	return &Builder{
		dockerCli: dockerCli,
		buildsDir: buildsDir,
	}
}

// NormalizeGitCloneURL converts shorthand repository references (e.g. "owner/repo" or "github.com/owner/repo")
// into complete, valid git clone URLs (e.g. "https://github.com/owner/repo.git").
// Full URLs (https://, git@, ssh://) and local filesystem paths are preserved as-is.
func NormalizeGitCloneURL(repo string) string {
	repo = strings.TrimSpace(repo)
	if repo == "" {
		return ""
	}
	if strings.HasPrefix(repo, "git@") || strings.HasPrefix(repo, "ssh://") ||
		strings.HasPrefix(repo, "http://") || strings.HasPrefix(repo, "https://") ||
		strings.HasPrefix(repo, "file://") || strings.HasPrefix(repo, "/") ||
		strings.HasPrefix(repo, "./") || strings.HasPrefix(repo, "../") {
		return repo
	}
	if strings.HasPrefix(repo, "github.com/") {
		if !strings.HasSuffix(repo, ".git") {
			return "https://" + repo + ".git"
		}
		return "https://" + repo
	}
	parts := strings.Split(repo, "/")
	if len(parts) == 2 && !strings.Contains(parts[0], ".") && !strings.Contains(parts[0], ":") {
		if !strings.HasSuffix(repo, ".git") {
			return "https://github.com/" + repo + ".git"
		}
		return "https://github.com/" + repo
	}
	return repo
}

func (b *Builder) CloneRepository(ctx context.Context, repo, branch, commitSHA, targetDir string, auth ...string) (*GitMetadata, error) {
	if err := os.MkdirAll(filepath.Dir(targetDir), 0755); err != nil {
		return nil, fmt.Errorf("failed to create parent build directory: %w", err)
	}

	var sshKey, gitToken string
	if len(auth) > 0 {
		sshKey = strings.TrimSpace(auth[0])
	}
	if len(auth) > 1 {
		gitToken = strings.TrimSpace(auth[1])
	}

	gitEnv := append(os.Environ(), "GIT_TERMINAL_PROMPT=0")

	if sshKey != "" {
		keyDir := filepath.Join(os.TempDir(), "tako-builds", filepath.Base(targetDir))
		if err := os.MkdirAll(keyDir, 0700); err != nil {
			return nil, fmt.Errorf("failed to create ssh key directory: %w", err)
		}
		keyPath := filepath.Join(keyDir, "id_ed25519")
		if err := os.WriteFile(keyPath, []byte(sshKey), 0600); err != nil {
			return nil, fmt.Errorf("failed to write ssh private key: %w", err)
		}
		defer func() {
			// Securely zero out key file before unlinking
			if info, err := os.Stat(keyPath); err == nil {
				zeroes := make([]byte, info.Size())
				_ = os.WriteFile(keyPath, zeroes, 0600)
			}
			_ = os.Remove(keyPath)
		}()

		sshCmd := fmt.Sprintf("ssh -i %s -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new", keyPath)
		gitEnv = append(gitEnv, "GIT_SSH_COMMAND="+sshCmd)
	}

	cloneURL := NormalizeGitCloneURL(repo)

	var cloneArgs []string
	if gitToken != "" {
		basicAuth := base64.StdEncoding.EncodeToString([]byte("x-access-token:" + gitToken))
		authHeader := "AUTHORIZATION: basic " + basicAuth
		gitEnv = append(gitEnv,
			"GIT_CONFIG_COUNT=1",
			"GIT_CONFIG_KEY_0=http.extraheader",
			"GIT_CONFIG_VALUE_0="+authHeader,
		)
		cloneArgs = append(cloneArgs, "-c", "http.extraheader="+authHeader)
	}

	cloneArgs = append(cloneArgs, "clone", "--depth", "1")
	if branch != "" {
		cloneArgs = append(cloneArgs, "--branch", branch)
	}
	cloneArgs = append(cloneArgs, cloneURL, targetDir)

	cmd := exec.CommandContext(ctx, "git", cloneArgs...)
	cmd.Env = gitEnv
	if out, err := cmd.CombinedOutput(); err != nil {
		outStr := string(out)
		if gitToken != "" {
			outStr = strings.ReplaceAll(outStr, gitToken, "[REDACTED]")
		}
		return nil, fmt.Errorf("git clone failed: %s (%w)", outStr, err)
	}

	if commitSHA != "" {
		// If a specific commit was requested, attempt to checkout
		checkoutCmd := exec.CommandContext(ctx, "git", "-C", targetDir, "checkout", commitSHA)
		checkoutCmd.Env = gitEnv
		if _, err := checkoutCmd.CombinedOutput(); err != nil {
			// If shallow clone didn't include it, fetch it
			var fetchArgs []string
			fetchArgs = append(fetchArgs, "-C", targetDir)
			if gitToken != "" {
				basicAuth := base64.StdEncoding.EncodeToString([]byte("x-access-token:" + gitToken))
				fetchArgs = append(fetchArgs, "-c", "http.extraheader=AUTHORIZATION: basic "+basicAuth)
			}
			fetchArgs = append(fetchArgs, "fetch", "--depth", "1", "origin", commitSHA)
			fetchCmd := exec.CommandContext(ctx, "git", fetchArgs...)
			fetchCmd.Env = gitEnv
			if fOut, fErr := fetchCmd.CombinedOutput(); fErr != nil {
				fOutStr := string(fOut)
				if gitToken != "" {
					fOutStr = strings.ReplaceAll(fOutStr, gitToken, "[REDACTED]")
				}
				slog.Warn("git fetch commit failed", slog.String("commit", commitSHA), slog.String("error", fOutStr))
			} else {
				_ = exec.CommandContext(ctx, "git", "-C", targetDir, "checkout", commitSHA).Run()
			}
		}
	}

	// Read commit metadata: SHA, Author, Message
	logCmd := exec.CommandContext(ctx, "git", "-C", targetDir, "log", "-1", "--format=%H%x1f%an%x1f%s")
	logCmd.Env = gitEnv
	out, err := logCmd.Output()
	if err != nil {
		return &GitMetadata{Branch: branch, CommitSHA: commitSHA}, nil
	}

	parts := strings.Split(strings.TrimSpace(string(out)), "\x1f")
	meta := &GitMetadata{Branch: branch}
	if len(parts) >= 1 && parts[0] != "" {
		meta.CommitSHA = parts[0]
	}
	if len(parts) >= 2 {
		meta.CommitAuthor = parts[1]
	}
	if len(parts) >= 3 {
		meta.CommitMessage = parts[2]
	}

	return meta, nil
}

func CreateTarStream(srcDir string) (io.ReadCloser, <-chan error) {
	pr, pw := io.Pipe()
	errCh := make(chan error, 1)

	go func() {
		tw := tar.NewWriter(pw)
		err := filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			relPath, err := filepath.Rel(srcDir, path)
			if err != nil {
				return err
			}
			if relPath == "." {
				return nil
			}

			header, err := tar.FileInfoHeader(info, info.Name())
			if err != nil {
				return err
			}
			header.Name = filepath.ToSlash(relPath)

			if info.Mode()&os.ModeSymlink != 0 {
				linkTarget, err := os.Readlink(path)
				if err == nil {
					header.Linkname = linkTarget
				}
			}

			if err := tw.WriteHeader(header); err != nil {
				return err
			}

			if info.Mode().IsRegular() {
				f, err := os.Open(path)
				if err != nil {
					return err
				}
				defer f.Close()

				if _, err := io.Copy(tw, f); err != nil {
					return err
				}
			}
			return nil
		})

		if err != nil {
			_ = tw.Close()
			_ = pw.CloseWithError(err)
			errCh <- err
			return
		}

		if err := tw.Close(); err != nil {
			_ = pw.CloseWithError(err)
			errCh <- err
			return
		}

		_ = pw.Close()
		errCh <- nil
	}()

	return pr, errCh
}

type dockerProgressMessage struct {
	Stream      string `json:"stream"`
	Status      string `json:"status"`
	Progress    string `json:"progress"`
	Error       string `json:"error"`
	ErrorDetail struct {
		Message string `json:"message"`
	} `json:"errorDetail"`
}

func ParseDockerBuildOutput(r io.Reader, depID string, sender LogSender) error {
	decoder := json.NewDecoder(r)
	for decoder.More() {
		var msg dockerProgressMessage
		if err := decoder.Decode(&msg); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return err
		}

		if msg.Error != "" {
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      msg.Error,
				IsError:      true,
				Timestamp:    time.Now().UnixNano(),
			})
			return errors.New(msg.Error)
		}

		rawLine := msg.Stream
		if rawLine == "" {
			rawLine = msg.Status
			if msg.Progress != "" {
				rawLine += " " + msg.Progress
			}
		}

		lines := strings.Split(rawLine, "\n")
		for _, line := range lines {
			line = strings.TrimRight(line, "\r")
			if line == "" {
				continue
			}

			var stepStr string
			if strings.HasPrefix(line, "Step ") {
				// e.g. "Step 1/5 : FROM node:20"
				parts := strings.SplitN(line, ":", 2)
				if len(parts) > 0 {
					stepParts := strings.Fields(parts[0])
					if len(stepParts) >= 2 {
						stepStr = stepParts[1]
					}
				}
			}

			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				Step:         stepStr,
				LogLine:      line,
				IsError:      false,
				Timestamp:    time.Now().UnixNano(),
			})
		}
	}
	return nil
}

func (b *Builder) Build(ctx context.Context, job *protocol.DeployJob, sender LogSender) (*BuildResult, error) {
	depID := job.GetDeploymentId()
	serviceID := job.GetServiceId()
	imageTag := fmt.Sprintf("tako-app-%s:%s", serviceID, depID)
	targetDir := filepath.Join(b.buildsDir, depID)

	defer func() {
		_ = os.RemoveAll(targetDir)
	}()

	_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
		DeploymentId: depID,
		Status:       "building",
		Timestamp:    time.Now().Unix(),
	})

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      fmt.Sprintf("Cloning repository %s (%s)...", job.GetRepository(), job.GetBranch()),
		Timestamp:    time.Now().UnixNano(),
	})

	meta, err := b.CloneRepository(ctx, job.GetRepository(), job.GetBranch(), job.GetCommitSha(), targetDir, job.GetSshPrivateKey(), job.GetGitToken())
	if err != nil {
		errReason := fmt.Sprintf("Failed to clone repository: %v", err)
		if job.GetGitToken() != "" {
			errReason = strings.ReplaceAll(errReason, job.GetGitToken(), "[REDACTED]")
		}
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      errReason,
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "failed",
			ErrorReason:  errReason,
			Timestamp:    time.Now().Unix(),
		})
		return nil, errors.New(errReason)
	}

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      fmt.Sprintf("Repository checked out. Commit: %s (by %s) - %s", meta.CommitSHA, meta.CommitAuthor, meta.CommitMessage),
		Timestamp:    time.Now().UnixNano(),
	})

	dockerfilePath := job.GetDockerfilePath()
	if dockerfilePath == "" {
		dockerfilePath = "Dockerfile"
	}

	fullDockerfilePath := filepath.Join(targetDir, dockerfilePath)
	if _, err := os.Stat(fullDockerfilePath); os.IsNotExist(err) {
		errReason := fmt.Sprintf("Dockerfile not found at specified path: %s", dockerfilePath)
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      errReason,
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "failed",
			ErrorReason:  errReason,
			Timestamp:    time.Now().Unix(),
		})
		return nil, errors.New(errReason)
	}

	buildArgs := make(map[string]*string)
	for k, v := range job.GetBuildArgs() {
		val := v
		buildArgs[k] = &val
	}

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      fmt.Sprintf("Starting Docker build for image %s...", imageTag),
		Timestamp:    time.Now().UnixNano(),
	})

	tarStream, tarErrCh := CreateTarStream(targetDir)

	resp, err := b.dockerCli.ImageBuild(ctx, tarStream, types.ImageBuildOptions{
		Tags:        []string{imageTag},
		Dockerfile:  dockerfilePath,
		BuildArgs:   buildArgs,
		Remove:      true,
		ForceRemove: true,
	})
	if err != nil {
		_ = tarStream.Close()
		errReason := fmt.Sprintf("Docker ImageBuild invocation error: %v", err)
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      errReason,
			IsError:      true,
			Timestamp:    time.Now().UnixNano(),
		})
		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "failed",
			ErrorReason:  errReason,
			Timestamp:    time.Now().Unix(),
		})
		return nil, errors.New(errReason)
	}
	defer resp.Body.Close()

	if err := ParseDockerBuildOutput(resp.Body, depID, sender); err != nil {
		_ = sender.SendStatusTransition(&protocol.DeploymentStatusTransition{
			DeploymentId: depID,
			Status:       "failed",
			ErrorReason:  err.Error(),
			Timestamp:    time.Now().Unix(),
		})
		return nil, fmt.Errorf("Docker build failed: %w", err)
	}

	if tarErr := <-tarErrCh; tarErr != nil {
		slog.Warn("tar stream encountered error", slog.String("error", tarErr.Error()))
	}

	_ = sender.SendBuildLog(&protocol.BuildLogChunk{
		DeploymentId: depID,
		LogLine:      fmt.Sprintf("Successfully built Docker image: %s", imageTag),
		Timestamp:    time.Now().UnixNano(),
	})

	return &BuildResult{
		ImageTag:      imageTag,
		CommitSHA:     meta.CommitSHA,
		CommitAuthor:  meta.CommitAuthor,
		CommitMessage: meta.CommitMessage,
	}, nil
}

func (b *Builder) BuildDirectory(ctx context.Context, job *protocol.DeployJob, dir, dockerfilePath, imageTag string, sender LogSender) (*BuildResult, error) {
	depID := job.GetDeploymentId()
	if dockerfilePath == "" {
		dockerfilePath = "Dockerfile"
	}

	fullDockerfilePath := filepath.Join(dir, dockerfilePath)
	if _, err := os.Stat(fullDockerfilePath); os.IsNotExist(err) {
		errReason := fmt.Sprintf("Dockerfile not found at specified path: %s", fullDockerfilePath)
		if sender != nil {
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      errReason,
				IsError:      true,
				Timestamp:    time.Now().UnixNano(),
			})
		}
		return nil, errors.New(errReason)
	}

	buildArgs := make(map[string]*string)
	for k, v := range job.GetBuildArgs() {
		val := v
		buildArgs[k] = &val
	}

	if sender != nil {
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Starting Docker build for image %s...", imageTag),
			Timestamp:    time.Now().UnixNano(),
		})
	}

	tarStream, tarErrCh := CreateTarStream(dir)

	resp, err := b.dockerCli.ImageBuild(ctx, tarStream, types.ImageBuildOptions{
		Tags:        []string{imageTag},
		Dockerfile:  dockerfilePath,
		BuildArgs:   buildArgs,
		Remove:      true,
		ForceRemove: true,
	})
	if err != nil {
		_ = tarStream.Close()
		errReason := fmt.Sprintf("Docker ImageBuild invocation error: %v", err)
		if sender != nil {
			_ = sender.SendBuildLog(&protocol.BuildLogChunk{
				DeploymentId: depID,
				LogLine:      errReason,
				IsError:      true,
				Timestamp:    time.Now().UnixNano(),
			})
		}
		return nil, errors.New(errReason)
	}
	defer resp.Body.Close()

	if err := ParseDockerBuildOutput(resp.Body, depID, sender); err != nil {
		return nil, fmt.Errorf("Docker build failed: %w", err)
	}

	if tarErr := <-tarErrCh; tarErr != nil {
		slog.Warn("tar stream encountered error", slog.String("error", tarErr.Error()))
	}

	if sender != nil {
		_ = sender.SendBuildLog(&protocol.BuildLogChunk{
			DeploymentId: depID,
			LogLine:      fmt.Sprintf("Successfully built Docker image: %s", imageTag),
			Timestamp:    time.Now().UnixNano(),
		})
	}

	return &BuildResult{
		ImageTag: imageTag,
	}, nil
}
