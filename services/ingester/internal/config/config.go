package config

import (
	"os"
)

type Config struct {
	Port         string
	RedisAddr    string
	RedisPass    string
	SupabaseURL  string
	SupabaseKey  string
	DatabaseURL  string
	MasterAPIKey string
}

func LoadConfig() *Config {
	return &Config{
		Port:         getEnv("PORT", "8080"),
		RedisAddr:    getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPass:    getEnv("REDIS_PASSWORD", ""),
		SupabaseURL:  getEnv("NEXT_PUBLIC_SUPABASE_URL", ""),
		SupabaseKey:  getEnv("SUPABASE_SERVICE_ROLE_KEY", ""),
		DatabaseURL:  getEnv("DATABASE_URL", ""),
		MasterAPIKey: getEnv("INGESTER_API_KEY", "barengyin-super-secret-key"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
