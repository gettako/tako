# Multi-stage Dockerfile for Tako Server Control Plane
FROM golang:1.24-alpine AS builder

WORKDIR /src

RUN apk add --no-cache git ca-certificates tzdata

# Copy proto and server source
COPY proto/ /src/proto/
COPY server/ /src/server/
COPY go.work /src/go.work

WORKDIR /src/server
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /bin/tako-server ./cmd/server

FROM alpine:3.20 AS runner

RUN apk add --no-cache ca-certificates tzdata curl

WORKDIR /app
COPY --from=builder /bin/tako-server /app/tako-server

RUN mkdir -p /data
VOLUME /data

ENV TAKO_DB_PATH=/data/tako.db
ENV TAKO_HTTP_PORT=8080
ENV TAKO_GRPC_PORT=50051

EXPOSE 8080 50051

ENTRYPOINT ["/app/tako-server"]
