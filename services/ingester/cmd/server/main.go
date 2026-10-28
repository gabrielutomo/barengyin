package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/barengyin/notification-ingester/internal/cache"
	"github.com/barengyin/notification-ingester/internal/config"
	"github.com/barengyin/notification-ingester/internal/db"
	"github.com/barengyin/notification-ingester/internal/handler"
)

func main() {
	log.Println("==================================================")
	log.Println("🚀 BARENGYIN NOTIFICATION INGESTION SERVICE (GOLANG)")
	log.Println("==================================================")

	// 1. Load configuration
	cfg := config.LoadConfig()

	// Authentication is per-user: a request is accepted iff its API key exists
	// in public.user_api_keys. There is no shared master credential, so no
	// startup key check is needed here. The previous version refused to start
	// without INGESTER_API_KEY, a value the request path no longer reads.

	// 2. Initialize Redis Client
	redisClient := cache.NewRedisClient(cfg.RedisAddr, cfg.RedisPass)

	// 3. Initialize Database Client
	dbClient := db.NewDBClient(cfg.DatabaseURL, cfg.SupabaseURL, cfg.SupabaseKey)

	// 4. Setup HTTP Handlers
	captureHandler := handler.NewCaptureHandler(redisClient, dbClient)

	mux := http.NewServeMux()

	// Health Check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok", "service": "barengyin-ingester", "time": "` + time.Now().UTC().Format(time.RFC3339) + `"}`))
	})

	// Ingestion Endpoint
	mux.HandleFunc("/v1/notifications/capture", captureHandler.HandleCapture)

	// 5. Start Server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("⚡ Ingestion server listening on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server startup failed: %v", err)
		}
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}
	log.Println("✅ Ingestion server stopped.")
}
