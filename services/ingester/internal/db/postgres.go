package db

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	_ "github.com/lib/pq"
)

type DBClient struct {
	db          *sql.DB
	supabaseURL string
	supabaseKey string
	httpClient  *http.Client
}

type InsertTransactionParams struct {
	CreatedBy           string  `json:"created_by"`
	Title               string  `json:"title"`
	Amount              float64 `json:"amount"`
	Type                string  `json:"type"`
	CategoryId          string  `json:"category_id"`
	Scope               string  `json:"scope"`
	Status              string  `json:"status"`
	IsAutoCaptured      bool    `json:"is_auto_captured"`
	SourceApp           string  `json:"source_app"`
	RawNotificationText string  `json:"raw_notification_text"`
	TransactionDate     string  `json:"transaction_date"`
}

func NewDBClient(databaseURL, supabaseURL, supabaseKey string) *DBClient {
	client := &DBClient{
		supabaseURL: supabaseURL,
		supabaseKey: supabaseKey,
		httpClient:  &http.Client{Timeout: 5 * time.Second},
	}

	if databaseURL != "" {
		db, err := sql.Open("postgres", databaseURL)
		if err == nil {
			db.SetMaxOpenConns(20)
			db.SetMaxIdleConns(5)
			db.SetConnMaxLifetime(5 * time.Minute)
			client.db = db
			log.Println("[DATABASE] Direct PostgreSQL connection pool initialized")
		} else {
			log.Printf("[DATABASE WARNING] Could not connect to PostgreSQL directly (%v). Falling back to Supabase REST API.", err)
		}
	}

	return client
}

// InsertTransaction inserts a transaction either via direct SQL or Supabase REST API
func (c *DBClient) InsertTransaction(ctx context.Context, params InsertTransactionParams) (string, error) {
	// 1. Direct PostgreSQL query if available
	if c.db != nil {
		query := `
			insert into public.transactions (
				created_by, title, amount, type, category_id, scope, status,
				is_auto_captured, source_app, raw_notification_text, transaction_date
			) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			returning id;
		`
		var insertedID string
		err := c.db.QueryRowContext(ctx, query,
			params.CreatedBy,
			params.Title,
			params.Amount,
			params.Type,
			params.CategoryId,
			params.Scope,
			params.Status,
			params.IsAutoCaptured,
			params.SourceApp,
			params.RawNotificationText,
			params.TransactionDate,
		).Scan(&insertedID)
		if err == nil {
			return insertedID, nil
		}
		log.Printf("[DATABASE WARNING] Direct insert failed: %v. Trying Supabase REST API...", err)
	}

	// 2. Supabase REST API Fallback
	if c.supabaseURL == "" || c.supabaseKey == "" {
		return "", fmt.Errorf("no database connection or supabase credentials provided")
	}

	endpoint := fmt.Sprintf("%s/rest/v1/transactions", c.supabaseURL)
	bodyBytes, err := json.Marshal(params)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}

	req.Header.Set("apikey", c.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+c.supabaseKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("supabase REST API error status %d", resp.StatusCode)
	}

	var insertedRows []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&insertedRows); err == nil && len(insertedRows) > 0 {
		if id, ok := insertedRows[0]["id"].(string); ok {
			return id, nil
		}
	}

	return "ok", nil
}
