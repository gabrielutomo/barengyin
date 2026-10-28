package db

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
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

// LookupProfileByAPIKey resolves an opaque ingester API key to the profile
// that owns it. Returns ("", nil) when the key is unknown so the caller can
// answer 401 without leaking whether the key merely exists.
//
// The lookup runs against public.user_api_keys, which is RLS-protected:
// only the service_role REST client (bypasses RLS) or the direct postgres
// connection can read it. The desktop/mobile client never can.
func (c *DBClient) LookupProfileByAPIKey(ctx context.Context, apiKey string) (string, error) {
	if apiKey == "" {
		return "", nil
	}

	// 1. Direct PostgreSQL query if available
	if c.db != nil {
		var profileID string
		err := c.db.QueryRowContext(ctx,
			`select profile_id from public.user_api_keys where api_key = $1 limit 1`,
			apiKey,
		).Scan(&profileID)
		if err == nil {
			return profileID, nil
		}
		if err != sql.ErrNoRows {
			log.Printf("[DATABASE WARNING] API key lookup failed: %v. Trying Supabase REST API...", err)
		} else {
			return "", nil
		}
	}

	// 2. Supabase REST API fallback
	if c.supabaseURL == "" || c.supabaseKey == "" {
		return "", fmt.Errorf("no database connection or supabase credentials provided")
	}

	endpoint := fmt.Sprintf(
		"%s/rest/v1/user_api_keys?select=profile_id&api_key=eq.%s&limit=1",
		c.supabaseURL,
		url.QueryEscape(apiKey),
	)

	req, err := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("apikey", c.supabaseKey)
	req.Header.Set("Authorization", "Bearer "+c.supabaseKey)
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("supabase REST API error status %d", resp.StatusCode)
	}

	var rows []struct {
		ProfileID string `json:"profile_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&rows); err != nil {
		return "", err
	}
	if len(rows) == 0 {
		return "", nil
	}

	return rows[0].ProfileID, nil
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
