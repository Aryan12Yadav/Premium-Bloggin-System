package market

import (
	"sort"
	"sync"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
)

type LocalOrderbook struct {
	symbol       string
	metadata     *models.InstrumentMetadata
	staleLimit   time.Duration

	mu           sync.RWMutex
	bids         map[float64]float64 // price -> quantity
	asks         map[float64]float64 // price -> quantity
	lastSeq      int64
	lastExchange time.Time
	lastReceive  time.Time
	isSynced     bool
	health       models.HealthStatus
}

func NewLocalOrderbook(symbol string, meta *models.InstrumentMetadata, staleLimit time.Duration) *LocalOrderbook {
	return &LocalOrderbook{
		symbol:     symbol,
		metadata:   meta,
		staleLimit: staleLimit,
		bids:       make(map[float64]float64),
		asks:       make(map[float64]float64),
		health:     models.StatusConnecting,
	}
}

// UpdateFromSnapshot replaces the entire book from a validated L2 snapshot
func (ob *LocalOrderbook) UpdateFromSnapshot(snap *models.OrderbookSnapshot) {
	ob.mu.Lock()
	defer ob.mu.Unlock()

	// Clear and rebuild
	ob.bids = make(map[float64]float64, len(snap.Bids))
	for _, b := range snap.Bids {
		if b.Quantity > 0 {
			ob.bids[b.Price] = b.Quantity
		}
	}

	ob.asks = make(map[float64]float64, len(snap.Asks))
	for _, a := range snap.Asks {
		if a.Quantity > 0 {
			ob.asks[a.Price] = a.Quantity
		}
	}

	ob.lastSeq = snap.Sequence
	ob.lastExchange = snap.ExchangeTime
	ob.lastReceive = snap.ReceivedTime
	ob.isSynced = true
	ob.health = models.StatusLive
}

// SetHealth updates the current health status
func (ob *LocalOrderbook) SetHealth(status models.HealthStatus) {
	ob.mu.Lock()
	defer ob.mu.Unlock()
	ob.health = status
	if status != models.StatusLive {
		ob.isSynced = false
	}
}

// GetSnapshot produces a sorted, immutable snapshot of the orderbook
func (ob *LocalOrderbook) GetSnapshot() *models.OrderbookSnapshot {
	ob.mu.RLock()
	defer ob.mu.RUnlock()

	now := time.Now().UTC()
	health := ob.health
	if ob.isSynced && ob.staleLimit > 0 && now.Sub(ob.lastReceive) > ob.staleLimit {
		health = models.StatusStale
	}

	// Sort bids descending
	bidPrices := make([]float64, 0, len(ob.bids))
	for p := range ob.bids {
		bidPrices = append(bidPrices, p)
	}
	sort.Slice(bidPrices, func(i, j int) bool {
		return bidPrices[i] > bidPrices[j]
	})

	bids := make([]models.OrderbookLevel, 0, len(bidPrices))
	for _, p := range bidPrices {
		qty := ob.bids[p]
		bids = append(bids, models.OrderbookLevel{
			Price:    p,
			Quantity: qty,
			Notional: ob.metadata.CalculateNotional(p, qty),
		})
	}

	// Sort asks ascending
	askPrices := make([]float64, 0, len(ob.asks))
	for p := range ob.asks {
		askPrices = append(askPrices, p)
	}
	sort.Slice(askPrices, func(i, j int) bool {
		return askPrices[i] < askPrices[j]
	})

	asks := make([]models.OrderbookLevel, 0, len(askPrices))
	for _, p := range askPrices {
		qty := ob.asks[p]
		asks = append(asks, models.OrderbookLevel{
			Price:    p,
			Quantity: qty,
			Notional: ob.metadata.CalculateNotional(p, qty),
		})
	}

	var bestBid, bestAsk, spread, spreadBps float64
	if len(bids) > 0 {
		bestBid = bids[0].Price
	}
	if len(asks) > 0 {
		bestAsk = asks[0].Price
	}
	if bestBid > 0 && bestAsk > 0 {
		spread = bestAsk - bestBid
		mid := (bestAsk + bestBid) / 2.0
		if mid > 0 {
			spreadBps = (spread / mid) * 10000.0
		}
	}

	return &models.OrderbookSnapshot{
		Symbol:       ob.symbol,
		Bids:         bids,
		Asks:         asks,
		BestBid:      bestBid,
		BestAsk:      bestAsk,
		Spread:       spread,
		SpreadBps:    spreadBps,
		Sequence:     ob.lastSeq,
		ExchangeTime: ob.lastExchange,
		ReceivedTime: ob.lastReceive,
		IsSynced:     ob.isSynced && health == models.StatusLive,
		Health:       health,
	}
}
