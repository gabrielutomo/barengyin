package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"github.com/go-redis/redis/v8"
)

type RedisClient struct {
	rdb *redis.Client
}

func NewRedisClient(addr, password string) *RedisClient {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Printf("[REDIS WARNING] Could not connect to Redis at %s (%v). Running in fallback mode (no cache deduplication).", addr, err)
		return &RedisClient{rdb: nil}
	}

	log.Printf("[REDIS SUCCESS] Connected to Redis instance at %s", addr)
	return &RedisClient{rdb: rdb}
}

// GenerateDedupKey generates a unique SHA256 key based on user and notification text
func GenerateDedupKey(userId, text string) string {
	hasher := sha256.New()
	hasher.Write([]byte(fmt.Sprintf("%s:%s", userId, text)))
	return "dedup:notif:" + hex.EncodeToString(hasher.Sum(nil))
}

// IsDuplicate returns true if the notification was already processed in the last TTL window
func (c *RedisClient) IsDuplicate(ctx context.Context, key string, ttl time.Duration) bool {
	if c.rdb == nil {
		return false // Redis not configured, proceed safely
	}

	// SetNX returns true if the key was set (i.e., did not exist previously)
	wasSet, err := c.rdb.SetNX(ctx, key, "1", ttl).Result()
	if err != nil {
		log.Printf("[REDIS ERROR] SetNX check failed: %v", err)
		return false
	}

	// If wasSet is false, the key already existed, meaning it's a duplicate!
	return !wasSet
}
