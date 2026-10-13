# Multi-Stage Build: Hasil binary hanya ~15MB RAM hemat
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Download dependencies
COPY go.mod go.sum* ./
RUN go mod download || true

# Copy source code
COPY . .

# Build static binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/ingester ./cmd/server/main.go

# Production Runtime
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata
ENV TZ=Asia/Jakarta

WORKDIR /root/

COPY --from=builder /app/ingester .

EXPOSE 8080

CMD ["./ingester"]
