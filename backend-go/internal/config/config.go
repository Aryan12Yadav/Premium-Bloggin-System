package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

func loadEnvFile() {
	paths := []string{".env", "../.env", "../../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err == nil {
			for _, line := range strings.Split(string(data), "\n") {
				line = strings.TrimSpace(line)
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				parts := strings.SplitN(line, "=", 2)
				if len(parts) == 2 {
					key := strings.TrimSpace(parts[0])
					val := strings.TrimSpace(parts[1])
					if os.Getenv(key) == "" {
						_ = os.Setenv(key, val)
					}
				}
			}
			break
		}
	}
}

type Config struct {
	Symbol                   string
	ExchangeWSURL            string
	ExchangeRESTURL          string
	ServerPort               string
	HeatmapBinWidth          float64
	HeatmapBucketDuration    time.Duration
	OrderbookStaleThreshold  time.Duration
	VolatilityWindow1m       int
	VolatilityWindow5m       int
	VolatilityWindow15m      int
	ATRPeriod                int
	SweepMinLevels           int
	SweepMinNotional         float64
	AbsorptionRatioThreshold float64
	WithdrawalThreshold      float64
}

func LoadConfig() *Config {
	loadEnvFile()
	return &Config{
		Symbol:                   getEnv("MARKET_SYMBOL", "BTCUSDT"),
		ExchangeWSURL:            getEnv("EXCHANGE_WS_URL", "wss://socket.delta.exchange"),
		ExchangeRESTURL:          getEnv("EXCHANGE_REST_URL", "https://api.delta.exchange"),
		ServerPort:               getEnv("PORT", "8080"),
		HeatmapBinWidth:          getEnvFloat("HEATMAP_PRICE_BIN_WIDTH", 50.0),
		HeatmapBucketDuration:    time.Minute,
		OrderbookStaleThreshold:  time.Duration(getEnvInt("ORDERBOOK_STALE_MS", 5000)) * time.Millisecond,
		VolatilityWindow1m:       getEnvInt("VOLATILITY_WINDOW_1M", 30),
		VolatilityWindow5m:       getEnvInt("VOLATILITY_WINDOW_5M", 24),
		VolatilityWindow15m:      getEnvInt("VOLATILITY_WINDOW_15M", 16),
		ATRPeriod:                getEnvInt("ATR_PERIOD", 14),
		SweepMinLevels:           getEnvInt("SWEEP_MIN_LEVELS", 3),
		SweepMinNotional:         getEnvFloat("SWEEP_MIN_NOTIONAL", 50000.0),
		AbsorptionRatioThreshold: getEnvFloat("ABSORPTION_RATIO_THRESHOLD", 500.0),
		WithdrawalThreshold:      getEnvFloat("WITHDRAWAL_RATIO_THRESHOLD", 0.40),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func getEnvFloat(key string, defaultVal float64) float64 {
	if val := os.Getenv(key); val != "" {
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return f
		}
	}
	return defaultVal
}
