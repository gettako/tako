package docker

import (
	"archive/tar"
	"bytes"
	"context"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/docker/docker/api/types"

	"gettako.dev/tako/internal/protocol"
)

type mockLogSender struct {
	logs        []*protocol.BuildLogChunk
	transitions []*protocol.DeploymentStatusTransition
}

func (m *mockLogSender) SendBuildLog(chunk *protocol.BuildLogChunk) error {
	m.logs = append(m.logs, chunk)
	return nil
}

func (m *mockLogSender) SendStatusTransition(transition *protocol.DeploymentStatusTransition) error {
	m.transitions = append(m.transitions, transition)
	return nil
}

func (m *mockLogSender) SendContainerLog(chunk *protocol.ContainerLogChunk) error {
	return nil
}

type mockDockerBuilder struct {
	responseBody string
	buildErr     error
	receivedOpts types.ImageBuildOptions
}

func (m *mockDockerBuilder) ImageBuild(ctx context.Context, buildContext io.Reader, options types.ImageBuildOptions) (types.ImageBuildResponse, error) {
	m.receivedOpts = options
	if m.buildErr != nil {
		return types.ImageBuildResponse{}, m.buildErr
	}
	// Drain the buildContext to ensure no reader leak
	_, _ = io.Copy(io.Discard, buildContext)
	return types.ImageBuildResponse{
		Body: io.NopCloser(strings.NewReader(m.responseBody)),
	}, nil
}

func TestCreateTarStream(t *testing.T) {
	tempDir := t.TempDir()

	file1 := filepath.Join(tempDir, "hello.txt")
	_ = os.WriteFile(file1, []byte("Hello Tako"), 0644)

	subDir := filepath.Join(tempDir, "nested")
	_ = os.Mkdir(subDir, 0755)
	file2 := filepath.Join(subDir, "Dockerfile")
	_ = os.WriteFile(file2, []byte("FROM alpine:latest\nCMD [\"echo\", \"hi\"]"), 0644)

	stream, errCh := CreateTarStream(tempDir)
	defer stream.Close()

	tr := tar.NewReader(stream)
	foundFiles := make(map[string]string)

	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("tar reading error: %v", err)
		}
		if header.Typeflag == tar.TypeReg {
			var buf bytes.Buffer
			_, _ = io.Copy(&buf, tr)
			foundFiles[header.Name] = buf.String()
		}
	}

	if err := <-errCh; err != nil {
		t.Fatalf("tar stream error: %v", err)
	}

	if foundFiles["hello.txt"] != "Hello Tako" {
		t.Errorf("unexpected content for hello.txt: %s", foundFiles["hello.txt"])
	}
	if !strings.Contains(foundFiles["nested/Dockerfile"], "FROM alpine:latest") {
		t.Errorf("unexpected content for nested/Dockerfile: %s", foundFiles["nested/Dockerfile"])
	}
}

func TestParseDockerBuildOutput(t *testing.T) {
	dockerOutput := `{"stream":"Step 1/2 : FROM node:20\n"}
{"stream":" ---> running in 123abc456\n"}
{"stream":"Step 2/2 : CMD [\"node\", \"app.js\"]\n"}
{"stream":"Successfully tagged test:latest\n"}
`
	sender := &mockLogSender{}
	err := ParseDockerBuildOutput(strings.NewReader(dockerOutput), "dep_test_1", sender)
	if err != nil {
		t.Fatalf("ParseDockerBuildOutput failed: %v", err)
	}

	if len(sender.logs) < 4 {
		t.Fatalf("expected at least 4 logs, got %d", len(sender.logs))
	}

	// Verify step extraction
	var foundStep1, foundStep2 bool
	for _, l := range sender.logs {
		if l.Step == "1/2" {
			foundStep1 = true
		}
		if l.Step == "2/2" {
			foundStep2 = true
		}
	}
	if !foundStep1 || !foundStep2 {
		t.Errorf("failed to extract steps: step1=%v, step2=%v", foundStep1, foundStep2)
	}
}

func TestParseDockerBuildOutputError(t *testing.T) {
	dockerOutput := `{"stream":"Step 1/2 : FROM node:20\n"}
{"error":"failed to solve with frontend dockerfile.v0: failed to read dockerfile: open /var/lib/docker/tmp/Dockerfile: no such file or directory","errorDetail":{"message":"error"}}
`
	sender := &mockLogSender{}
	err := ParseDockerBuildOutput(strings.NewReader(dockerOutput), "dep_test_2", sender)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	if !strings.Contains(err.Error(), "failed to read dockerfile") {
		t.Errorf("unexpected error text: %v", err)
	}
}

func setupLocalGitRepo(t *testing.T) string {
	t.Helper()
	repoDir := t.TempDir()

	runGit := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = repoDir
		cmd.Env = append(os.Environ(),
			"GIT_AUTHOR_NAME=Test User",
			"GIT_AUTHOR_EMAIL=test@example.com",
			"GIT_COMMITTER_NAME=Test User",
			"GIT_COMMITTER_EMAIL=test@example.com",
		)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v failed: %s (%v)", args, string(out), err)
		}
	}

	runGit("init", "-b", "main")
	runGit("config", "user.name", "Test User")
	runGit("config", "user.email", "test@example.com")

	dockerfile := filepath.Join(repoDir, "Dockerfile")
	_ = os.WriteFile(dockerfile, []byte("FROM alpine\nCMD [\"echo\", \"ready\"]\n"), 0644)

	runGit("add", "Dockerfile")
	runGit("commit", "-m", "Initial commit for takotest")

	return repoDir
}

func TestBuilderEndToEnd(t *testing.T) {
	localRepo := setupLocalGitRepo(t)
	buildsDir := t.TempDir()

	mockCli := &mockDockerBuilder{
		responseBody: `{"stream":"Step 1/1 : FROM alpine\n"}{"stream":"Successfully built 987654\n"}`,
	}

	builder := NewBuilder(mockCli, buildsDir)
	sender := &mockLogSender{}

	job := &protocol.DeployJob{
		DeploymentId:   "dep_builder_001",
		ServiceId:      "srv_web_001",
		Repository:     localRepo,
		Branch:         "main",
		DockerfilePath: "Dockerfile",
		BuildArgs: map[string]string{
			"API_URL": "https://api.example.com",
		},
	}

	res, err := builder.Build(context.Background(), job, sender)
	if err != nil {
		t.Fatalf("builder.Build failed: %v", err)
	}

	expectedTag := "tako-app-srv_web_001:dep_builder_001"
	if res.ImageTag != expectedTag {
		t.Errorf("expected image tag %s, got %s", expectedTag, res.ImageTag)
	}
	if res.CommitAuthor != "Test User" {
		t.Errorf("expected author 'Test User', got '%s'", res.CommitAuthor)
	}
	if res.CommitMessage != "Initial commit for takotest" {
		t.Errorf("expected commit message 'Initial commit for takotest', got '%s'", res.CommitMessage)
	}

	// Verify build argument passed to Docker SDK
	if valPtr, ok := mockCli.receivedOpts.BuildArgs["API_URL"]; !ok || *valPtr != "https://api.example.com" {
		t.Errorf("expected BuildArg API_URL to be passed, got %v", mockCli.receivedOpts.BuildArgs)
	}

	// Verify build directory was cleaned up
	clonedDir := filepath.Join(buildsDir, "dep_builder_001")
	if _, err := os.Stat(clonedDir); !os.IsNotExist(err) {
		t.Errorf("expected build context directory to be cleaned up, but it still exists at %s", clonedDir)
	}

	// Verify status transition
	if len(sender.transitions) == 0 || sender.transitions[0].Status != "building" {
		t.Errorf("expected building status transition, got %+v", sender.transitions)
	}
}

func TestCloneRepository_WithSSHPrivateKey(t *testing.T) {
	// Create a local git repo to clone from
	srcRepo := t.TempDir()
	initCmd := exec.Command("git", "init", srcRepo)
	if err := initCmd.Run(); err != nil {
		t.Fatalf("failed to git init: %v", err)
	}

	testFile := filepath.Join(srcRepo, "test.txt")
	_ = os.WriteFile(testFile, []byte("ssh clone test"), 0644)
	_ = exec.Command("git", "-C", srcRepo, "config", "user.name", "Test User").Run()
	_ = exec.Command("git", "-C", srcRepo, "config", "user.email", "test@example.com").Run()
	_ = exec.Command("git", "-C", srcRepo, "add", ".").Run()
	_ = exec.Command("git", "-C", srcRepo, "commit", "-m", "ssh test commit").Run()

	targetDir := filepath.Join(t.TempDir(), "target")
	builder := NewBuilder(&mockDockerBuilder{}, t.TempDir())

	fakePrivateKey := "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW\n-----END OPENSSH PRIVATE KEY-----"
	expectedKeyPath := filepath.Join(os.TempDir(), "tako-builds", filepath.Base(targetDir), "id_ed25519")

	meta, err := builder.CloneRepository(context.Background(), srcRepo, "", "", targetDir, fakePrivateKey)
	if err != nil {
		t.Fatalf("CloneRepository failed: %v", err)
	}

	if meta.CommitMessage != "ssh test commit" {
		t.Errorf("expected commit message 'ssh test commit', got %q", meta.CommitMessage)
	}

	// Verify key file was wiped and removed from disk
	if _, err := os.Stat(expectedKeyPath); !os.IsNotExist(err) {
		t.Errorf("expected private key file to be removed, but still exists: %s", expectedKeyPath)
	}
}

func TestNormalizeGitCloneURL(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"supianidz/tako-demo-hello", "https://github.com/supianidz/tako-demo-hello.git"},
		{"supianidz/tako-demo-hello.git", "https://github.com/supianidz/tako-demo-hello.git"},
		{"github.com/supianidz/tako-demo-hello", "https://github.com/supianidz/tako-demo-hello.git"},
		{"github.com/supianidz/tako-demo-hello.git", "https://github.com/supianidz/tako-demo-hello.git"},
		{"https://github.com/supianidz/tako-demo-hello", "https://github.com/supianidz/tako-demo-hello"},
		{"https://github.com/supianidz/tako-demo-hello.git", "https://github.com/supianidz/tako-demo-hello.git"},
		{"git@github.com:supianidz/tako-demo-hello.git", "git@github.com:supianidz/tako-demo-hello.git"},
		{"ssh://git@gitlab.com/group/repo.git", "ssh://git@gitlab.com/group/repo.git"},
		{"/tmp/local-path", "/tmp/local-path"},
		{"./relative/path", "./relative/path"},
		{"", ""},
	}

	for _, tc := range tests {
		actual := NormalizeGitCloneURL(tc.input)
		if actual != tc.expected {
			t.Errorf("NormalizeGitCloneURL(%q) = %q; expected %q", tc.input, actual, tc.expected)
		}
	}
}

func TestCloneRepository_WithGitToken(t *testing.T) {
	srcRepo := t.TempDir()
	initCmd := exec.Command("git", "init", srcRepo)
	if err := initCmd.Run(); err != nil {
		t.Fatalf("failed to git init: %v", err)
	}

	testFile := filepath.Join(srcRepo, "app.txt")
	_ = os.WriteFile(testFile, []byte("token clone test"), 0644)
	_ = exec.Command("git", "-C", srcRepo, "config", "user.name", "Token User").Run()
	_ = exec.Command("git", "-C", srcRepo, "config", "user.email", "token@example.com").Run()
	_ = exec.Command("git", "-C", srcRepo, "add", ".").Run()
	_ = exec.Command("git", "-C", srcRepo, "commit", "-m", "token test commit").Run()

	targetDir := filepath.Join(t.TempDir(), "target")
	builder := NewBuilder(&mockDockerBuilder{}, t.TempDir())

	meta, err := builder.CloneRepository(context.Background(), srcRepo, "", "", targetDir, "", "ghs_testtoken123")
	if err != nil {
		t.Fatalf("CloneRepository with token failed: %v", err)
	}

	if meta.CommitMessage != "token test commit" {
		t.Errorf("expected commit message 'token test commit', got %q", meta.CommitMessage)
	}
}

func TestCloneRepository_RedactsTokenOnError(t *testing.T) {
	builder := NewBuilder(&mockDockerBuilder{}, t.TempDir())
	targetDir := filepath.Join(t.TempDir(), "target")
	secretToken := "ghs_supersecrettoken999"

	_, err := builder.CloneRepository(context.Background(), "https://invalid.example.com/not/real/repo.git", "", "", targetDir, "", secretToken)
	if err == nil {
		t.Fatalf("expected clone to fail for non-existent repo")
	}

	errMsg := err.Error()
	if strings.Contains(errMsg, secretToken) {
		t.Errorf("CloneRepository error leaked secret token: %s", errMsg)
	}
}
