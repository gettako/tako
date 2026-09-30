package docker

import (
	"context"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"gettako.dev/tako/internal/protocol"
)

type mockAgentSender struct {
	mu       sync.Mutex
	messages []*protocol.AgentMessage
}

func (s *mockAgentSender) Send(msg *protocol.AgentMessage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.messages = append(s.messages, msg)
	return nil
}

func (s *mockAgentSender) getMessages() []*protocol.AgentMessage {
	s.mu.Lock()
	defer s.mu.Unlock()
	copied := make([]*protocol.AgentMessage, len(s.messages))
	copy(copied, s.messages)
	return copied
}

type mockTerminalDockerClient struct {
	mockExecClient
	mu            sync.Mutex
	resizedExecID string
	resizedCols   uint
	resizedRows   uint
	serverConn    net.Conn
}

func (m *mockTerminalDockerClient) ContainerExecAttach(ctx context.Context, execID string, config container.ExecAttachOptions) (types.HijackedResponse, error) {
	if m.execAttachErr != nil {
		return types.HijackedResponse{}, m.execAttachErr
	}
	return types.NewHijackedResponse(m.serverConn, "application/vnd.docker.raw-stream"), nil
}

func (m *mockTerminalDockerClient) ContainerExecResize(ctx context.Context, execID string, options container.ResizeOptions) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.resizedExecID = execID
	m.resizedCols = options.Width
	m.resizedRows = options.Height
	return nil
}

func (m *mockTerminalDockerClient) getResize() (uint, uint) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.resizedCols, m.resizedRows
}

func TestTerminalManager_StartSession_Success(t *testing.T) {
	clientConn, serverConn := net.Pipe()
	defer clientConn.Close()
	defer serverConn.Close()

	cli := &mockTerminalDockerClient{
		serverConn: serverConn,
	}
	cli.execID = "exec_term_1"

	tm := NewTerminalManager(cli)
	sender := &mockAgentSender{}

	startMsg := &protocol.TerminalStart{
		SessionId:   "sess_1",
		ServiceId:   "svc_1",
		ContainerId: "c_123",
		Shell:       "/bin/bash",
		Cols:        80,
		Rows:        24,
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go tm.StartSession(ctx, startMsg, sender)

	// Write prompt into clientConn so tm.StartSession reads it
	go func() {
		_, _ = clientConn.Write([]byte("root@container:/# "))
	}()

	// Wait briefly for data to be read
	time.Sleep(50 * time.Millisecond)

	readCh := make(chan string, 1)
	go func() {
		buf := make([]byte, 1024)
		n, err := clientConn.Read(buf)
		if err == nil {
			readCh <- string(buf[:n])
		}
	}()

	tm.WriteData("sess_1", []byte("ls -la\n"))
	tm.Resize("sess_1", 120, 40)

	var readData string
	select {
	case readData = <-readCh:
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for terminal data to be read from clientConn")
	}

	msgs := sender.getMessages()
	if len(msgs) == 0 {
		t.Fatalf("expected at least one message from TerminalManager, got 0")
	}

	var hasData bool
	for _, m := range msgs {
		if data := m.GetTerminalData(); data != nil {
			if string(data.GetData()) == "root@container:/# " {
				hasData = true
			}
		}
	}
	if !hasData {
		t.Errorf("expected to receive terminal data 'root@container:/# ', got messages: %+v", msgs)
	}

	if readData != "ls -la\n" {
		t.Errorf("expected written data 'ls -la\\n', got %q", readData)
	}

	cols, rows := cli.getResize()
	if cols != 120 || rows != 40 {
		t.Errorf("expected resize to 120x40, got %dx%d", cols, rows)
	}

	tm.CloseSession("sess_1")
}

func TestTerminalManager_StartSession_NoContainer(t *testing.T) {
	cli := &mockTerminalDockerClient{}
	tm := NewTerminalManager(cli)
	sender := &mockAgentSender{}

	startMsg := &protocol.TerminalStart{
		SessionId: "sess_missing",
		ServiceId: "svc_missing",
	}

	tm.StartSession(context.Background(), startMsg, sender)

	msgs := sender.getMessages()
	if len(msgs) != 1 {
		t.Fatalf("expected 1 message, got %d", len(msgs))
	}
	closeMsg := msgs[0].GetTerminalClose()
	if closeMsg == nil {
		t.Fatalf("expected TerminalClose message, got %+v", msgs[0])
	}
	if closeMsg.GetSessionId() != "sess_missing" {
		t.Errorf("expected session_id sess_missing, got %s", closeMsg.GetSessionId())
	}
}
