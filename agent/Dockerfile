# Multi-stage Dockerfile for Tako Agent Daemon
FROM golang:1.27-alpine AS builder

ENV GOTOOLCHAIN=auto

WORKDIR /src

RUN apk add --no-cache git ca-certificates tzdata

# Copy proto and agent source
COPY api/proto/ /src/api/proto/
COPY agent/ /src/agent/

ENV GOWORK=off
WORKDIR /src/agent
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/tako-agent ./cmd/agent

FROM alpine:3.20 AS runner

RUN apk add --no-cache ca-certificates tzdata curl docker-cli git

WORKDIR /app
COPY --from=builder /bin/tako-agent /app/tako-agent

RUN mkdir -p /data
VOLUME /data

ENV TAKO_SERVER_ADDR="tako-server:50051"
ENV TAKO_DATA_DIR="/data"
ENV TAKO_METRICS_INTERVAL="3s"

ENTRYPOINT ["/app/tako-agent"]
