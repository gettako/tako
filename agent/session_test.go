package main

import (
	"context"
	"io"
	"net"
	"sync"
	"testing"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"gettako.dev/tako/internal/protocol"
)

type testSessionServer struct {
	protocol.UnimplementedAgentServiceServer
	mu              sync.Mutex
	receivedNodeID  string
	heartbeats      []*protocol.Heartbeat
	streamConnected chan struct{}
}

func (s *testSessionServer) StreamNodeSession(stream protocol.AgentService_StreamNodeSessionServer) error {
	md, ok := metadata.FromIncomingContext(stream.Context())
	if !ok {
		return status.Error(codes.Unauthenticated, "missing metadata")
	}

	nodeIDs := md.Get("x-tako-node-id")
	if len(nodeIDs) == 0 {
		nodeIDs = md.Get("node-id")
	}
	nodeSecrets := md.Get("x-tako-node-secret")
	if len(nodeSecrets) == 0 {
		nodeSecrets = md.Get("node-secret")
	}

	if len(nodeIDs) == 0 || nodeIDs[0] != "srv_test_node" || len(nodeSecrets) == 0 || nodeSecrets[0] != "valid_secret" {
		return status.Error(codes.Unauthenticated, "invalid credentials")
	}

	s.mu.Lock()
	s.receivedNodeID = nodeIDs[0]
	s.mu.Unlock()

	select {
	case s.streamConnected <- struct{}{}:
	default:
	}

	for {
		msg, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}

		if hb := msg.GetHeartbeat(); hb != nil {
			s.mu.Lock()
			s.heartbeats = append(s.heartbeats, hb)
			s.mu.Unlock()

			// Send Ack
			if err := stream.Send(&protocol.ServerMessage{
				Payload: &protocol.ServerMessage_HeartbeatAck{
					HeartbeatAck: &protocol.HeartbeatAck{Timestamp: time.Now().Unix()},
				},
			}); err != nil {
				return err
			}
		}
	}
}

func TestSessionClientBidirectionalAndReconnection(t *testing.T) {
	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen: %v", err)
	}

	server := &testSessionServer{
		streamConnected: make(chan struct{}, 5),
	}
	grpcServer := grpc.NewServer()
	protocol.RegisterAgentServiceServer(grpcServer, server)

	go func() {
		_ = grpcServer.Serve(lis)
	}()

	creds := &AgentCredentials{
		NodeID:     "srv_test_node",
		NodeSecret: "valid_secret",
		ServerURL:  "http://" + lis.Addr().String(),
	}

	var receivedAcks int
	var ackMu sync.Mutex

	client := NewSessionClient(creds, func(msg *protocol.ServerMessage) {
		if msg.GetHeartbeatAck() != nil {
			ackMu.Lock()
			receivedAcks++
			ackMu.Unlock()
		}
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go client.Run(ctx)

	// Wait for connection
	select {
	case <-server.streamConnected:
	case <-time.After(3 * time.Second):
		t.Fatal("timed out waiting for stream connection")
	}

	// Verify server identified node ID
	server.mu.Lock()
	if server.receivedNodeID != "srv_test_node" {
		t.Fatalf("expected node_id srv_test_node, got %s", server.receivedNodeID)
	}
	server.mu.Unlock()

	// Send heartbeat message
	err = client.Send(&protocol.AgentMessage{
		Payload: &protocol.AgentMessage_Heartbeat{
			Heartbeat: &protocol.Heartbeat{
				CpuPercent: 15.5,
				RamPercent: 42.0,
			},
		},
	})
	if err != nil {
		t.Fatalf("send heartbeat failed: %v", err)
	}

	// Check ack received
	time.Sleep(100 * time.Millisecond)
	ackMu.Lock()
	if receivedAcks == 0 {
		t.Fatal("expected heartbeat ack, received none")
	}
	ackMu.Unlock()

	// Verify server received heartbeat
	server.mu.Lock()
	if len(server.heartbeats) == 0 || server.heartbeats[0].CpuPercent != 15.5 {
		t.Fatalf("server did not receive expected heartbeat: %+v", server.heartbeats)
	}
	server.mu.Unlock()

	// Test reconnection: Stop server and verify client notices disconnect
	grpcServer.Stop()

	// Wait for disconnect
	time.Sleep(150 * time.Millisecond)
	if client.IsConnected() {
		t.Fatal("client should reflect disconnected status after server stops")
	}

	// Restart server on same port
	newLis, err := net.Listen("tcp", lis.Addr().String())
	if err != nil {
		t.Fatalf("failed to re-listen: %v", err)
	}
	newGrpcServer := grpc.NewServer()
	protocol.RegisterAgentServiceServer(newGrpcServer, server)
	go func() {
		_ = newGrpcServer.Serve(newLis)
	}()
	defer newGrpcServer.Stop()

	// Wait for reconnection
	select {
	case <-server.streamConnected:
	case <-time.After(4 * time.Second):
		t.Fatal("timed out waiting for automatic reconnection")
	}

	if !client.IsConnected() {
		t.Fatal("client should be connected after reconnecting")
	}
}
