// Package grpc provides authentication interceptors for securing gRPC RPC endpoints.
package grpc

import (
	"context"
	"strings"

	"gettako.dev/tako/internal/orchestrator"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// nodeAuthKey is a context key used to store the verified node identifier of the caller.
type nodeAuthKey struct{}

// validateToken verifies the bearer token from gRPC metadata against master secrets,
// dynamically registered node tokens, or fallback tokens.
func validateToken(ctx context.Context, secret string, orch *orchestrator.Orchestrator, fallbackTokens map[string]string) (context.Context, error) {
	if secret == "" && orch == nil && len(fallbackTokens) == 0 {
		return ctx, nil
	}
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ctx, status.Error(codes.Unauthenticated, "missing metadata")
	}
	token := extractToken(md)
	if token == "" {
		return ctx, status.Error(codes.Unauthenticated, "invalid or missing authentication token")
	}

	// Direct match with master agent secret
	if secret != "" && token == secret {
		return context.WithValue(ctx, nodeAuthKey{}, "master"), nil
	}

	// Match with dynamically registered node token in orchestrator
	if orch != nil {
		if nodeID, valid := orch.ValidateNodeAuthToken(token); valid {
			return context.WithValue(ctx, nodeAuthKey{}, nodeID), nil
		}
	}

	// Match with registered fallback token (for test harnesses)
	if fallbackTokens != nil {
		if nodeID, valid := fallbackTokens[token]; valid {
			return context.WithValue(ctx, nodeAuthKey{}, nodeID), nil
		}
	}

	return ctx, status.Error(codes.Unauthenticated, "invalid or missing authentication token")
}

// wrappedServerStream overrides the Context method of grpc.ServerStream to inject authentication values.
type wrappedServerStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (w *wrappedServerStream) Context() context.Context {
	return w.ctx
}

// AuthInterceptor validates bearer token or agent secret from incoming gRPC metadata.
func AuthInterceptor(secret string, orch *orchestrator.Orchestrator, fallbackTokens map[string]string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if strings.HasSuffix(info.FullMethod, "/RegisterNode") {
			return handler(ctx, req)
		}
		newCtx, err := validateToken(ctx, secret, orch, fallbackTokens)
		if err != nil {
			return nil, err
		}
		return handler(newCtx, req)
	}
}

// StreamAuthInterceptor validates authentication for streaming RPCs.
func StreamAuthInterceptor(secret string, orch *orchestrator.Orchestrator, fallbackTokens map[string]string) grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		newCtx, err := validateToken(ss.Context(), secret, orch, fallbackTokens)
		if err != nil {
			return err
		}
		return handler(srv, &wrappedServerStream{ServerStream: ss, ctx: newCtx})
	}
}

// extractToken pulls bearer or x-agent-token credentials from incoming gRPC metadata.
func extractToken(md metadata.MD) string {
	if vals := md.Get("authorization"); len(vals) > 0 {
		val := vals[0]
		if strings.HasPrefix(strings.ToLower(val), "bearer ") {
			return strings.TrimSpace(val[7:])
		}
		return strings.TrimSpace(val)
	}
	if vals := md.Get("x-agent-token"); len(vals) > 0 {
		return strings.TrimSpace(vals[0])
	}
	return ""
}
