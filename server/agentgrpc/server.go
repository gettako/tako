package agentgrpc

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"

	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/monitoring"
	"gettako.dev/tako/server/nodes"
	"gettako.dev/tako/server/notifications"
	"gettako.dev/tako/internal/protocol"
)

type AgentServer struct {
	protocol.UnimplementedAgentServiceServer
	DB             *sql.DB
	Domain         string
	NodeManager    *nodes.NodeManager
	Orchestrator   *deploy.Orchestrator
	MetricsManager *monitoring.MetricsManager
}

func NewAgentServer(db *sql.DB, domain string, nm *nodes.NodeManager) *AgentServer {
	var mm *monitoring.MetricsManager
	if db != nil {
		mm = monitoring.NewMetricsManager(db)
		disp := notifications.NewDispatcher(db)
		mm.SetNotifyHook(disp.Send)
	}
	return &AgentServer{
		DB:             db,
		Domain:         domain,
		NodeManager:    nm,
		MetricsManager: mm,
	}
}

func (s *AgentServer) SetOrchestrator(orc *deploy.Orchestrator) {
	s.Orchestrator = orc
}

func (s *AgentServer) SetMetricsManager(mm *monitoring.MetricsManager) {
	s.MetricsManager = mm
}

func (s *AgentServer) Enroll(ctx context.Context, req *protocol.EnrollRequest) (*protocol.EnrollResponse, error) {
	token := strings.TrimSpace(req.GetToken())
	if token == "" {
		return nil, status.Error(codes.InvalidArgument, "enrollment token is required")
	}

	var serverID, statusVal string
	var expiresAt time.Time
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, status, token_expires_at 
		FROM servers 
		WHERE enrollment_token = ?
	`, token).Scan(&serverID, &statusVal, &expiresAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, status.Error(codes.PermissionDenied, "invalid or consumed enrollment token")
		}
		return nil, status.Errorf(codes.Internal, "database query error: %v", err)
	}

	if time.Now().After(expiresAt) {
		return nil, status.Error(codes.PermissionDenied, "enrollment token has expired")
	}

	secretBytes := make([]byte, 32)
	if _, err := rand.Read(secretBytes); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate secret: %v", err)
	}
	nodeSecret := hex.EncodeToString(secretBytes)

	dockerVersion := req.GetDockerVersion()
	osInfo := req.GetOsInfo()
	agentVersion := req.GetAgentVersion()

	_, err = s.DB.ExecContext(ctx, `
		UPDATE servers SET
			node_secret = ?,
			status = 'online',
			agent_version = ?,
			docker_version = ?,
			os_info = ?,
			enrollment_token = NULL,
			token_expires_at = NULL,
			last_heartbeat_at = CURRENT_TIMESTAMP,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, nodeSecret, agentVersion, dockerVersion, osInfo, serverID)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update server enrollment: %v", err)
	}

	slog.Info("agent enrolled successfully",
		slog.String("server_id", serverID),
		slog.String("hostname", req.GetHostname()),
		slog.String("agent_version", agentVersion),
	)

	return &protocol.EnrollResponse{
		NodeId:     serverID,
		NodeSecret: nodeSecret,
	}, nil
}

func (s *AgentServer) StreamNodeSession(stream protocol.AgentService_StreamNodeSessionServer) error {
	ctx := stream.Context()
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return status.Error(codes.Unauthenticated, "metadata missing")
	}

	nodeIDs := md.Get("x-tako-node-id")
	if len(nodeIDs) == 0 {
		nodeIDs = md.Get("node-id")
	}
	nodeSecrets := md.Get("x-tako-node-secret")
	if len(nodeSecrets) == 0 {
		nodeSecrets = md.Get("node-secret")
	}
	if len(nodeIDs) == 0 || len(nodeSecrets) == 0 {
		return status.Error(codes.Unauthenticated, "node credentials headers required")
	}

	nodeID := nodeIDs[0]
	nodeSecret := nodeSecrets[0]

	var exists bool
	err := s.DB.QueryRowContext(ctx, `
		SELECT 1 FROM servers WHERE id = ? AND node_secret = ?
	`, nodeID, nodeSecret).Scan(&exists)
	if err != nil || !exists {
		return status.Error(codes.Unauthenticated, "invalid node credentials")
	}

	if s.NodeManager != nil {
		_, _ = s.NodeManager.RegisterSession(ctx, nodeID, stream)
		defer s.NodeManager.UnregisterSession(ctx, nodeID)
	} else {
		_, _ = s.DB.ExecContext(ctx, `UPDATE servers SET status = 'online', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, nodeID)
	}

	slog.Info("persistent gRPC agent session connected", slog.String("node_id", nodeID))

	for {
		msg, err := stream.Recv()
		if err != nil {
			slog.Info("gRPC agent stream disconnected", slog.String("node_id", nodeID), slog.String("error", err.Error()))
			return err
		}

		if hb := msg.GetHeartbeat(); hb != nil {
			if s.NodeManager != nil {
				_ = s.NodeManager.RecordHeartbeat(ctx, nodeID, hb)
			} else {
				_, _ = s.DB.ExecContext(ctx, `
					UPDATE servers SET
						cpu_percent = ?,
						ram_percent = ?,
						disk_percent = ?,
						uptime_seconds = ?,
						status = 'online',
						last_heartbeat_at = CURRENT_TIMESTAMP,
						updated_at = CURRENT_TIMESTAMP
					WHERE id = ?
				`, hb.GetCpuPercent(), hb.GetRamPercent(), hb.GetDiskPercent(), hb.GetUptimeSeconds(), nodeID)
			}

			_ = stream.Send(&protocol.ServerMessage{
				Payload: &protocol.ServerMessage_HeartbeatAck{
					HeartbeatAck: &protocol.HeartbeatAck{
						Timestamp: time.Now().Unix(),
					},
				},
			})
		}

		if buildLog := msg.GetBuildLog(); buildLog != nil {
			if s.Orchestrator != nil {
				s.Orchestrator.HandleBuildLog(nodeID, buildLog)
			}
		}

		if containerLog := msg.GetContainerLog(); containerLog != nil {
			if s.Orchestrator != nil {
				s.Orchestrator.HandleContainerLog(nodeID, containerLog)
			}
		}

		if depStatus := msg.GetDeploymentStatus(); depStatus != nil {
			if s.Orchestrator != nil {
				s.Orchestrator.HandleDeploymentStatus(nodeID, depStatus)
			}
		}

		if taskAck := msg.GetTaskAck(); taskAck != nil {
			slog.Info("task ack received from agent",
				slog.String("node_id", nodeID),
				slog.String("task_id", taskAck.GetTaskId()),
				slog.Bool("success", taskAck.GetSuccess()),
				slog.String("message", taskAck.GetMessage()),
			)
			if s.NodeManager != nil {
				s.NodeManager.HandleTaskAck(taskAck)
			}
		}

		if sslReport := msg.GetDomainSslReport(); sslReport != nil {
			s.handleDomainSSLReport(ctx, sslReport)
		}

		if traefikResp := msg.GetTraefikConfigResponse(); traefikResp != nil {
			if s.NodeManager != nil {
				s.NodeManager.HandleTraefikConfigResponse(traefikResp)
			}
		}

		if termData := msg.GetTerminalData(); termData != nil {
			if s.NodeManager != nil {
				s.NodeManager.HandleTerminalData(termData)
			}
		}

		if termClose := msg.GetTerminalClose(); termClose != nil {
			if s.NodeManager != nil {
				s.NodeManager.HandleTerminalClose(termClose)
			}
		}

		if metricsReport := msg.GetServiceMetricsReport(); metricsReport != nil {
			if s.MetricsManager != nil {
				_ = s.MetricsManager.StoreReport(ctx, metricsReport)
			}
		}
	}
}

func (s *AgentServer) handleDomainSSLReport(ctx context.Context, report *protocol.DomainSSLReport) {
	if report == nil || s.DB == nil {
		return
	}
	for _, item := range report.GetStatuses() {
		domain := strings.ToLower(strings.TrimSpace(item.GetDomain()))
		if domain == "" {
			continue
		}
		status := item.GetStatus()
		if status == "" {
			status = "pending"
		}
		var errMsg *string
		if item.GetErrorMessage() != "" {
			msg := item.GetErrorMessage()
			errMsg = &msg
		}
		_, err := s.DB.ExecContext(ctx, `
			UPDATE domains
			SET ssl_status = ?, ssl_error = ?
			WHERE LOWER(domain) = ?
		`, status, errMsg, domain)
		if err != nil {
			slog.Error("failed to update domain ssl status from agent", slog.String("domain", domain), slog.String("error", err.Error()))
		}
	}
}

func StartGRPCServer(port string, db *sql.DB, domain string, nm *nodes.NodeManager, orc *deploy.Orchestrator) (*grpc.Server, net.Listener, error) {
	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to listen on gRPC port %s: %w", port, err)
	}

	grpcServer := grpc.NewServer()
	agentServer := NewAgentServer(db, domain, nm)
	if orc != nil {
		agentServer.SetOrchestrator(orc)
	}
	protocol.RegisterAgentServiceServer(grpcServer, agentServer)

	// Enable gRPC reflection for debugging & tooling
	reflection.Register(grpcServer)

	return grpcServer, lis, nil
}
