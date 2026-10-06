# Multi-stage Dockerfile for Tako Agent Daemon
FROM golang:1.24-alpine AS builder

WORKDIR /src

RUN apk add --no-cache git ca-certificates tzdata

# Copy proto and agent source
COPY proto/ /src/proto/
COPY agent/ /src/agent/
COPY go.work /src/go.work

WORKDIR /src/agent
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/tako-agent ./cmd/agent

FROM alpine:3.20 AS runner

RUN apk add --no-cache ca-certificates tzdata curl docker-cli

WORKDIR /app
COPY --from=builder /bin/tako-agent /app/tako-agent

RUN mkdir -p /data
VOLUME /data

ENV TAKO_SERVER_ADDR="tako-server:50051"
ENV TAKO_DATA_DIR="/data"
ENV TAKO_METRICS_INTERVAL="3s"

ENTRYPOINT ["/app/tako-agent"]
