package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/barengyin/notification-ingester/internal/cache"
	"github.com/barengyin/notification-ingester/internal/config"
	"github.com/barengyin/notification-ingester/internal/db"
	"github.com/barengyin/notification-ingester/internal/parser"
)

type CaptureHandler struct {
	cfg   *config.Config
	redis *cache.RedisClient
	db    *db.DBClient
}

func NewCaptureHandler(cfg *config.Config, redis *cache.RedisClient, db *db.DBClient) *CaptureHandler {
	return &CaptureHandler{
		cfg:   cfg,
		redis: redis,
		db:    db,
	}
}

type CaptureRequest struct {
	UserID      string `json:"user_id"`
	PackageName string `json:"package_name"`
	Title       string `json:"title"`
	Text        string `json:"text"`
	PostTime    int64  `json:"post_time"`
}

type CaptureResponse struct {
	Status        string                  `json:"status"`
	Message       string                  `json:"message"`
	TransactionID string                  `json:"transaction_id,omitempty"`
	Parsed        *parser.ParsedTransaction `json:"parsed,omitempty"`
}

func (h *CaptureHandler) HandleCapture(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 1. Auth check (X-API-Key or Authorization header)
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			apiKey = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	if apiKey == "" && h.cfg.MasterAPIKey != "" {
		http.Error(w, `{"error": "Unauthorized: API Key required"}`, http.StatusUnauthorized)
		return
	}

	// 2. Decode payload
	var req CaptureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid JSON body"}`, http.StatusBadRequest)
		return
	}

	if req.Text == "" {
		http.Error(w, `{"error": "Text notification cannot be empty"}`, http.StatusBadRequest)
		return
	}

	// 3. Redis Deduplication Check (< 1ms)
	dedupKey := cache.GenerateDedupKey(req.UserID, req.PackageName+":"+req.Text)
	if h.redis.IsDuplicate(r.Context(), dedupKey, 5*time.Minute) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(CaptureResponse{
			Status:  "duplicate_ignored",
			Message: "Notification was already processed in the last 5 minutes.",
		})
		return
	}

	// 4. Run Universal Bank Parser (< 0.1ms)
	parsed := parser.ParseNotification(req.PackageName, req.Title, req.Text)

	// If amount could not be extracted, set reasonable defaults
	txTitle := parsed.Title
	if txTitle == "" {
		txTitle = "Transaksi " + parsed.SourceBank
	}
	if parsed.Amount <= 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(CaptureResponse{
			Status:  "unrecognized_notification",
			Message: "Notification received but no transaction amount was found.",
			Parsed:  &parsed,
		})
		return
	}

	// 5. Direct write to database (Status: pending_review, Scope: personal)
	currentDate := time.Now().Format("2006-01-02")
	txID, err := h.db.InsertTransaction(r.Context(), db.InsertTransactionParams{
		CreatedBy:           req.UserID,
		Title:               txTitle,
		Amount:              parsed.Amount,
		Type:                parsed.Type,
		CategoryId:          parsed.Category,
		Scope:               "personal", // Default to personal space
		Status:              "pending_review",
		IsAutoCaptured:      true,
		SourceApp:           req.PackageName,
		RawNotificationText: req.Text,
		TransactionDate:     currentDate,
	})

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{
			"error": "Failed to save transaction: " + err.Error(),
		})
		return
	}

	// 6. Return response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(CaptureResponse{
		Status:        "captured",
		Message:       "Transaction successfully captured and waiting for in-app review.",
		TransactionID: txID,
		Parsed:        &parsed,
	})
}
