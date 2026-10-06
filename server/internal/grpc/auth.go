package grpc

import (
	"context"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// AuthInterceptor validates bearer token or agent secret from incoming gRPC metadata.
func AuthInterceptor(secret string) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		// If no secret configured, allow (e.g. dev/testing default)
		if secret == "" {
			return handler(ctx, req)
		}

		// Allow RegisterNode to pass without agent secret if it provides enroll_token in payload
		if strings.HasSuffix(info.FullMethod, "/RegisterNode") {
			return handler(ctx, req)
		}

		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}

		token := extractToken(md)
		if token == "" || token != secret {
			return nil, status.Error(codes.Unauthenticated, "invalid or missing authentication token")
		}

		return handler(ctx, req)
	}
}

// StreamAuthInterceptor validates authentication for streaming RPCs.
func StreamAuthInterceptor(secret string) grpc.StreamServerInterceptor {
	return func(
		srv any,
		ss grpc.ServerStream,
		info *grpc.StreamServerInfo,
		handler grpc.StreamHandler,
	) error {
		if secret == "" {
			return handler(srv, ss)
		}

		md, ok := metadata.FromIncomingContext(ss.Context())
		if !ok {
			return status.Error(codes.Unauthenticated, "missing metadata")
		}

		token := extractToken(md)
		if token == "" || token != secret {
			return status.Error(codes.Unauthenticated, "invalid or missing authentication token")
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
