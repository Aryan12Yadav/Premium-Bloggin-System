package exchange

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
	"github.com/gorilla/websocket"
)

type WSClient struct {
	url           string
	symbol        string
	decoder       *MessageDecoder
	orderbookChan chan<- *models.OrderbookSnapshot
	tradesChan    chan<- []models.Trade
	healthChan    chan<- models.HealthStatus

	conn      *websocket.Conn
	mu        sync.Mutex
	ctx       context.Context
	cancel    context.CancelFunc
	isRunning bool
}

func NewWSClient(
	url, symbol string,
	decoder *MessageDecoder,
	orderbookChan chan<- *models.OrderbookSnapshot,
	tradesChan chan<- []models.Trade,
	healthChan chan<- models.HealthStatus,
) *WSClient {
	ctx, cancel := context.WithCancel(context.Background())
	return &WSClient{
		url:           url,
		symbol:        symbol,
		decoder:       decoder,
		orderbookChan: orderbookChan,
		tradesChan:    tradesChan,
		healthChan:    healthChan,
		ctx:           ctx,
		cancel:        cancel,
	}
}

func (c *WSClient) Start() {
	c.mu.Lock()
	if c.isRunning {
		c.mu.Unlock()
		return
	}
	c.isRunning = true
	c.mu.Unlock()

	go c.connectionLoop()
}

func (c *WSClient) Stop() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cancel()
	c.isRunning = false
	if c.conn != nil {
		_ = c.conn.Close()
	}
	c.notifyHealth(models.StatusDisconnected)
}

func (c *WSClient) notifyHealth(status models.HealthStatus) {
	select {
	case c.healthChan <- status:
	default:
	}
}

func (c *WSClient) connectionLoop() {
	backoff := 1 * time.Second
	maxBackoff := 30 * time.Second

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
		}

		c.notifyHealth(models.StatusConnecting)
		log.Printf("[WS] Connecting to %s for %s...", c.url, c.symbol)

		conn, _, err := websocket.DefaultDialer.DialContext(c.ctx, c.url, http.Header{})
		if err != nil {
			log.Printf("[WS] Connection failed: %v. Retrying in %v...", err, backoff)
			c.notifyHealth(models.StatusError)
			time.Sleep(backoff + time.Duration(rand.Intn(500))*time.Millisecond)
			backoff = minDuration(backoff*2, maxBackoff)
			continue
		}

		c.mu.Lock()
		c.conn = conn
		c.mu.Unlock()

		backoff = 1 * time.Second // Reset backoff on successful connect
		log.Printf("[WS] Connected! Subscribing to channels for %s...", c.symbol)

		if err := c.subscribe(); err != nil {
			log.Printf("[WS] Subscription failed: %v. Reconnecting...", err)
			_ = conn.Close()
			continue
		}

		// Read loop
		c.readLoop(conn)

		c.notifyHealth(models.StatusDisconnected)
		log.Printf("[WS] Disconnected from exchange feed. Reconnecting...")
		time.Sleep(1 * time.Second)
	}
}

func (c *WSClient) subscribe() error {
	subMsg := map[string]any{
		"type": "subscribe",
		"payload": map[string]any{
			"channels": []map[string]any{
				{"name": "l2_orderbook", "symbols": []string{c.symbol}},
				{"name": "all_trades", "symbols": []string{c.symbol}},
			},
		},
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn == nil {
		return fmt.Errorf("connection is nil")
	}
	return c.conn.WriteJSON(subMsg)
}

func (c *WSClient) readLoop(conn *websocket.Conn) {
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		select {
		case <-c.ctx.Done():
			return
		default:
		}

		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[WS] Read error: %v", err)
			return
		}
		receiveTime := time.Now().UTC()
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))

		var peek struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(msg, &peek); err != nil {
			continue
		}

		switch peek.Type {
		case "l2_orderbook":
			snap, err := c.decoder.DecodeOrderbook(msg, receiveTime)
			if err == nil && snap != nil {
				c.notifyHealth(models.StatusLive)
				select {
				case c.orderbookChan <- snap:
				default:
					// Drop oldest if bounded channel full
				}
			}
		case "all_trades", "all_trades_snapshot":
			trades, err := c.decoder.DecodeTrades(msg, receiveTime)
			if err == nil && len(trades) > 0 {
				select {
				case c.tradesChan <- trades:
				default:
				}
			}
		case "subscriptions":
			log.Printf("[WS] Channels confirmed active: %s", string(msg))
		case "ping":
			_ = conn.WriteJSON(map[string]string{"type": "pong"})
		}
	}
}

func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}
