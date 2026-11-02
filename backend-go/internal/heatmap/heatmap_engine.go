package heatmap

import (
	"sync"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
)

type binObservation struct {
	lastBid     float64
	lastAsk     float64
	lastSeen    time.Time
	bidWeighted float64
	askWeighted float64
	totalTimeMs int64
}

type HeatmapEngine struct {
	symbol         string
	binWidth       float64
	bucketDuration time.Duration

	mu              sync.RWMutex
	currentBucket   time.Time
	activeBuckets   map[float64]*models.HeatmapBucket // priceBin -> bucket
	lastObs         map[float64]*binObservation       // priceBin -> obs
	history         []models.HeatmapBucket            // finalized buckets (capped to 3600)
	onBucketFinal   func([]models.HeatmapBucket)
}

func NewHeatmapEngine(symbol string, binWidth float64, onBucketFinal func([]models.HeatmapBucket)) *HeatmapEngine {
	return &HeatmapEngine{
		symbol:         symbol,
		binWidth:       binWidth,
		bucketDuration: time.Minute,
		activeBuckets:  make(map[float64]*models.HeatmapBucket),
		lastObs:        make(map[float64]*binObservation),
		history:        make([]models.HeatmapBucket, 0, 1000),
		onBucketFinal:  onBucketFinal,
	}
}

// AlignToBucketStart calculates UTC minute boundary: floor(t / 60) * 60
func AlignToBucketStart(t time.Time) time.Time {
	return t.Truncate(time.Minute)
}

// ProcessSnapshot updates 1-minute heatmap aggregates from incoming liquidity snapshot
func (he *HeatmapEngine) ProcessSnapshot(snap *models.LiquiditySnapshot) {
	he.mu.Lock()
	defer he.mu.Unlock()

	now := snap.Timestamp
	if now.IsZero() {
		now = time.Now().UTC()
	}
	bucketStart := AlignToBucketStart(now)

	// Check if minute rolled over
	if he.currentBucket.IsZero() {
		he.currentBucket = bucketStart
	} else if bucketStart.After(he.currentBucket) {
		// Finalize current minute buckets
		he.finalizeMinute(bucketStart)
	}

	// Update active buckets for each price bin
	for _, b := range snap.Bins {
		bucket, exists := he.activeBuckets[b.BinPrice]
		if !exists {
			bucket = &models.HeatmapBucket{
				Symbol:      he.symbol,
				BucketStart: he.currentBucket,
				PriceBin:    b.BinPrice,
				BidOpen:     b.BidNotional,
				BidHigh:     b.BidNotional,
				BidLow:      b.BidNotional,
				BidClose:    b.BidNotional,
				AskOpen:     b.AskNotional,
				AskHigh:     b.AskNotional,
				AskLow:      b.AskNotional,
				AskClose:    b.AskNotional,
				BidMax:      b.BidNotional,
				AskMax:      b.AskNotional,
			}
			he.activeBuckets[b.BinPrice] = bucket
		}

		// Update Bid OHLC
		if b.BidNotional > bucket.BidHigh {
			bucket.BidHigh = b.BidNotional
		}
		if b.BidNotional < bucket.BidLow {
			bucket.BidLow = b.BidNotional
		}
		bucket.BidClose = b.BidNotional
		if b.BidNotional > bucket.BidMax {
			bucket.BidMax = b.BidNotional
		}

		// Update Ask OHLC
		if b.AskNotional > bucket.AskHigh {
			bucket.AskHigh = b.AskNotional
		}
		if b.AskNotional < bucket.AskLow {
			bucket.AskLow = b.AskNotional
		}
		bucket.AskClose = b.AskNotional
		if b.AskNotional > bucket.AskMax {
			bucket.AskMax = b.AskNotional
		}

		// Time-Weighted Average Calculation: TWAP = sum(L * dt) / sum(dt)
		obs, hasObs := he.lastObs[b.BinPrice]
		if !hasObs {
			he.lastObs[b.BinPrice] = &binObservation{
				lastBid:  b.BidNotional,
				lastAsk:  b.AskNotional,
				lastSeen: now,
			}
		} else {
			dtMs := now.Sub(obs.lastSeen).Milliseconds()
			if dtMs > 0 && dtMs < 60000 {
				obs.bidWeighted += obs.lastBid * float64(dtMs)
				obs.askWeighted += obs.lastAsk * float64(dtMs)
				obs.totalTimeMs += dtMs
				bucket.CoverageMs = obs.totalTimeMs

				if obs.totalTimeMs > 0 {
					bucket.BidTimeWeighted = obs.bidWeighted / float64(obs.totalTimeMs)
					bucket.AskTimeWeighted = obs.askWeighted / float64(obs.totalTimeMs)
				}
			}

			// Additions & Removals tracking
			if b.BidNotional > obs.lastBid {
				bucket.BidAdded += (b.BidNotional - obs.lastBid)
			} else if b.BidNotional < obs.lastBid {
				bucket.BidRemoved += (obs.lastBid - b.BidNotional)
			}

			if b.AskNotional > obs.lastAsk {
				bucket.AskAdded += (b.AskNotional - obs.lastAsk)
			} else if b.AskNotional < obs.lastAsk {
				bucket.AskRemoved += (obs.lastAsk - b.AskNotional)
			}

			obs.lastBid = b.BidNotional
			obs.lastAsk = b.AskNotional
			obs.lastSeen = now
		}
	}
}

func (he *HeatmapEngine) finalizeMinute(nextBucket time.Time) {
	finalizedList := make([]models.HeatmapBucket, 0, len(he.activeBuckets))
	for _, bucket := range he.activeBuckets {
		bucket.IsComplete = true
		finalizedList = append(finalizedList, *bucket)
		he.history = append(he.history, *bucket)
	}

	// Cap memory history to 2000 items
	if len(he.history) > 2000 {
		he.history = he.history[len(he.history)-2000:]
	}

	if he.onBucketFinal != nil && len(finalizedList) > 0 {
		go he.onBucketFinal(finalizedList)
	}

	// Reset for next minute
	he.currentBucket = nextBucket
	he.activeBuckets = make(map[float64]*models.HeatmapBucket)
	he.lastObs = make(map[float64]*binObservation)
}

// GetActiveSnapshot returns live, in-progress 1-minute heatmap state
func (he *HeatmapEngine) GetActiveSnapshot() []models.HeatmapBucket {
	he.mu.RLock()
	defer he.mu.RUnlock()

	result := make([]models.HeatmapBucket, 0, len(he.activeBuckets))
	for _, b := range he.activeBuckets {
		result = append(result, *b)
	}
	return result
}

// GetHistory returns historical finalized buckets
func (he *HeatmapEngine) GetHistory(limit int) []models.HeatmapBucket {
	he.mu.RLock()
	defer he.mu.RUnlock()

	if limit <= 0 || limit > len(he.history) {
		limit = len(he.history)
	}
	start := len(he.history) - limit
	result := make([]models.HeatmapBucket, limit)
	copy(result, he.history[start:])
	return result
}
