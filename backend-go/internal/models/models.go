package models

import "time"

// HealthStatus represents the connectivity and synchronization state
type HealthStatus string

const (
	StatusConnecting   HealthStatus = "CONNECTING"
	StatusLive         HealthStatus = "LIVE"
	StatusDelayed      HealthStatus = "DELAYED"
	StatusStale        HealthStatus = "STALE"
	StatusResyncing    HealthStatus = "RESYNCING"
	StatusDisconnected HealthStatus = "DISCONNECTED"
	StatusError        HealthStatus = "ERROR"
)

// InstrumentMetadata defines Delta Exchange contract specs
type InstrumentMetadata struct {
	Symbol            string  `json:"symbol"`
	ProductID         int64   `json:"product_id"`
	ContractType      string  `json:"contract_type"`
	ContractValue     float64 `json:"contract_value"`
	TickSize          float64 `json:"tick_size"`
	ContractUnit      string  `json:"contract_unit_currency"`
	QuotingAsset      string  `json:"quoting_asset"`
	SettlingAsset     string  `json:"settling_asset"`
	PricePrecision    int     `json:"price_precision"`
	QuantityPrecision int     `json:"quantity_precision"`
	State             string  `json:"state"`
}

// CalculateNotional returns notional value in quote currency (USD/USDT)
// For BTCUSDT: Notional = Price * Quantity * ContractValue
func (m *InstrumentMetadata) CalculateNotional(price, quantity float64) float64 {
	if m.ContractValue > 0 {
		return price * quantity * m.ContractValue
	}
	return price * quantity
}

// Trade represents a normalized trade execution
type Trade struct {
	TradeID      string    `json:"trade_id"`
	Symbol       string    `json:"symbol"`
	Price        float64   `json:"price"`
	Quantity     float64   `json:"quantity"`
	Notional     float64   `json:"notional"`
	Side         string    `json:"side"` // "buy" or "sell"
	ExchangeTime time.Time `json:"exchange_time"`
	ReceivedTime time.Time `json:"received_time"`
}

// OrderbookLevel represents price and contract quantity
type OrderbookLevel struct {
	Price    float64 `json:"price"`
	Quantity float64 `json:"quantity"`
	Notional float64 `json:"notional"`
}

// OrderbookSnapshot is the canonical synchronized book
type OrderbookSnapshot struct {
	Symbol       string           `json:"symbol"`
	Bids         []OrderbookLevel `json:"bids"`
	Asks         []OrderbookLevel `json:"asks"`
	BestBid      float64          `json:"best_bid"`
	BestAsk      float64          `json:"best_ask"`
	Spread       float64          `json:"spread"`
	SpreadBps    float64          `json:"spread_bps"`
	Sequence     int64            `json:"sequence"`
	ExchangeTime time.Time        `json:"exchange_time"`
	ReceivedTime time.Time        `json:"received_time"`
	IsSynced     bool             `json:"is_synced"`
	Health       HealthStatus     `json:"health"`
}

// PriceBinLiquidity represents resting liquidity grouped into a price bin
type PriceBinLiquidity struct {
	BinPrice       float64 `json:"bin_price"`
	BidQuantity    float64 `json:"bid_quantity"`
	AskQuantity    float64 `json:"ask_quantity"`
	BidNotional    float64 `json:"bid_notional"`
	AskNotional    float64 `json:"ask_notional"`
	TotalNotional  float64 `json:"total_notional"`
	Intensity      float64 `json:"intensity"` // Normalized [0, 1]
	PersistenceSec float64 `json:"persistence_sec"`
}

// LiquiditySnapshot holds the current aggregated orderbook liquidity
type LiquiditySnapshot struct {
	Symbol            string              `json:"symbol"`
	Timestamp         time.Time           `json:"timestamp"`
	BinWidth          float64             `json:"bin_width"`
	TotalBidNotional  float64             `json:"total_bid_notional"`
	TotalAskNotional  float64             `json:"total_ask_notional"`
	Imbalance         float64             `json:"imbalance"` // [-1, +1]
	BidAskRatio       float64             `json:"bid_ask_ratio"`
	Bins              []PriceBinLiquidity `json:"bins"`
	Health            HealthStatus        `json:"health"`
}

// HeatmapBucket represents 1-minute aggregation per price bin
type HeatmapBucket struct {
	Symbol          string    `json:"symbol"`
	BucketStart     time.Time `json:"bucket_start"`
	PriceBin        float64   `json:"price_bin"`
	BidOpen         float64   `json:"bid_open"`
	BidHigh         float64   `json:"bid_high"`
	BidLow          float64   `json:"bid_low"`
	BidClose        float64   `json:"bid_close"`
	AskOpen         float64   `json:"ask_open"`
	AskHigh         float64   `json:"ask_high"`
	AskLow          float64   `json:"ask_low"`
	AskClose        float64   `json:"ask_close"`
	BidTimeWeighted float64   `json:"bid_time_weighted"`
	AskTimeWeighted float64   `json:"ask_time_weighted"`
	BidMax          float64   `json:"bid_max"`
	AskMax          float64   `json:"ask_max"`
	BidAdded        float64   `json:"bid_added"`
	AskAdded        float64   `json:"ask_added"`
	BidRemoved      float64   `json:"bid_removed"`
	AskRemoved      float64   `json:"ask_removed"`
	CoverageMs      int64     `json:"coverage_ms"`
	IsComplete      bool      `json:"is_complete"`
}

// Candle represents OHLCV price candle
type Candle struct {
	Symbol     string    `json:"symbol"`
	Interval   string    `json:"interval"` // "1m", "5m", "15m"
	StartTime  time.Time `json:"start_time"`
	EndTime    time.Time `json:"end_time"`
	Open       float64   `json:"open"`
	High       float64   `json:"high"`
	Low        float64   `json:"low"`
	Close      float64   `json:"close"`
	Volume     float64   `json:"volume"`
	Notional   float64   `json:"notional"`
	TradeCount int64     `json:"trade_count"`
	IsClosed   bool      `json:"is_closed"`
}

// VolatilityMetrics represents real-time volatility measurements
type VolatilityMetrics struct {
	Symbol             string    `json:"symbol"`
	Timestamp          time.Time `json:"timestamp"`
	Interval           string    `json:"interval"`
	LogReturn          float64   `json:"log_return"`
	RealizedVolatility float64   `json:"realized_volatility"`
	RollingStdDev      float64   `json:"rolling_std_dev"`
	ATR                float64   `json:"atr"`
	RelativeVolume     float64   `json:"relative_volume"`
	Spread             float64   `json:"spread"`
}

// MarketEvent represents a detected event (Sweep, Absorption, Withdrawal, etc.)
type MarketEvent struct {
	EventID      string         `json:"event_id"`
	Symbol       string         `json:"symbol"`
	EventType    string         `json:"event_type"` // "POSSIBLE_SWEEP", "POSSIBLE_ABSORPTION", "LIQUIDITY_WITHDRAWAL"
	Direction    string         `json:"direction"`  // "BUY", "SELL", "NEUTRAL"
	StartTime    time.Time      `json:"start_time"`
	EndTime      time.Time      `json:"end_time"`
	StartPrice   float64        `json:"start_price"`
	EndPrice     float64        `json:"end_price"`
	PriceLevel   float64        `json:"price_level"`
	Metrics      map[string]any `json:"metrics"`
	Evidence     []string       `json:"evidence"`
	QualityFlags []string       `json:"quality_flags"`
	Confidence   *float64       `json:"confidence,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
}
