package exchange

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
)

type DeltaWSMessage struct {
	Type              string          `json:"type"`
	Symbol            string          `json:"symbol"`
	ProductID         int64           `json:"product_id"`
	LastSequenceNo    int64           `json:"last_sequence_no"`
	TimestampMicro    int64           `json:"timestamp"`
	LastUpdatedAt     int64           `json:"last_updated_at"`
	Spread            any             `json:"spread"`
	PercentageSpread  any             `json:"percentage_spread"`
	Buy               []DeltaBookItem `json:"buy"`
	Sell              []DeltaBookItem `json:"sell"`
	Trades            []DeltaTradeItem `json:"trades"`
}

type DeltaBookItem struct {
	LimitPrice string  `json:"limit_price"`
	Size       float64 `json:"size"`
	Depth      string  `json:"depth"`
}

type DeltaTradeItem struct {
	Price          float64 `json:"price"`
	Size           float64 `json:"size"`
	TimestampMicro int64   `json:"timestamp"`
	BuyerRole      string  `json:"buyer_role"`
	SellerRole     string  `json:"seller_role"`
}

type MessageDecoder struct {
	metadata *models.InstrumentMetadata
}

func NewMessageDecoder(metadata *models.InstrumentMetadata) *MessageDecoder {
	return &MessageDecoder{metadata: metadata}
}

func (d *MessageDecoder) DecodeOrderbook(data []byte, receiveTime time.Time) (*models.OrderbookSnapshot, error) {
	var msg DeltaWSMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal orderbook message: %w", err)
	}

	exchTime := time.UnixMicro(msg.TimestampMicro).UTC()
	if msg.TimestampMicro == 0 {
		exchTime = receiveTime
	}

	bids := make([]models.OrderbookLevel, 0, len(msg.Buy))
	for _, b := range msg.Buy {
		p, err := strconv.ParseFloat(b.LimitPrice, 64)
		if err != nil || b.Size <= 0 {
			continue
		}
		notional := d.metadata.CalculateNotional(p, b.Size)
		bids = append(bids, models.OrderbookLevel{
			Price:    p,
			Quantity: b.Size,
			Notional: notional,
		})
	}

	asks := make([]models.OrderbookLevel, 0, len(msg.Sell))
	for _, a := range msg.Sell {
		p, err := strconv.ParseFloat(a.LimitPrice, 64)
		if err != nil || a.Size <= 0 {
			continue
		}
		notional := d.metadata.CalculateNotional(p, a.Size)
		asks = append(asks, models.OrderbookLevel{
			Price:    p,
			Quantity: a.Size,
			Notional: notional,
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

	snap := &models.OrderbookSnapshot{
		Symbol:       msg.Symbol,
		Bids:         bids,
		Asks:         asks,
		BestBid:      bestBid,
		BestAsk:      bestAsk,
		Spread:       spread,
		SpreadBps:    spreadBps,
		Sequence:     msg.LastSequenceNo,
		ExchangeTime: exchTime,
		ReceivedTime: receiveTime,
		IsSynced:     true,
		Health:       models.StatusLive,
	}

	return snap, nil
}

func (d *MessageDecoder) DecodeTrades(data []byte, receiveTime time.Time) ([]models.Trade, error) {
	var msg DeltaWSMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal trades message: %w", err)
	}

	result := make([]models.Trade, 0, len(msg.Trades))
	for _, t := range msg.Trades {
		side := "neutral"
		if t.BuyerRole == "taker" {
			side = "buy"
		} else if t.SellerRole == "taker" {
			side = "sell"
		}

		exchTime := time.UnixMicro(t.TimestampMicro).UTC()
		if t.TimestampMicro == 0 {
			exchTime = receiveTime
		}

		notional := d.metadata.CalculateNotional(t.Price, t.Size)
		tradeID := fmt.Sprintf("%d-%f-%f", t.TimestampMicro, t.Price, t.Size)

		result = append(result, models.Trade{
			TradeID:      tradeID,
			Symbol:       msg.Symbol,
			Price:        t.Price,
			Quantity:     t.Size,
			Notional:     notional,
			Side:         side,
			ExchangeTime: exchTime,
			ReceivedTime: receiveTime,
		})
	}

	return result, nil
}
