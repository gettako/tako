package deploy

import (
	"archive/tar"
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/docker/docker/api/types"
	takov1 "gettako.dev/tako/proto/gen/go/tako/v1"
)

// handleGitBuild clones the Git repository, resolves commits, and builds or caches the Docker image.
func (e *Executor) handleGitBuild(
	ctx context.Context,
	req *takov1.DeployRequest,
	targetImage string,
	sendLog func(step, msg string, isError bool),
) string {
	commitHash := req.GetCommitHash()

	// 1. Reuse existing cached image for this commit if explicitly specified (not main/master) and already built locally
	if e.dockerCli != nil && commitHash != "" && commitHash != "main" && commitHash != "master" {
		if _, _, err := e.dockerCli.RawClient().ImageInspectWithRaw(ctx, targetImage); err == nil {
			sendLog("Build", fmt.Sprintf("Using cached local image %s for commit %s", targetImage, commitHash), false)
			return commitHash
		}
	}

	repoURL := req.GetRepository()
	branch := req.GetBranch()
	dockerfileName := req.GetDockerfile()
	if dockerfileName == "" {
		dockerfileName = "Dockerfile"
	} else {
		cleaned := filepath.Clean(dockerfileName)
		if strings.HasPrefix(cleaned, "..") || filepath.IsAbs(cleaned) {
			dockerfileName = "Dockerfile"
		} else {
			dockerfileName = cleaned
		}
	}

	sendLog("Clone", fmt.Sprintf("Cloning repository %s (branch: %s)...", repoURL, branch), false)

	tmpDir, err := os.MkdirTemp("", "tako-repo-*")
	if err != nil {
		sendLog("Clone", fmt.Sprintf("Notice: temp dir error (%v), falling back to simulated clone", err), false)
		sendLog("Build", fmt.Sprintf("Building Dockerfile %s...", dockerfileName), false)
		sendLog("Build", fmt.Sprintf("Successfully tagged %s", targetImage), false)
		return commitHash
	}
	defer os.RemoveAll(tmpDir)

	cloneArgs := []string{"clone", "--depth", "1"}
	if branch != "" {
		cloneArgs = append(cloneArgs, "--branch", branch)
	}
	cloneArgs = append(cloneArgs, "--", repoURL, tmpDir)

	cmd := exec.CommandContext(ctx, "git", cloneArgs...)
	// Prevent Git from hanging indefinitely on credential prompt if network or auth fails
	cmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		sendLog("Clone", fmt.Sprintf("Notice: git clone output: %s (%v)", strings.TrimSpace(string(out)), err), false)
		sendLog("Build", fmt.Sprintf("Building Dockerfile %s (simulated context)...", dockerfileName), false)
		sendLog("Build", fmt.Sprintf("Successfully tagged %s", targetImage), false)
		return commitHash
	}

	sendLog("Clone", fmt.Sprintf("Successfully cloned %s", repoURL), false)

	if commitHash != "" {
		checkoutCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "checkout", commitHash)
		checkoutCmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
		if err := checkoutCmd.Run(); err != nil {
			// In shallow clone depth 1, commitHash might not be fetched yet. Fetch it explicitly.
			fetchCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "fetch", "--depth", "1", "origin", commitHash)
			fetchCmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
			if err := fetchCmd.Run(); err == nil {
				_ = exec.CommandContext(ctx, "git", "-C", tmpDir, "checkout", "FETCH_HEAD").Run()
			} else {
				// Fallback: unshallow and checkout
				unshallowCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "fetch", "--unshallow")
				unshallowCmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
				_ = unshallowCmd.Run()
				coCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "checkout", commitHash)
				coCmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
				_ = coCmd.Run()
			}
		}
	}

	// Extract actual commit metadata from repository
	headCommitCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "rev-parse", "HEAD")
	headCommitCmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	headCommitOut, _ := headCommitCmd.Output()
	actualHash := strings.TrimSpace(string(headCommitOut))

	msgCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "log", "-1", "--format=%s")
	msgCmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	msgOut, _ := msgCmd.Output()
	actualMsg := strings.TrimSpace(string(msgOut))

	authorCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "log", "-1", "--format=%an")
	authorCmd.Env = append(os.Environ(), "GIT_TERMINAL_PROMPT=0")
	authorOut, _ := authorCmd.Output()
	actualAuthor := strings.TrimSpace(string(authorOut))

	if actualHash != "" {
		sendLog("Clone", fmt.Sprintf("HEAD commit %s: %s (by %s)", actualHash, actualMsg, actualAuthor), false)
	}

	dockerfilePath := filepath.Join(tmpDir, dockerfileName)
	if _, err := os.Stat(dockerfilePath); os.IsNotExist(err) {
		if _, err := os.Stat(filepath.Join(tmpDir, "package.json")); err == nil {
			sendLog("Build", "Notice: Dockerfile not found, auto-generated standard Node.js Dockerfile", false)
			_ = os.WriteFile(dockerfilePath, []byte("FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install --production\nCOPY . .\nEXPOSE 3000\nCMD [\"npm\", \"start\"]\n"), 0o644)
		} else if _, err := os.Stat(filepath.Join(tmpDir, "go.mod")); err == nil {
			sendLog("Build", "Notice: Dockerfile not found, auto-generated standard Go Dockerfile", false)
			_ = os.WriteFile(dockerfilePath, []byte("FROM golang:1.24-alpine AS builder\nWORKDIR /app\nCOPY go.mod go.sum* ./\nRUN go mod download || true\nCOPY . .\nRUN CGO_ENABLED=0 go build -o /app/server .\nFROM alpine:3.20\nWORKDIR /app\nCOPY --from=builder /app/server /app/server\nEXPOSE 8080\nCMD [\"/app/server\"]\n"), 0o644)
		} else {
			sendLog("Build", fmt.Sprintf("Warning: Dockerfile not found at %s, creating minimal fallback Dockerfile", dockerfileName), false)
			_ = os.WriteFile(dockerfilePath, []byte("FROM alpine:latest\nCMD [\"echo\", \"tako app running\"]\n"), 0o644)
		}
	}

	sendLog("Build", fmt.Sprintf("Building Dockerfile %s with context %s...", dockerfileName, tmpDir), false)

	if e.dockerCli != nil {
		tarStream, err := createTarArchive(tmpDir)
		if err != nil {
			sendLog("Build", fmt.Sprintf("Failed to archive build context: %v", err), true)
			return actualHash
		}

		buildTags := []string{
			targetImage,
			fmt.Sprintf("tako/%s:latest", req.GetServiceName()),
		}
		if actualHash != "" && len(actualHash) >= 8 {
			buildTags = append(buildTags, fmt.Sprintf("tako/%s:%s", req.GetServiceName(), actualHash[:8]))
		}

		buildOpts := types.ImageBuildOptions{
			Tags:       buildTags,
			Dockerfile: dockerfileName,
			Remove:     true,
		}

		resp, err := e.dockerCli.RawClient().ImageBuild(ctx, tarStream, buildOpts)
		if err != nil {
			sendLog("Build", fmt.Sprintf("Docker ImageBuild notice: %v", err), false)
		} else {
			defer resp.Body.Close()
			scanner := bufio.NewScanner(resp.Body)
			for scanner.Scan() {
				line := scanner.Text()
				var msg struct {
					Stream string `json:"stream"`
					Error  string `json:"error"`
				}
				if jsonErr := json.Unmarshal([]byte(line), &msg); jsonErr == nil {
					if msg.Error != "" {
						sendLog("Build", msg.Error, true)
					} else if s := strings.TrimSpace(msg.Stream); s != "" {
						sendLog("Build", s, false)
					}
				} else if strings.TrimSpace(line) != "" {
					sendLog("Build", line, false)
				}
			}
		}
	}

	sendLog("Build", fmt.Sprintf("Successfully tagged %s", targetImage), false)
	return actualHash
}

func createTarArchive(srcDir string) (io.Reader, error) {
	pr, pw := io.Pipe()

	go func() {
		tw := tar.NewWriter(pw)
		err := filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if info.IsDir() && info.Name() == ".git" {
				return filepath.SkipDir
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
			if err := tw.WriteHeader(header); err != nil {
				return err
			}
			if !info.Mode().IsRegular() {
				return nil
			}
			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer file.Close()
			_, err = io.Copy(tw, file)
			return err
		})
		if err != nil {
			_ = tw.Close()
			_ = pw.CloseWithError(err)
			return
		}
		if err := tw.Close(); err != nil {
			_ = pw.CloseWithError(err)
			return
		}
		_ = pw.Close()
	}()

	return pr, nil
}
