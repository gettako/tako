package main

import (
	"database/sql"
	"net"

	"google.golang.org/grpc"

	"gettako.dev/tako/server/agentgrpc"
	"gettako.dev/tako/server/deploy"
	"gettako.dev/tako/server/nodes"
)

type AgentServer struct {
	*agentgrpc.AgentServer
	nodeManager *nodes.NodeManager
	db          *sql.DB
}

func NewAgentServer(db *sql.DB, domain string, nm *nodes.NodeManager) *AgentServer {
	return &AgentServer{
		AgentServer: agentgrpc.NewAgentServer(db, domain, nm),
		nodeManager: nm,
		db:          db,
	}
}

func startGRPCServer(port string, db *sql.DB, domain string, nm *nodes.NodeManager, orc *deploy.Orchestrator) (*grpc.Server, net.Listener, error) {
	return agentgrpc.StartGRPCServer(port, db, domain, nm, orc)
}
