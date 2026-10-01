# Stage 1: Build static Go binary
FROM --platform=$BUILDPLATFORM golang:alpine AS builder
ARG TARGETOS TARGETARCH
WORKDIR /app

# Cache dependency downloads
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY internal/ ./internal/
COPY server/ ./server/

# Build static binary with stripped debug symbols
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-s -w" -o /bin/server ./server

# Stage 2: Minimal runtime image
FROM alpine:3.20 AS runner
RUN apk add --no-cache ca-certificates tzdata sqlite && \
    mkdir -p /etc/tako /etc/traefik/dynamic

WORKDIR /etc/tako

COPY --from=builder /bin/server /usr/local/bin/server

ENV TAKO_PORT=8080
ENV TAKO_GRPC_PORT=50051
ENV TAKO_DB_PATH=/etc/tako/tako.db

EXPOSE 8080 50051

ENTRYPOINT ["/usr/local/bin/server"]
