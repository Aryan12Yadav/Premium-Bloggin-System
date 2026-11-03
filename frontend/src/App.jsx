import React, { useState, useEffect, useRef } from 'react';
import LiquidityHeatmapChart from './features/terminal/LiquidityHeatmapChart';
import { LiveCandleStream } from './services/liveCandleStream';

export default function App() {
  const [marketData, setMarketData] = useState({
    symbol: 'BTCUSDT',
    orderbook: null,
    liquidity: null,
    heatmap: [],
    heatmapHistory: [],
    candles: [],
    events: [],
    volatility: null,
    livePrice: null,
    status: 'CONNECTING',
  });

  const [timeframe, setTimeframe] = useState('1m');
  const [currentTime, setCurrentTime] = useState(new Date().toUTCString());

  // Price Flash state
  const [priceFlash, setPriceFlash] = useState(null);
  const prevPriceRef = useRef(null);
  const wsRef = useRef(null);

  // Real-Time Live Candlestick Ingestion (Public API + 0ms WebSocket Ticks)
  useEffect(() => {
    const stream = new LiveCandleStream({
      symbol: 'BTCUSDT',
      interval: timeframe,
      onSnapshot: (candles) => {
        setMarketData(prev => ({
          ...prev,
          candles,
          livePrice: candles.length > 0 ? candles[candles.length - 1].close : prev.livePrice,
        }));
      },
      onCandleUpdate: (liveCandle) => {
        setMarketData(prev => {
          const candles = [...prev.candles];
          const lastIdx = candles.length - 1;
          if (lastIdx >= 0) {
            const lastCandle = candles[lastIdx];
            if (lastCandle.start_time === liveCandle.start_time) {
              candles[lastIdx] = liveCandle;
            } else if (new Date(liveCandle.start_time).getTime() > new Date(lastCandle.start_time).getTime()) {
              candles.push(liveCandle);
              if (candles.length > 500) candles.shift();
            }
          } else {
            candles.push(liveCandle);
          }
          return {
            ...prev,
            candles,
            livePrice: liveCandle.close,
          };
        });
      },
    });

    stream.start();
    return () => stream.destroy();
  }, [timeframe]);

  // Time ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Price Flash animation trigger
  const bestBid = marketData.orderbook?.best_bid || 78500;
  useEffect(() => {
    if (prevPriceRef.current !== null && bestBid !== prevPriceRef.current) {
      setPriceFlash(bestBid > prevPriceRef.current ? 'price-flash-up' : 'price-flash-down');
      const timer = setTimeout(() => setPriceFlash(null), 800);
      prevPriceRef.current = bestBid;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = bestBid;
  }, [bestBid]);

  // WebSocket Live Connection to Go Market Engine
  useEffect(() => {
    let reconnectTimeout = null;

    const connectWS = () => {
      const wsUrl = 'ws://localhost:8080/ws';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setMarketData(prev => ({ ...prev, status: 'LIVE' }));
      };

      ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);

          if (envelope.type === 'market.snapshot') {
            const d = envelope.data || {};
            setMarketData(prev => ({
              ...prev,
              orderbook: d.orderbook || prev.orderbook,
              liquidity: d.liquidity || prev.liquidity,
              heatmap: d.heatmap || prev.heatmap,
              heatmapHistory: d.heatmap_history || prev.heatmapHistory,
              candles: d.candles || prev.candles,
              events: d.events || prev.events,
              status: envelope.status || 'LIVE',
            }));
          } else if (envelope.type === 'market.liquidity.update') {
            const d = envelope.data || {};
            setMarketData(prev => {
              let updatedCandles = prev.candles;
              if (d.active_candle) {
                const ac = d.active_candle;
                updatedCandles = [...prev.candles];
                const lastIdx = updatedCandles.length - 1;
                if (lastIdx >= 0 && updatedCandles[lastIdx].start_time === ac.start_time) {
                  updatedCandles[lastIdx] = ac;
                } else if (lastIdx >= 0 && new Date(ac.start_time).getTime() > new Date(updatedCandles[lastIdx].start_time).getTime()) {
                  updatedCandles.push(ac);
                } else if (lastIdx < 0) {
                  updatedCandles = [ac];
                }
              } else if (d.candles && Array.isArray(d.candles) && d.candles.length > 0) {
                updatedCandles = d.candles;
              }
              return {
                ...prev,
                orderbook: d.orderbook || prev.orderbook,
                liquidity: d.liquidity || prev.liquidity,
                heatmap: d.active_heatmap || prev.heatmap,
                candles: updatedCandles.slice(-150),
                status: envelope.status || 'LIVE',
              };
            });
          } else if (envelope.type === 'market.heatmap.finalized') {
            const finalized = Array.isArray(envelope.data) ? envelope.data : [];
            setMarketData(prev => ({
              ...prev,
              heatmapHistory: [...prev.heatmapHistory, ...finalized].slice(-2500),
            }));
          } else if (envelope.type === 'market.trade.update') {
            const d = envelope.data || {};
            setMarketData(prev => {
              const updatedCandles = [...prev.candles];
              if (d.active_candle) {
                const ac = d.active_candle;
                const lastIdx = updatedCandles.length - 1;
                if (lastIdx >= 0 && updatedCandles[lastIdx].start_time === ac.start_time) {
                  updatedCandles[lastIdx] = ac;
                } else if (lastIdx >= 0 && new Date(ac.start_time).getTime() > new Date(updatedCandles[lastIdx].start_time).getTime()) {
                  updatedCandles.push(ac);
                } else if (lastIdx < 0) {
                  updatedCandles.push(ac);
                }
              }
              return {
                ...prev,
                candles: updatedCandles.slice(-150),
                volatility: d.volatility || prev.volatility,
              };
            });
          } else if (envelope.type === 'market.event.created') {
            const evt = envelope.data;
            if (evt) {
              setMarketData(prev => ({
                ...prev,
                events: [evt, ...prev.events].slice(0, 30),
              }));
            }
          } else if (envelope.type === 'market.health.update') {
            const h = envelope.data?.health || 'CONNECTING';
            setMarketData(prev => ({ ...prev, status: h }));
          }
        } catch (e) {
          console.error('Error parsing WS message', e);
        }
      };

      ws.onerror = () => {
        setMarketData(prev => ({ ...prev, status: 'ERROR' }));
      };

      ws.onclose = () => {
        setMarketData(prev => ({ ...prev, status: 'DISCONNECTED' }));
        reconnectTimeout = setTimeout(connectWS, 2000);
      };
    };

    connectWS();

    // Initial fallback REST fetches for instant hydration
    fetch('http://localhost:8080/api/candles')
      .then(r => r.json())
      .then(candles => {
        if (candles && Array.isArray(candles)) {
          setMarketData(prev => ({ ...prev, candles }));
        }
      })
      .catch(() => {});

    fetch('http://localhost:8080/api/heatmap')
      .then(r => r.json())
      .then(d => {
        if (d) {
          setMarketData(prev => ({
            ...prev,
            heatmap: d.active || prev.heatmap,
            heatmapHistory: d.history || prev.heatmapHistory,
          }));
        }
      })
      .catch(() => {});

    fetch('http://localhost:8080/api/liquidity')
      .then(r => r.json())
      .then(liq => {
        if (liq) setMarketData(prev => ({ ...prev, liquidity: liq }));
      })
      .catch(() => {});

    fetch('http://localhost:8080/api/orderbook')
      .then(r => r.json())
      .then(book => {
        if (book) setMarketData(prev => ({ ...prev, orderbook: book }));
      })
      .catch(() => {});

    fetch('http://localhost:8080/api/events')
      .then(r => r.json())
      .then(events => {
        if (events && Array.isArray(events)) setMarketData(prev => ({ ...prev, events }));
      })
      .catch(() => {});

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const currentPrice = marketData.livePrice || marketData.orderbook?.best_bid || (marketData.candles.length > 0 ? marketData.candles[marketData.candles.length - 1].close : 78500);
  const spread = marketData.orderbook?.spread || 0.5;
  const spreadBps = marketData.orderbook?.spread_bps || 0.06;
  const imbalance = marketData.liquidity?.imbalance || 0;
  const isLive = marketData.status === 'LIVE';

  return (
    <div className="h-screen w-screen bg-[#06090F] flex flex-col overflow-hidden select-none">
      {/* Sleek Top Navigation Ribbon */}
      <header className="bg-[#0A0E17] border-b border-[#141C2E] px-3 py-1.5 flex justify-between items-center z-20 flex-shrink-0">
        {/* Left: Product & Live Price */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse-fast"></span>
            <span className="font-bold text-sm tracking-wide text-white">BTCUSD</span>
            <span className="bg-[#101726] text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-amber-500/30">
              DELTA #27 PERP
            </span>
            <span className="text-gray-500 text-[10px] font-mono hidden sm:inline">
              / BTCUSDT #139
            </span>
          </div>

          <div className={`flex items-baseline space-x-1 font-mono px-2 py-0.5 rounded transition-all duration-300 ${priceFlash || ''}`}>
            <span className="text-white font-bold text-base glow-amber">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          </div>
        </div>

        {/* Center: Live Orderbook & Volatility HUD Ribbon */}
        <div className="hidden md:flex items-center space-x-3 text-[11px] font-mono bg-[#070B12] px-3 py-1 rounded border border-[#141C2E]">
          <div className="flex items-center space-x-1">
            <span className="text-gray-400">Spread:</span>
            <span className="text-white font-bold">${spread.toFixed(1)}</span>
            <span className="text-gray-500 text-[10px]">({spreadBps.toFixed(2)} bps)</span>
          </div>

          <span className="text-gray-700">•</span>

          <div className="flex items-center space-x-1">
            <span className="text-gray-400">Imbalance:</span>
            <span className={`font-bold ${imbalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {imbalance >= 0 ? `+${(imbalance * 100).toFixed(1)}%` : `${(imbalance * 100).toFixed(1)}%`}
            </span>
          </div>

          <span className="text-gray-700 hidden lg:inline">•</span>

          <div className="hidden lg:flex items-center space-x-1">
            <span className="text-gray-400">1m Vol:</span>
            <span className="text-amber-400 font-bold">
              {((marketData.volatility?.realized_volatility || 0.0142) * 100).toFixed(2)}%
            </span>
          </div>

          <span className="text-gray-700 hidden xl:inline">•</span>

          <div className="hidden xl:flex items-center space-x-1">
            <span className="text-gray-400">ATR:</span>
            <span className="text-cyan-400 font-bold">
              ${(marketData.volatility?.atr || 68.5).toFixed(1)}
            </span>
          </div>
        </div>

        {/* Right: Live Status & UTC Clock */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-[#070B12] px-2.5 py-1 rounded border border-[#141C2E] text-[10px] font-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLive ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
              }`}
            ></span>
            <span className={isLive ? 'text-emerald-400 font-bold' : 'text-red-400'}>
              {marketData.status}
            </span>
          </div>

          <span className="text-gray-500 font-mono text-[10px] hidden sm:inline bg-[#070B12] px-2 py-1 rounded border border-[#141C2E]">
            {currentTime.slice(17, 25)} UTC
          </span>
        </div>
      </header>

      {/* Main Terminal Dashboard: 100% Full Viewport Graph */}
      <main className="flex-1 p-2 flex flex-col overflow-hidden min-h-0">
        <div className="terminal-card flex-1 flex flex-col overflow-hidden min-h-0">
          <div className="terminal-header py-1 px-3">
            <div className="flex items-center space-x-2">
              <span className="text-gray-200 font-bold">BTCUSD Realtime Candlesticks & Liquidity Heatmap</span>
              <span className="text-emerald-400 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/20">
                1m / 5m Analysis
              </span>
              <span className="text-gray-500 text-[10px] font-mono">• Delta #27</span>
            </div>
            <div className="flex items-center space-x-3 text-[10px] text-gray-400 font-mono">
              <span className="flex items-center space-x-1">
                <span className="text-gray-500">Bin Width:</span>
                <span className="text-amber-400 font-semibold">$50 Bins</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span className="text-gray-500">History:</span>
                <span className="text-emerald-400 font-semibold">{marketData.candles.length} Candles Synced</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span className="text-gray-500">2D Matrix:</span>
                <span className="text-cyan-400 font-semibold">{marketData.heatmapHistory.length} Buckets</span>
              </span>
            </div>
          </div>
          <div className="p-1 flex-1 flex flex-col overflow-hidden min-h-0">
            <LiquidityHeatmapChart
              candles={marketData.candles}
              activeHeatmap={marketData.heatmap}
              heatmapHistory={marketData.heatmapHistory}
              liquiditySnapshot={marketData.liquidity}
              currentPrice={currentPrice}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              symbol="BTCUSD (Delta #27)"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

