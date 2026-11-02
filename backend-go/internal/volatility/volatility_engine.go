package volatility

import (
	"math"
	"sync"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
)

type VolatilityEngine struct {
	symbol       string
	window1m     int
	atrPeriod    int

	mu           sync.RWMutex
	current1m    *models.Candle
	candles1m    []models.Candle
	returns1m    []float64
	atrValue     float64
	lastClose    float64
	avgVolume    float64
}

func NewVolatilityEngine(symbol string, window1m, atrPeriod int) *VolatilityEngine {
	if window1m <= 0 {
		window1m = 30
	}
	if atrPeriod <= 0 {
		atrPeriod = 14
	}
	return &VolatilityEngine{
		symbol:    symbol,
		window1m:  window1m,
		atrPeriod: atrPeriod,
		candles1m: make([]models.Candle, 0, 100),
		returns1m: make([]float64, 0, 100),
	}
}

// LoadHistoricalCandles hydrates the engine with historical candles from REST
func (ve *VolatilityEngine) LoadHistoricalCandles(candles []models.Candle) {
	ve.mu.Lock()
	defer ve.mu.Unlock()

	if len(candles) == 0 {
		return
	}

	ve.candles1m = make([]models.Candle, len(candles))
	copy(ve.candles1m, candles)
	ve.lastClose = candles[len(candles)-1].Close

	// Precalculate returns & ATR from history
	ve.returns1m = make([]float64, 0, len(candles))
	for i := 1; i < len(candles); i++ {
		prev := candles[i-1].Close
		curr := candles[i].Close
		if prev > 0 && curr > 0 {
			ve.returns1m = append(ve.returns1m, math.Log(curr/prev))
		}

		tr := candles[i].High - candles[i].Low
		tr1 := math.Abs(candles[i].High - prev)
		tr2 := math.Abs(candles[i].Low - prev)
		tr = math.Max(tr, math.Max(tr1, tr2))

		if ve.atrValue == 0 {
			ve.atrValue = tr
		} else {
			n := float64(ve.atrPeriod)
			ve.atrValue = ((n-1.0)*ve.atrValue + tr) / n
		}
	}
}

// ProcessTrade updates live 1-minute candle from incoming trade
func (ve *VolatilityEngine) ProcessTrade(trade *models.Trade) *models.VolatilityMetrics {
	ve.mu.Lock()
	defer ve.mu.Unlock()

	tradeTime := trade.ExchangeTime
	if tradeTime.IsZero() {
		tradeTime = time.Now().UTC()
	}
	candleStart := tradeTime.Truncate(time.Minute)

	if ve.current1m == nil {
		ve.current1m = &models.Candle{
			Symbol:     ve.symbol,
			Interval:   "1m",
			StartTime:  candleStart,
			EndTime:    candleStart.Add(time.Minute),
			Open:       trade.Price,
			High:       trade.Price,
			Low:        trade.Price,
			Close:      trade.Price,
			Volume:     trade.Quantity,
			Notional:   trade.Notional,
			TradeCount: 1,
		}
	} else if candleStart.After(ve.current1m.StartTime) {
		// Finalize previous 1m candle
		ve.finalize1mCandle(candleStart)

		ve.current1m = &models.Candle{
			Symbol:     ve.symbol,
			Interval:   "1m",
			StartTime:  candleStart,
			EndTime:    candleStart.Add(time.Minute),
			Open:       trade.Price,
			High:       trade.Price,
			Low:        trade.Price,
			Close:      trade.Price,
			Volume:     trade.Quantity,
			Notional:   trade.Notional,
			TradeCount: 1,
		}
	} else {
		// Update active candle
		if trade.Price > ve.current1m.High {
			ve.current1m.High = trade.Price
		}
		if trade.Price < ve.current1m.Low {
			ve.current1m.Low = trade.Price
		}
		ve.current1m.Close = trade.Price
		ve.current1m.Volume += trade.Quantity
		ve.current1m.Notional += trade.Notional
		ve.current1m.TradeCount++
	}

	return ve.calculateMetrics(trade.Price)
}

// ProcessPriceTick updates live 1-minute candle continuously from orderbook mark price
func (ve *VolatilityEngine) ProcessPriceTick(price float64, tickTime time.Time) {
	ve.mu.Lock()
	defer ve.mu.Unlock()

	if price <= 0 {
		return
	}
	if tickTime.IsZero() {
		tickTime = time.Now().UTC()
	}
	candleStart := tickTime.Truncate(time.Minute)

	if ve.current1m == nil {
		ve.current1m = &models.Candle{
			Symbol:     ve.symbol,
			Interval:   "1m",
			StartTime:  candleStart,
			EndTime:    candleStart.Add(time.Minute),
			Open:       price,
			High:       price,
			Low:        price,
			Close:      price,
			IsClosed:   false,
		}
	} else if candleStart.After(ve.current1m.StartTime) {
		ve.finalize1mCandle(candleStart)
		ve.current1m = &models.Candle{
			Symbol:     ve.symbol,
			Interval:   "1m",
			StartTime:  candleStart,
			EndTime:    candleStart.Add(time.Minute),
			Open:       price,
			High:       price,
			Low:        price,
			Close:      price,
			IsClosed:   false,
		}
	} else {
		if price > ve.current1m.High {
			ve.current1m.High = price
		}
		if price < ve.current1m.Low {
			ve.current1m.Low = price
		}
		ve.current1m.Close = price
	}
}

func (ve *VolatilityEngine) finalize1mCandle(nextStart time.Time) {
	c := ve.current1m
	c.IsClosed = true
	ve.candles1m = append(ve.candles1m, *c)

	// Calculate log return: r_t = ln(Close_t / Close_{t-1})
	if ve.lastClose > 0 && c.Close > 0 {
		logReturn := math.Log(c.Close / ve.lastClose)
		ve.returns1m = append(ve.returns1m, logReturn)
	}

	// Calculate ATR with Wilder Smoothing
	tr := c.High - c.Low
	if ve.lastClose > 0 {
		tr1 := math.Abs(c.High - ve.lastClose)
		tr2 := math.Abs(c.Low - ve.lastClose)
		tr = math.Max(tr, math.Max(tr1, tr2))
	}

	if ve.atrValue == 0 {
		ve.atrValue = tr
	} else {
		n := float64(ve.atrPeriod)
		ve.atrValue = ((n-1.0)*ve.atrValue + tr) / n
	}

	// Update average volume
	if ve.avgVolume == 0 {
		ve.avgVolume = c.Volume
	} else {
		ve.avgVolume = 0.9*ve.avgVolume + 0.1*c.Volume
	}

	ve.lastClose = c.Close

	// Cap memory slices
	if len(ve.candles1m) > 300 {
		ve.candles1m = ve.candles1m[len(ve.candles1m)-300:]
	}
	if len(ve.returns1m) > 300 {
		ve.returns1m = ve.returns1m[len(ve.returns1m)-300:]
	}
}

func (ve *VolatilityEngine) GetCurrentCandle() *models.Candle {
	ve.mu.RLock()
	defer ve.mu.RUnlock()
	if ve.current1m == nil {
		return nil
	}
	c := *ve.current1m
	return &c
}

func (ve *VolatilityEngine) calculateMetrics(currentPrice float64) *models.VolatilityMetrics {
	var currentReturn float64
	if ve.lastClose > 0 && currentPrice > 0 {
		currentReturn = math.Log(currentPrice / ve.lastClose)
	}

	// Realized Volatility: RV = sqrt(sum(r_i^2))
	var sumSq float64
	count := 0
	startIdx := len(ve.returns1m) - ve.window1m
	if startIdx < 0 {
		startIdx = 0
	}
	for i := startIdx; i < len(ve.returns1m); i++ {
		sumSq += ve.returns1m[i] * ve.returns1m[i]
		count++
	}

	var rv float64
	if count > 0 {
		rv = math.Sqrt(sumSq)
	}

	// Relative Volume
	var relVol float64 = 1.0
	if ve.current1m != nil && ve.avgVolume > 0 {
		relVol = ve.current1m.Volume / ve.avgVolume
	}

	return &models.VolatilityMetrics{
		Symbol:             ve.symbol,
		Timestamp:          time.Now().UTC(),
		Interval:           "1m",
		LogReturn:          currentReturn,
		RealizedVolatility: rv,
		ATR:                ve.atrValue,
		RelativeVolume:     relVol,
	}
}

func (ve *VolatilityEngine) GetRecentCandles(limit int) []models.Candle {
	ve.mu.RLock()
	defer ve.mu.RUnlock()

	total := len(ve.candles1m)
	if ve.current1m != nil {
		total++
	}
	if limit <= 0 || limit > total {
		limit = total
	}

	result := make([]models.Candle, 0, limit)
	start := len(ve.candles1m) - (limit - 1)
	if start < 0 {
		start = 0
	}
	for i := start; i < len(ve.candles1m); i++ {
		result = append(result, ve.candles1m[i])
	}
	if ve.current1m != nil && len(result) < limit {
		result = append(result, *ve.current1m)
	}
	return result
}
