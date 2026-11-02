package tests

import (
	"math"
	"testing"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/heatmap"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/liquidity"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/volatility"
)

func TestPriceBinning(t *testing.T) {
	binner := liquidity.NewPriceBinner(50.0)

	tests := []struct {
		price    float64
		expected float64
	}{
		{105000.0, 105000.0},
		{105025.0, 105000.0},
		{105049.9, 105000.0},
		{105050.0, 105050.0},
		{104999.0, 104950.0},
	}

	for _, tc := range tests {
		actual := binner.GetBinPrice(tc.price)
		if actual != tc.expected {
			t.Errorf("For price %.1f expected bin %.1f, got %.1f", tc.price, tc.expected, actual)
		}
	}
}

func TestOrderbookImbalance(t *testing.T) {
	binner := liquidity.NewPriceBinner(50.0)
	meta := &models.InstrumentMetadata{
		Symbol:        "BTCUSDT",
		ContractValue: 0.001,
	}

	// 1. Equal bids and asks -> Imbalance = 0
	snapBalanced := &models.OrderbookSnapshot{
		Symbol: "BTCUSDT",
		Bids: []models.OrderbookLevel{
			{Price: 100000.0, Quantity: 1000.0, Notional: meta.CalculateNotional(100000.0, 1000.0)},
		},
		Asks: []models.OrderbookLevel{
			{Price: 100050.0, Quantity: 1000.0, Notional: meta.CalculateNotional(100050.0, 1000.0)},
		},
	}
	resBalanced := binner.Aggregate(snapBalanced)
	if math.Abs(resBalanced.Imbalance) > 0.01 {
		t.Errorf("Expected balanced imbalance near 0.0, got %f", resBalanced.Imbalance)
	}

	// 2. Strong bid side -> Imbalance > 0
	snapBidsHeavy := &models.OrderbookSnapshot{
		Symbol: "BTCUSDT",
		Bids: []models.OrderbookLevel{
			{Price: 100000.0, Quantity: 3000.0, Notional: meta.CalculateNotional(100000.0, 3000.0)},
		},
		Asks: []models.OrderbookLevel{
			{Price: 100050.0, Quantity: 1000.0, Notional: meta.CalculateNotional(100050.0, 1000.0)},
		},
	}
	resBidsHeavy := binner.Aggregate(snapBidsHeavy)
	// (300 - 100) / (300 + 100) approx 0.5
	if resBidsHeavy.Imbalance <= 0.4 || resBidsHeavy.Imbalance >= 0.6 {
		t.Errorf("Expected imbalance near 0.5, got %f", resBidsHeavy.Imbalance)
	}

	// 3. Zero denominator safety test
	snapEmpty := &models.OrderbookSnapshot{Symbol: "BTCUSDT"}
	resEmpty := binner.Aggregate(snapEmpty)
	if math.IsNaN(resEmpty.Imbalance) || math.IsInf(resEmpty.Imbalance, 0) {
		t.Errorf("Imbalance should not be NaN or Inf when book is empty, got %f", resEmpty.Imbalance)
	}
}

func TestHeatmapTWAP(t *testing.T) {
	baseTime := time.Date(2026, 11, 2, 10, 0, 0, 0, time.UTC)
	he := heatmap.NewHeatmapEngine("BTCUSDT", 50.0, nil)

	// Observation 1 at t=0s: Bid = 100,000
	snap1 := &models.LiquiditySnapshot{
		Symbol:    "BTCUSDT",
		Timestamp: baseTime,
		Bins: []models.PriceBinLiquidity{
			{BinPrice: 100000.0, BidNotional: 100000.0},
		},
	}
	he.ProcessSnapshot(snap1)

	// Observation 2 at t=30s: Bid = 200,000
	snap2 := &models.LiquiditySnapshot{
		Symbol:    "BTCUSDT",
		Timestamp: baseTime.Add(30 * time.Second),
		Bins: []models.PriceBinLiquidity{
			{BinPrice: 100000.0, BidNotional: 200000.0},
		},
	}
	he.ProcessSnapshot(snap2)

	// Observation 3 at t=50s (same minute):
	snap3 := &models.LiquiditySnapshot{
		Symbol:    "BTCUSDT",
		Timestamp: baseTime.Add(50 * time.Second),
		Bins: []models.PriceBinLiquidity{
			{BinPrice: 100000.0, BidNotional: 200000.0},
		},
	}
	he.ProcessSnapshot(snap3)

	active := he.GetActiveSnapshot()
	if len(active) == 0 {
		t.Fatalf("Expected active heatmap bucket, got 0")
	}

	// During the minute: 30s at 100k, 20s at 200k.
	// Expected TWAP = (100k*30 + 200k*20) / 50 = (3000k + 4000k)/50 = 140k
	twap := active[0].BidTimeWeighted
	if twap < 135000.0 || twap > 145000.0 {
		t.Errorf("Expected intra-minute active TWAP near 140000, got %f", twap)
	}

	// Observation 4 at t=60s (minute rollover into 10:01:00)
	snap4 := &models.LiquiditySnapshot{
		Symbol:    "BTCUSDT",
		Timestamp: baseTime.Add(60 * time.Second),
		Bins: []models.PriceBinLiquidity{
			{BinPrice: 100000.0, BidNotional: 200000.0},
		},
	}
	he.ProcessSnapshot(snap4)

	hist := he.GetHistory(1)
	if len(hist) == 0 {
		t.Fatalf("Expected finalized historical bucket after minute rollover, got 0")
	}
	if !hist[0].IsComplete {
		t.Errorf("Expected finalized bucket to have IsComplete=true")
	}
}

func TestVolatilityEngine(t *testing.T) {
	ve := volatility.NewVolatilityEngine("BTCUSDT", 10, 14)
	baseTime := time.Date(2026, 11, 2, 10, 0, 0, 0, time.UTC)

	// Minute 1: Price 100,000
	ve.ProcessTrade(&models.Trade{
		Price:        100000.0,
		Quantity:     1.0,
		Notional:     100.0,
		ExchangeTime: baseTime,
	})

	// Minute 2: Price 101,000 -> Log return = ln(101000/100000) approx 0.00995
	m2 := ve.ProcessTrade(&models.Trade{
		Price:        101000.0,
		Quantity:     1.0,
		Notional:     101.0,
		ExchangeTime: baseTime.Add(65 * time.Second),
	})

	if m2 == nil {
		t.Fatalf("Metrics should not be nil")
	}
	expectedReturn := math.Log(101000.0 / 100000.0)
	if math.Abs(m2.LogReturn-expectedReturn) > 0.0001 {
		t.Errorf("Expected LogReturn %.5f, got %.5f", expectedReturn, m2.LogReturn)
	}
}
