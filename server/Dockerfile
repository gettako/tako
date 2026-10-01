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
RUN apk add --no-cache ca-certificates tzdata sqlite

# Run as non-root user
RUN addgroup -S -g 10001 tako && \
    adduser -S -u 10001 -G tako tako && \
    mkdir -p /etc/tako && \
    chown -R tako:tako /etc/tako

USER tako
WORKDIR /etc/tako

COPY --from=builder --chown=tako:tako /bin/server /usr/local/bin/server

ENV TAKO_PORT=8080
ENV TAKO_GRPC_PORT=50051
ENV TAKO_DB_PATH=/etc/tako/tako.db

EXPOSE 8080 50051

ENTRYPOINT ["/usr/local/bin/server"]
