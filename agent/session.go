package main

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"strings"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"

	"gettako.dev/tako/internal/protocol"
)

type MessageHandler func(msg *protocol.ServerMessage)

type SessionClient struct {
	creds          *AgentCredentials
	onMessage      MessageHandler
	outgoing       chan *protocol.AgentMessage
	mu             sync.Mutex
	activeStream   protocol.AgentService_StreamNodeSessionClient
	connected      bool
	onConnected    func()
	onDisconnected func()
}

func NewSessionClient(creds *AgentCredentials, onMessage MessageHandler) *SessionClient {
	return &SessionClient{
		creds:     creds,
		onMessage: onMessage,
		outgoing:  make(chan *protocol.AgentMessage, 128),
	}
}

func (s *SessionClient) Send(msg *protocol.AgentMessage) error {
	msg.NodeId = s.creds.NodeID
	select {
	case s.outgoing <- msg:
		return nil
	default:
		return errors.New("outgoing message buffer full")
	}
}

func (s *SessionClient) IsConnected() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.connected
}

func (s *SessionClient) Run(ctx context.Context) {
	backoff := 1 * time.Second
	maxBackoff := 30 * time.Second

	for {
		select {
		case <-ctx.Done():
			slog.Info("session loop terminated by context")
			return
		default:
		}

		err := s.connectAndStream(ctx)
		if ctx.Err() != nil {
			return
		}

		slog.Warn("gRPC session disconnected, reconnecting",
			slog.String("server_url", s.creds.ServerURL),
			slog.Duration("retry_in", backoff),
			slog.Any("error", err),
		)

		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}

		// Exponential backoff with small random jitter
		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
		jitter, _ := rand.Int(rand.Reader, big.NewInt(500))
		backoff += time.Duration(jitter.Int64()) * time.Millisecond
	}
}

func (s *SessionClient) connectAndStream(ctx context.Context) error {
	useTLS := strings.HasPrefix(s.creds.ServerURL, "https://")
	target := strings.TrimPrefix(s.creds.ServerURL, "https://")
	target = strings.TrimPrefix(target, "http://")

	var cred credentials.TransportCredentials
	if useTLS {
		cred = credentials.NewTLS(&tls.Config{MinVersion: tls.VersionTLS12})
	} else {
		cred = insecure.NewCredentials()
	}

	kacp := keepalive.ClientParameters{
		Time:                10 * time.Second,
		Timeout:             3 * time.Second,
		PermitWithoutStream: true,
	}

	conn, err := grpc.NewClient(
		target,
		grpc.WithTransportCredentials(cred),
		grpc.WithKeepaliveParams(kacp),
	)
	if err != nil {
		return fmt.Errorf("dial failed: %w", err)
	}
	defer conn.Close()

	client := protocol.NewAgentServiceClient(conn)

	streamCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	streamCtx = metadata.NewOutgoingContext(streamCtx, metadata.Pairs(
		"x-tako-node-id", s.creds.NodeID,
		"x-tako-node-secret", s.creds.NodeSecret,
		"node-id", s.creds.NodeID,
		"node-secret", s.creds.NodeSecret,
	))

	stream, err := client.StreamNodeSession(streamCtx)
	if err != nil {
		return fmt.Errorf("StreamNodeSession open failed: %w", err)
	}

	s.mu.Lock()
	s.activeStream = stream
	s.connected = true
	s.mu.Unlock()

	slog.Info("gRPC session stream connected", slog.String("node_id", s.creds.NodeID))
	if s.onConnected != nil {
		s.onConnected()
	}

	errChan := make(chan error, 2)

	// Outgoing sender goroutine
	go func() {
		for {
			select {
			case <-streamCtx.Done():
				return
			case msg, ok := <-s.outgoing:
				if !ok {
					return
				}
				if err := stream.Send(msg); err != nil {
					errChan <- fmt.Errorf("send error: %w", err)
					return
				}
			}
		}
	}()

	// Incoming receiver goroutine
	go func() {
		for {
			msg, err := stream.Recv()
			if err != nil {
				errChan <- fmt.Errorf("recv error: %w", err)
				return
			}
			if s.onMessage != nil {
				s.onMessage(msg)
			}
		}
	}()

	var finalErr error
	select {
	case <-ctx.Done():
		finalErr = ctx.Err()
	case err := <-errChan:
		finalErr = err
	}

	s.mu.Lock()
	s.connected = false
	s.activeStream = nil
	s.mu.Unlock()

	if s.onDisconnected != nil {
		s.onDisconnected()
	}

	return finalErr
}
