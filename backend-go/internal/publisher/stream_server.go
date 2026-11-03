package publisher

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/events"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/heatmap"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/liquidity"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/market"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/volatility"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow development and terminal origins
	},
}

type WSEnvelope struct {
	Type      string      `json:"type"`
	Symbol    string      `json:"symbol"`
	Timestamp time.Time   `json:"timestamp"`
	Data      any         `json:"data"`
	Status    models.HealthStatus `json:"status"`
}

type StreamServer struct {
	port       string
	orderbook  *market.LocalOrderbook
	binner     *liquidity.PriceBinner
	heatmap    *heatmap.HeatmapEngine
	volatility *volatility.VolatilityEngine
	detector   *events.EventDetector

	mu      sync.Mutex
	clients map[*websocket.Conn]*sync.Mutex
}

func NewStreamServer(
	port string,
	orderbook *market.LocalOrderbook,
	binner *liquidity.PriceBinner,
	heatmap *heatmap.HeatmapEngine,
	volatility *volatility.VolatilityEngine,
	detector *events.EventDetector,
) *StreamServer {
	return &StreamServer{
		port:       port,
		orderbook:  orderbook,
		binner:     binner,
		heatmap:    heatmap,
		volatility: volatility,
		detector:   detector,
		clients:    make(map[*websocket.Conn]*sync.Mutex),
	}
}

func (s *StreamServer) Start() error {
	mux := http.NewServeMux()

	// WebSocket feed
	mux.HandleFunc("/ws", s.handleWebSocket)

	// REST APIs
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/api/orderbook", s.handleOrderbook)
	mux.HandleFunc("/api/liquidity", s.handleLiquidity)
	mux.HandleFunc("/api/heatmap", s.handleHeatmap)
	mux.HandleFunc("/api/candles", s.handleCandles)
	mux.HandleFunc("/api/events", s.handleEvents)

	// Add CORS headers
	handler := corsMiddleware(mux)

	log.Printf("[HTTP/WS] Server listening on port :%s", s.port)
	return http.ListenAndServe(":"+s.port, handler)
}

func (s *StreamServer) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS-Server] Upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	connMu := &sync.Mutex{}

	// Send initial snapshot on connect (protected by connMu)
	snap := s.orderbook.GetSnapshot()
	liq := s.binner.Aggregate(snap)
	snapEnv := WSEnvelope{
		Type:      "market.snapshot",
		Symbol:    snap.Symbol,
		Timestamp: time.Now().UTC(),
		Data: map[string]any{
			"orderbook":       snap,
			"liquidity":       liq,
			"heatmap":         s.heatmap.GetActiveSnapshot(),
			"heatmap_history": s.heatmap.GetHistory(15000),
			"candles":         s.volatility.GetRecentCandles(500),
			"events":          s.detector.GetRecentEvents(20),
		},
		Status: snap.Health,
	}

	snapData, err := json.Marshal(snapEnv)
	if err == nil {
		connMu.Lock()
		conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		_ = conn.WriteMessage(websocket.TextMessage, snapData)
		connMu.Unlock()
	}

	s.mu.Lock()
	s.clients[conn] = connMu
	s.mu.Unlock()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}

	s.mu.Lock()
	delete(s.clients, conn)
	s.mu.Unlock()
}

func (s *StreamServer) Broadcast(env WSEnvelope) {
	data, err := json.Marshal(env)
	if err != nil {
		return
	}

	s.mu.Lock()
	type target struct {
		conn *websocket.Conn
		mu   *sync.Mutex
	}
	targets := make([]target, 0, len(s.clients))
	for c, mu := range s.clients {
		targets = append(targets, target{conn: c, mu: mu})
	}
	s.mu.Unlock()

	for _, t := range targets {
		t.mu.Lock()
		t.conn.SetWriteDeadline(time.Now().Add(3 * time.Second))
		writeErr := t.conn.WriteMessage(websocket.TextMessage, data)
		t.mu.Unlock()

		if writeErr != nil {
			_ = t.conn.Close()
			s.mu.Lock()
			delete(s.clients, t.conn)
			s.mu.Unlock()
		}
	}
}

func (s *StreamServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	snap := s.orderbook.GetSnapshot()
	writeJSON(w, map[string]any{
		"status":     snap.Health,
		"symbol":     snap.Symbol,
		"is_synced":  snap.IsSynced,
		"last_seq":   snap.Sequence,
		"spread_bps": snap.SpreadBps,
		"timestamp":  time.Now().UTC(),
	})
}

func (s *StreamServer) handleOrderbook(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, s.orderbook.GetSnapshot())
}

func (s *StreamServer) handleLiquidity(w http.ResponseWriter, r *http.Request) {
	snap := s.orderbook.GetSnapshot()
	writeJSON(w, s.binner.Aggregate(snap))
}

func (s *StreamServer) handleHeatmap(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{
		"active":    s.heatmap.GetActiveSnapshot(),
		"history":   s.heatmap.GetHistory(15000),
		"timestamp": time.Now().UTC(),
	})
}

func (s *StreamServer) handleCandles(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, s.volatility.GetRecentCandles(500))
}

func (s *StreamServer) handleEvents(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, s.detector.GetRecentEvents(50))
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
