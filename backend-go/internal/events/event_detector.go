package events

import (
	"fmt"
	"sync"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
)

type EventDetector struct {
	symbol              string
	sweepMinLevels      int
	sweepMinNotional    float64
	absorptionThreshold float64
	withdrawalThreshold float64

	mu                  sync.Mutex
	recentTrades        []models.Trade
	lastBins            map[float64]float64 // binPrice -> lastNotional
	detectedEvents      []models.MarketEvent
	onEvent             func(*models.MarketEvent)
}

func NewEventDetector(
	symbol string,
	sweepMinLevels int,
	sweepMinNotional float64,
	absorptionThreshold float64,
	withdrawalThreshold float64,
	onEvent func(*models.MarketEvent),
) *EventDetector {
	return &EventDetector{
		symbol:              symbol,
		sweepMinLevels:      sweepMinLevels,
		sweepMinNotional:    sweepMinNotional,
		absorptionThreshold: absorptionThreshold,
		withdrawalThreshold: withdrawalThreshold,
		recentTrades:        make([]models.Trade, 0, 100),
		lastBins:            make(map[float64]float64),
		detectedEvents:      make([]models.MarketEvent, 0, 100),
		onEvent:             onEvent,
	}
}

// ProcessTrade inspects trade bursts for sweep and absorption patterns
func (ed *EventDetector) ProcessTrade(trade *models.Trade) {
	ed.mu.Lock()
	defer ed.mu.Unlock()

	now := trade.ExchangeTime
	if now.IsZero() {
		now = time.Now().UTC()
	}

	ed.recentTrades = append(ed.recentTrades, *trade)

	// Keep trades within last 5 seconds
	cutoff := now.Add(-5 * time.Second)
	validTrades := make([]models.Trade, 0, len(ed.recentTrades))
	for _, t := range ed.recentTrades {
		if t.ExchangeTime.After(cutoff) {
			validTrades = append(validTrades, t)
		}
	}
	ed.recentTrades = validTrades

	if len(ed.recentTrades) < 3 {
		return
	}

	// 1. Detect Sweep
	var totalNotional float64
	minP := ed.recentTrades[0].Price
	maxP := ed.recentTrades[0].Price
	buyCount, sellCount := 0, 0

	for _, t := range ed.recentTrades {
		totalNotional += t.Notional
		if t.Price < minP {
			minP = t.Price
		}
		if t.Price > maxP {
			maxP = t.Price
		}
		if t.Side == "buy" {
			buyCount++
		} else if t.Side == "sell" {
			sellCount++
		}
	}

	priceDelta := maxP - minP
	if totalNotional >= ed.sweepMinNotional && priceDelta >= float64(ed.sweepMinLevels)*0.5 {
		direction := "BUY"
		if sellCount > buyCount {
			direction = "SELL"
		}

		event := &models.MarketEvent{
			EventID:    fmt.Sprintf("sweep-%d", now.UnixNano()),
			Symbol:     ed.symbol,
			EventType:  "POSSIBLE_SWEEP",
			Direction:  direction,
			StartTime:  ed.recentTrades[0].ExchangeTime,
			EndTime:    now,
			StartPrice: ed.recentTrades[0].Price,
			EndPrice:   trade.Price,
			PriceLevel: minP,
			Metrics: map[string]any{
				"total_notional": totalNotional,
				"price_delta":    priceDelta,
				"trade_count":    len(ed.recentTrades),
			},
			Evidence: []string{
				fmt.Sprintf("Aggressive execution across $%.1f price span", priceDelta),
				fmt.Sprintf("Executed notional: $%.2f", totalNotional),
			},
			QualityFlags: []string{"VERIFIED_ORDERBOOK"},
			CreatedAt:    time.Now().UTC(),
		}
		ed.emitEvent(event)
		ed.recentTrades = ed.recentTrades[:0] // reset after sweep
		return
	}

	// 2. Detect Absorption
	// High volume with minimal price change: AbsorptionRatio = Volume / (|DeltaP| + epsilon)
	epsilon := 0.1
	absorptionRatio := totalNotional / (priceDelta + epsilon)
	if totalNotional > 25000.0 && absorptionRatio >= ed.absorptionThreshold {
		direction := "BID_ABSORPTION"
		if buyCount > sellCount {
			direction = "ASK_ABSORPTION"
		}

		event := &models.MarketEvent{
			EventID:    fmt.Sprintf("absorp-%d", now.UnixNano()),
			Symbol:     ed.symbol,
			EventType:  "POSSIBLE_ABSORPTION",
			Direction:  direction,
			StartTime:  ed.recentTrades[0].ExchangeTime,
			EndTime:    now,
			StartPrice: minP,
			EndPrice:   maxP,
			PriceLevel: trade.Price,
			Metrics: map[string]any{
				"absorption_ratio": absorptionRatio,
				"total_notional":   totalNotional,
				"price_delta":      priceDelta,
			},
			Evidence: []string{
				fmt.Sprintf("High executed volume ($%.2f) relative to small price move ($%.1f)", totalNotional, priceDelta),
				fmt.Sprintf("Absorption ratio: %.2f", absorptionRatio),
			},
			QualityFlags: []string{"VERIFIED_TRADES"},
			CreatedAt:    time.Now().UTC(),
		}
		ed.emitEvent(event)
	}
}

// ProcessLiquiditySnapshot inspects sudden orderbook reductions (liquidity withdrawal)
func (ed *EventDetector) ProcessLiquiditySnapshot(snap *models.LiquiditySnapshot) {
	ed.mu.Lock()
	defer ed.mu.Unlock()

	currentBins := make(map[float64]float64)
	for _, b := range snap.Bins {
		currentBins[b.BinPrice] = b.TotalNotional

		// Check withdrawal ratio: (L_prev - L_curr) / L_prev
		if prevNotional, exists := ed.lastBins[b.BinPrice]; exists && prevNotional > 10000.0 {
			if b.TotalNotional < prevNotional {
				withdrawalRatio := (prevNotional - b.TotalNotional) / prevNotional
				if withdrawalRatio >= ed.withdrawalThreshold {
					event := &models.MarketEvent{
						EventID:    fmt.Sprintf("withdr-%d-%.0f", time.Now().UnixNano(), b.BinPrice),
						Symbol:     ed.symbol,
						EventType:  "LIQUIDITY_WITHDRAWAL",
						Direction:  "NEUTRAL",
						StartTime:  snap.Timestamp,
						EndTime:    snap.Timestamp,
						PriceLevel: b.BinPrice,
						Metrics: map[string]any{
							"withdrawal_ratio": withdrawalRatio,
							"previous_notional": prevNotional,
							"current_notional":  b.TotalNotional,
						},
						Evidence: []string{
							fmt.Sprintf("Resting liquidity dropped by %.1f%% at $%.0f", withdrawalRatio*100, b.BinPrice),
						},
						QualityFlags: []string{"VERIFIED_ORDERBOOK"},
						CreatedAt:    time.Now().UTC(),
					}
					ed.emitEvent(event)
				}
			}
		}
	}
	ed.lastBins = currentBins
}

func (ed *EventDetector) emitEvent(event *models.MarketEvent) {
	ed.detectedEvents = append(ed.detectedEvents, *event)
	if len(ed.detectedEvents) > 100 {
		ed.detectedEvents = ed.detectedEvents[len(ed.detectedEvents)-100:]
	}
	if ed.onEvent != nil {
		go ed.onEvent(event)
	}
}

func (ed *EventDetector) GetRecentEvents(limit int) []models.MarketEvent {
	ed.mu.Lock()
	defer ed.mu.Unlock()

	if limit <= 0 || limit > len(ed.detectedEvents) {
		limit = len(ed.detectedEvents)
	}
	start := len(ed.detectedEvents) - limit
	result := make([]models.MarketEvent, limit)
	copy(result, ed.detectedEvents[start:])
	return result
}
