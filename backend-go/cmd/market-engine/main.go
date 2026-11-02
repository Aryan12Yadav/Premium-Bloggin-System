package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/config"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/events"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/exchange"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/heatmap"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/liquidity"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/market"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/models"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/publisher"
	"github.com/Aryan12Yadav/btcusd-liquidity-engine/internal/volatility"
)

func main() {
	log.Println("================================================================")
	log.Println("   BTCUSD LIQUIDITY INTELLIGENCE & AI RESEARCH ENGINE (GO)")
	log.Println("================================================================")

	cfg := config.LoadConfig()
	log.Printf("[Config] Symbol: %s, BinWidth: $%.1f, Port: %s", cfg.Symbol, cfg.HeatmapBinWidth, cfg.ServerPort)

	// 1. Fetch live instrument metadata from Delta Exchange REST
	restClient := exchange.NewDeltaRestClient(cfg.ExchangeRESTURL)
	metadata, err := restClient.FetchProductMetadata(cfg.Symbol)
	if err != nil {
		log.Printf("[WARN] Failed to load metadata from Delta REST: %v. Using robust defaults.", err)
		metadata = &models.InstrumentMetadata{
			Symbol:            cfg.Symbol,
			ProductID:         139,
			ContractType:      "perpetual_futures",
			ContractValue:     0.001,
			TickSize:          0.5,
			ContractUnit:      "BTC",
			QuotingAsset:      "USDT",
			SettlingAsset:     "USDT",
			PricePrecision:    1,
			QuantityPrecision: 3,
			State:             "live",
		}
	}
	log.Printf("[Metadata] %s: TickSize=$%.1f, ContractValue=%.4f %s, Settlement=%s",
		metadata.Symbol, metadata.TickSize, metadata.ContractValue, metadata.ContractUnit, metadata.SettlingAsset)

	// 2. Instantiate core components
	localBook := market.NewLocalOrderbook(cfg.Symbol, metadata, cfg.OrderbookStaleThreshold)
	binner := liquidity.NewPriceBinner(cfg.HeatmapBinWidth)
	volEngine := volatility.NewVolatilityEngine(cfg.Symbol, cfg.VolatilityWindow1m, cfg.ATRPeriod)

	var streamServer *publisher.StreamServer

	eventDetector := events.NewEventDetector(
		cfg.Symbol,
		cfg.SweepMinLevels,
		cfg.SweepMinNotional,
		cfg.AbsorptionRatioThreshold,
		cfg.WithdrawalThreshold,
		func(event *models.MarketEvent) {
			log.Printf("[EVENT] %s %s at $%.1f: %v", event.EventType, event.Direction, event.PriceLevel, event.Evidence)
			if streamServer != nil {
				streamServer.Broadcast(publisher.WSEnvelope{
					Type:      "market.event.created",
					Symbol:    cfg.Symbol,
					Timestamp: time.Now().UTC(),
					Data:      event,
					Status:    models.StatusLive,
				})
			}
		},
	)

	heatmapEng := heatmap.NewHeatmapEngine(cfg.Symbol, cfg.HeatmapBinWidth, func(finalized []models.HeatmapBucket) {
		log.Printf("[HEATMAP] Finalized 1-minute bucket with %d price bins", len(finalized))
		if streamServer != nil {
			streamServer.Broadcast(publisher.WSEnvelope{
				Type:      "market.heatmap.finalized",
				Symbol:    cfg.Symbol,
				Timestamp: time.Now().UTC(),
				Data:      finalized,
				Status:    models.StatusLive,
			})
		}
	})

	streamServer = publisher.NewStreamServer(cfg.ServerPort, localBook, binner, heatmapEng, volEngine, eventDetector)

	// 3. Channels for high-throughput pipeline
	orderbookChan := make(chan *models.OrderbookSnapshot, 100)
	tradesChan := make(chan []models.Trade, 500)
	healthChan := make(chan models.HealthStatus, 10)

	decoder := exchange.NewMessageDecoder(metadata)
	wsClient := exchange.NewWSClient(cfg.ExchangeWSURL, cfg.Symbol, decoder, orderbookChan, tradesChan, healthChan)

	// 4. Start WebSocket listener & HTTP/WS server
	wsClient.Start()
	go func() {
		if err := streamServer.Start(); err != nil {
			log.Fatalf("[HTTP] Server terminated: %v", err)
		}
	}()

	// 5. Ingestion & mathematical calculation pipeline
	go func() {
		lastBroadcast := time.Now()
		for {
			select {
			case snap := <-orderbookChan:
				localBook.UpdateFromSnapshot(snap)

				// Calculate binned liquidity & intensity
				liqSnap := binner.Aggregate(snap)

				// Process 1-minute heatmap TWAP & OHLC
				heatmapEng.ProcessSnapshot(liqSnap)

				// Check liquidity withdrawal
				eventDetector.ProcessLiquiditySnapshot(liqSnap)

				// Throttle broadcast to max 10 updates/sec for smooth frontend rendering
				if time.Since(lastBroadcast) >= 100*time.Millisecond {
					streamServer.Broadcast(publisher.WSEnvelope{
						Type:      "market.liquidity.update",
						Symbol:    cfg.Symbol,
						Timestamp: snap.ExchangeTime,
						Data: map[string]any{
							"orderbook": snap,
							"liquidity": liqSnap,
							"active_heatmap": heatmapEng.GetActiveSnapshot(),
						},
						Status: snap.Health,
					})
					lastBroadcast = time.Now()
				}

			case trades := <-tradesChan:
				for _, t := range trades {
					// Update candle & volatility
					volMetrics := volEngine.ProcessTrade(&t)

					// Evaluate sweep & absorption
					eventDetector.ProcessTrade(&t)

					streamServer.Broadcast(publisher.WSEnvelope{
						Type:      "market.trade.update",
						Symbol:    cfg.Symbol,
						Timestamp: t.ExchangeTime,
						Data: map[string]any{
							"trade":      t,
							"volatility": volMetrics,
						},
						Status: models.StatusLive,
					})
				}

			case health := <-healthChan:
				localBook.SetHealth(health)
				streamServer.Broadcast(publisher.WSEnvelope{
					Type:      "market.health.update",
					Symbol:    cfg.Symbol,
					Timestamp: time.Now().UTC(),
					Data:      map[string]any{"health": health},
					Status:    health,
				})
			}
		}
	}()

	// 6. Handle OS signals for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	<-sigChan

	log.Println("[SHUTDOWN] Stopping Market Engine gracefully...")
	wsClient.Stop()
	time.Sleep(500 * time.Millisecond)
	log.Println("[SHUTDOWN] Market Engine shutdown complete.")
}
