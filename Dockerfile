# ---- Build stage ----
FROM golang:1.22-alpine AS builder
WORKDIR /src

COPY go.mod ./
RUN go mod download

COPY *.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /knfo .

# ---- Runtime stage ----
FROM debian:bookworm-slim
WORKDIR /app

# Install kubectl
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
    && KUBECTL_VERSION=$(curl -sSL https://dl.k8s.io/release/stable.txt) \
    && curl -sSL "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
        -o /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/kubectl \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /knfo /app/knfo
COPY web/ /app/web/

EXPOSE 8080

ENTRYPOINT ["/app/knfo"]
