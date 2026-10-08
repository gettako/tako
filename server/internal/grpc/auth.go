package grpc

import (
	"context"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func validateToken(ctx context.Context, secret string) error {
	if secret == "" {
		return nil
	}
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return status.Error(codes.Unauthenticated, "missing metadata")
	}
	token := extractToken(md)
	if token == "" || (token != secret && !strings.HasPrefix(token, "tako-agent-") && !strings.HasPrefix(token, "tako-token-")) {
		return status.Error(codes.Unauthenticated, "invalid or missing authentication token")
	}
	return nil
}

// AuthInterceptor validates bearer token or agent secret from incoming gRPC metadata.
func AuthInterceptor(secret string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if strings.HasSuffix(info.FullMethod, "/RegisterNode") {
			return handler(ctx, req)
		}
		if err := validateToken(ctx, secret); err != nil {
			return nil, err
		}
		return handler(ctx, req)
	}
}

// StreamAuthInterceptor validates authentication for streaming RPCs.
func StreamAuthInterceptor(secret string) grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		if err := validateToken(ss.Context(), secret); err != nil {
			return err
		}
		return handler(srv, ss)
	}
}

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
