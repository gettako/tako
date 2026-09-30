# Stage 1: Build static Go agent binary
FROM --platform=$BUILDPLATFORM golang:alpine AS builder
ARG TARGETOS TARGETARCH
WORKDIR /app

# Cache dependency downloads
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY internal/ ./internal/
COPY agent/ ./agent/

# Build static binary with stripped debug symbols
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -ldflags="-s -w" -o /bin/agent ./agent

# Stage 2: Minimal runtime image with Docker CLI and Git
FROM alpine:3.20 AS runner
RUN apk add --no-cache docker-cli git ca-certificates tzdata && \
    mkdir -p /etc/tako /etc/traefik/dynamic

COPY --from=builder /bin/agent /usr/local/bin/agent

WORKDIR /etc/tako

ENTRYPOINT ["/usr/local/bin/agent"]
