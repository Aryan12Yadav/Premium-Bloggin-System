package liquidity

import (
	"math"
	"sort"
	"sync"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
)

type PriceBinner struct {
	binWidth float64
	origin   float64

	mu          sync.RWMutex
	persistence map[float64]time.Time // binPrice -> first seen time
}

func NewPriceBinner(binWidth float64) *PriceBinner {
	return &PriceBinner{
		binWidth:    binWidth,
		origin:      0.0,
		persistence: make(map[float64]time.Time),
	}
}

// GetBinPrice calculates the base price for the bin: BinPrice = P0 + floor((P - P0) / B) * B
func (pb *PriceBinner) GetBinPrice(price float64) float64 {
	if pb.binWidth <= 0 {
		return price
	}
	binIndex := math.Floor((price - pb.origin) / pb.binWidth)
	return pb.origin + binIndex*pb.binWidth
}

// Aggregate converts an OrderbookSnapshot into binned LiquiditySnapshot
func (pb *PriceBinner) Aggregate(snap *models.OrderbookSnapshot) *models.LiquiditySnapshot {
	pb.mu.Lock()
	defer pb.mu.Unlock()

	now := time.Now().UTC()
	binMap := make(map[float64]*models.PriceBinLiquidity)

	getOrCreateBin := func(p float64) *models.PriceBinLiquidity {
		bp := pb.GetBinPrice(p)
		if b, exists := binMap[bp]; exists {
			return b
		}
		b := &models.PriceBinLiquidity{BinPrice: bp}
		binMap[bp] = b
		return b
	}

	var totalBidNotional, totalAskNotional float64

	// Aggregate bids
	for _, b := range snap.Bids {
		bin := getOrCreateBin(b.Price)
		bin.BidQuantity += b.Quantity
		bin.BidNotional += b.Notional
		bin.TotalNotional += b.Notional
		totalBidNotional += b.Notional
	}

	// Aggregate asks
	for _, a := range snap.Asks {
		bin := getOrCreateBin(a.Price)
		bin.AskQuantity += a.Quantity
		bin.AskNotional += a.Notional
		bin.TotalNotional += a.Notional
		totalAskNotional += a.Notional
	}

	// Extract and sort bins by price descending
	bins := make([]models.PriceBinLiquidity, 0, len(binMap))
	var minNotional, maxNotional float64
	first := true

	for bp, b := range binMap {
		if b.TotalNotional > 0 {
			if first {
				minNotional = b.TotalNotional
				maxNotional = b.TotalNotional
				first = false
			} else {
				if b.TotalNotional < minNotional {
					minNotional = b.TotalNotional
				}
				if b.TotalNotional > maxNotional {
					maxNotional = b.TotalNotional
				}
			}

			// Track persistence
			if firstSeen, ok := pb.persistence[bp]; ok {
				b.PersistenceSec = now.Sub(firstSeen).Seconds()
			} else {
				pb.persistence[bp] = now
				b.PersistenceSec = 0
			}
		} else {
			delete(pb.persistence, bp)
		}

		bins = append(bins, *b)
	}

	// Clean up stale persistence entries for bins no longer active
	for bp := range pb.persistence {
		if _, exists := binMap[bp]; !exists {
			delete(pb.persistence, bp)
		}
	}

	// Sort bins descending
	sort.Slice(bins, func(i, j int) bool {
		return bins[i].BinPrice > bins[j].BinPrice
	})

	// Normalize visual intensity [0, 1]
	denom := maxNotional - minNotional
	for i := range bins {
		if denom > 0 {
			bins[i].Intensity = (bins[i].TotalNotional - minNotional) / denom
		} else if bins[i].TotalNotional > 0 {
			bins[i].Intensity = 1.0
		}
	}

	// Calculate Imbalance: I = (Bid - Ask) / (Bid + Ask)
	var imbalance float64
	totalCombined := totalBidNotional + totalAskNotional
	if totalCombined > 0 {
		imbalance = (totalBidNotional - totalAskNotional) / totalCombined
	}

	var ratio float64
	if totalAskNotional > 0 {
		ratio = totalBidNotional / totalAskNotional
	}

	return &models.LiquiditySnapshot{
		Symbol:           snap.Symbol,
		Timestamp:        snap.ExchangeTime,
		BinWidth:         pb.binWidth,
		TotalBidNotional: totalBidNotional,
		TotalAskNotional: totalAskNotional,
		Imbalance:        imbalance,
		BidAskRatio:      ratio,
		Bins:             bins,
		Health:           snap.Health,
	}
}
