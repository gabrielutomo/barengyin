package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/barengyin/notification-ingester/internal/cache"
	"github.com/barengyin/notification-ingester/internal/db"
	"github.com/barengyin/notification-ingester/internal/parser"
)

type CaptureHandler struct {
	redis *cache.RedisClient
	db    *db.DBClient
}

func NewCaptureHandler(redis *cache.RedisClient, db *db.DBClient) *CaptureHandler {
	return &CaptureHandler{
		redis: redis,
		db:    db,
	}
}

// CaptureRequest is the notification payload from the device.
//
// There is deliberately no user_id field: identity comes from the API key
// (see resolveOwner). A body-supplied user id would let any caller write into
// any account. Unknown JSON fields are ignored by encoding/json, so older
// clients that still send user_id will not break.
type CaptureRequest struct {
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

// resolveOwner maps the presented API key to the profile that owns it.
// This is the single authentication gate for the endpoint: a key is valid if
// and only if it exists in public.user_api_keys. Returns ("", false) when the
// key is unknown.
//
// There is deliberately no separate master-key check. The previous version
// required the presented key to equal cfg.MasterAPIKey (INGESTER_API_KEY)
// before this lookup ran, which made the documented per-user flow impossible:
// keys issued from Pengaturan were rejected before they were ever looked up,
// and the master key itself failed this lookup unless it also happened to be a
// user_api_keys row. Unknown keys still get a 401 from the caller.
func (h *CaptureHandler) resolveOwner(ctx context.Context, apiKey string) (string, bool) {
	if apiKey == "" {
		return "", false
	}
	profileID, err := h.db.LookupProfileByAPIKey(ctx, apiKey)
	if err != nil || profileID == "" {
		return "", false
	}
	return profileID, true
}

func (h *CaptureHandler) HandleCapture(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 1. Extract the API key (X-API-Key or Authorization: Bearer).
	apiKey := r.Header.Get("X-API-Key")
	if apiKey == "" {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			apiKey = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}

	// 2. Authenticate AND resolve identity in one step: the key must exist in
	//    public.user_api_keys. Unknown or absent keys get a 401. The request
	//    body cannot name a user: the user_id field was removed from
	//    CaptureRequest.
	ownerID, ok := h.resolveOwner(r.Context(), apiKey)
	if !ok {
		http.Error(w, `{"error": "Unauthorized: unknown API Key"}`, http.StatusUnauthorized)
		return
	}

	// 3. Decode payload
	var req CaptureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error": "Invalid JSON body"}`, http.StatusBadRequest)
		return
	}

	if req.Text == "" {
		http.Error(w, `{"error": "Text notification cannot be empty"}`, http.StatusBadRequest)
		return
	}

	// 4. Redis Deduplication Check (< 1ms)
	dedupKey := cache.GenerateDedupKey(ownerID, req.PackageName+":"+req.Text)
	if h.redis.IsDuplicate(r.Context(), dedupKey, 5*time.Minute) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(CaptureResponse{
			Status:  "duplicate_ignored",
			Message: "Notification was already processed in the last 5 minutes.",
		})
		return
	}

	// 5. Run Universal Bank Parser (< 0.1ms)
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

	// 6. Direct write to database (Status: pending_review, Scope: personal)
	currentDate := time.Now().Format("2006-01-02")
	txID, err := h.db.InsertTransaction(r.Context(), db.InsertTransactionParams{
		CreatedBy:           ownerID,
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

	// 7. Return response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(CaptureResponse{
		Status:        "captured",
		Message:       "Transaction successfully captured and waiting for in-app review.",
		TransactionID: txID,
		Parsed:        &parsed,
	})
}
