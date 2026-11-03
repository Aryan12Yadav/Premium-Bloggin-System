import React, { useState, useEffect, useRef } from 'react';
import LiquidityHeatmapChart from './features/terminal/LiquidityHeatmapChart';
import { LiveCandleStream } from './services/liveCandleStream';

export default function App() {
  // Candlesticks are managed solely from the real-time API stream (Binance 0ms)
  const [candles, setCandles] = useState([]);
  const [livePrice, setLivePrice] = useState(null);
  const [timeframe, setTimeframe] = useState('1m');

  // Go Backend Market Engine state (Heatmap, Liquidity, Orderbook, Volatility)
  const [marketData, setMarketData] = useState({
    symbol: 'BTCUSDT',
    orderbook: null,
    liquidity: null,
    heatmap: [],
    heatmapHistory: [],
    events: [],
    volatility: null,
    status: 'CONNECTING',
  });

  const [currentTime, setCurrentTime] = useState(new Date().toUTCString());

  // Price Flash animation state
  const [priceFlash, setPriceFlash] = useState(null);
  const prevPriceRef = useRef(null);
  const wsRef = useRef(null);

  // 1. REAL-TIME CANDLESTICK STREAM (Direct API feed, zero dependency on Go)
  useEffect(() => {
    const stream = new LiveCandleStream({
      symbol: 'BTCUSDT',
      interval: timeframe,
      onSnapshot: (initialCandles) => {
        if (initialCandles && initialCandles.length > 0) {
          setCandles(initialCandles);
          setLivePrice(initialCandles[initialCandles.length - 1].close);
        }
      },
      onCandleUpdate: (liveCandle) => {
        setCandles(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0) {
            const lastCandle = updated[lastIdx];
            if (lastCandle.start_time === liveCandle.start_time) {
              updated[lastIdx] = liveCandle;
            } else if (new Date(liveCandle.start_time).getTime() > new Date(lastCandle.start_time).getTime()) {
              updated.push(liveCandle);
              if (updated.length > 500) updated.shift();
            }
          } else {
            updated.push(liveCandle);
          }
          return updated;
        });
        setLivePrice(liveCandle.close);
      },
    });

    stream.start();
    return () => stream.destroy();
  }, [timeframe]);

  // 2. Real-time UTC clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 3. Price Flash trigger on tick change
  const currentPrice = livePrice || marketData.orderbook?.best_bid || (candles.length > 0 ? candles[candles.length - 1].close : 76900);

  useEffect(() => {
    if (prevPriceRef.current !== null && currentPrice !== prevPriceRef.current) {
      setPriceFlash(currentPrice > prevPriceRef.current ? 'price-flash-up' : 'price-flash-down');
      const timer = setTimeout(() => setPriceFlash(null), 800);
      prevPriceRef.current = currentPrice;
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  // 4. GO BACKEND LIQUIDITY & HEATMAP WEBSOCKET (:8080/ws)
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
          if (!envelope) return;

          if (envelope.type === 'market.snapshot') {
            const d = envelope.data || {};
            setMarketData(prev => ({
              ...prev,
              orderbook: d.orderbook || prev.orderbook,
              liquidity: d.liquidity || prev.liquidity,
              heatmap: d.heatmap || prev.heatmap,
              heatmapHistory: d.heatmap_history || prev.heatmapHistory,
              events: d.events || prev.events,
              status: envelope.status || 'LIVE',
            }));
          } else if (envelope.type === 'market.liquidity.update') {
            const d = envelope.data || {};
            setMarketData(prev => ({
              ...prev,
              orderbook: d.orderbook || prev.orderbook,
              liquidity: d.liquidity || prev.liquidity,
              heatmap: d.active_heatmap || prev.heatmap,
              status: envelope.status || 'LIVE',
            }));
          } else if (envelope.type === 'market.heatmap.finalized') {
            const finalized = Array.isArray(envelope.data) ? envelope.data : [];
            setMarketData(prev => ({
              ...prev,
              heatmapHistory: [...prev.heatmapHistory, ...finalized].slice(-3000),
            }));
          } else if (envelope.type === 'market.trade.update') {
            const d = envelope.data || {};
            setMarketData(prev => ({
              ...prev,
              volatility: d.volatility || prev.volatility,
            }));
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
          console.error('Error parsing Go backend WS message', e);
        }
      };

      ws.onerror = () => {
        setMarketData(prev => ({ ...prev, status: 'OFFLINE' }));
      };

      ws.onclose = () => {
        setMarketData(prev => ({ ...prev, status: 'OFFLINE' }));
        reconnectTimeout = setTimeout(connectWS, 2500);
      };
    };

    connectWS();

    // Initial fallback REST fetches for Go backend data (Heatmap, Liquidity, Orderbook)
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

  const spread = marketData.orderbook?.spread || 0.5;
  const spreadBps = marketData.orderbook?.spread_bps || 0.06;
  const imbalance = marketData.liquidity?.imbalance || 0;
  const isEngineLive = marketData.status === 'LIVE';

  return (
    <div className="h-screen w-screen bg-[#06090F] flex flex-col overflow-hidden select-none text-[#E2E8F0]">
      {/* ========================================================= */}
      {/* 1. PROPER HEADER                                          */}
      {/* ========================================================= */}
      <header className="bg-[#0A0E17] border-b border-[#141C2E] px-4 py-2 flex justify-between items-center z-20 flex-shrink-0">
        {/* Left: Product & Real-time Live Price */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-base tracking-wide text-white">BTCUSDT</span>
            <span className="bg-[#101726] text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-amber-500/30">
              PERPETUAL
            </span>
          </div>

          <div className={`flex items-baseline space-x-1 font-mono px-2 py-0.5 rounded transition-all duration-300 ${priceFlash || ''}`}>
            <span className="text-white font-bold text-lg glow-amber">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          </div>
        </div>

        {/* Center: Essential Market Telemetry Strip */}
        <div className="hidden md:flex items-center space-x-4 text-xs font-mono bg-[#070B12] px-3.5 py-1.5 rounded border border-[#141C2E]">
          <div className="flex items-center space-x-1.5">
            <span className="text-gray-400">Spread:</span>
            <span className="text-white font-bold">${spread.toFixed(1)}</span>
            <span className="text-gray-500 text-[10px]">({spreadBps.toFixed(2)} bps)</span>
          </div>

          <span className="text-gray-700">•</span>

          <div className="flex items-center space-x-1.5">
            <span className="text-gray-400">Imbalance:</span>
            <span className={`font-bold ${imbalance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {imbalance >= 0 ? `+${(imbalance * 100).toFixed(1)}%` : `${(imbalance * 100).toFixed(1)}%`}
            </span>
          </div>

          <span className="text-gray-700 hidden lg:inline">•</span>

          <div className="hidden lg:flex items-center space-x-1.5">
            <span className="text-gray-400">1m Vol:</span>
            <span className="text-amber-400 font-bold">
              {((marketData.volatility?.realized_volatility || 0.0142) * 100).toFixed(2)}%
            </span>
          </div>

          <span className="text-gray-700 hidden xl:inline">•</span>

          <div className="hidden xl:flex items-center space-x-1.5">
            <span className="text-gray-400">ATR:</span>
            <span className="text-cyan-400 font-bold">
              ${(marketData.volatility?.atr || 68.5).toFixed(1)}
            </span>
          </div>
        </div>

        {/* Right: Engine Status Badge & UTC Clock */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 bg-[#070B12] px-2.5 py-1 rounded border border-[#141C2E] text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isEngineLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            ></span>
            <span className={isEngineLive ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
              GO ENGINE: {marketData.status}
            </span>
          </div>

          <span className="text-gray-400 font-mono text-xs hidden sm:inline bg-[#070B12] px-2.5 py-1 rounded border border-[#141C2E]">
            {currentTime.slice(17, 25)} UTC
          </span>
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. PROPER MAIN (Unified Chart & Heatmap Terminal)        */}
      {/* ========================================================= */}
      <main className="flex-1 p-2 flex flex-col overflow-hidden min-h-0 bg-[#06090F]">
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 rounded border border-[#141C2E] bg-[#0A0E17]">
          <LiquidityHeatmapChart
            candles={candles}
            activeHeatmap={marketData.heatmap}
            heatmapHistory={marketData.heatmapHistory}
            liquiditySnapshot={marketData.liquidity}
            currentPrice={currentPrice}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            symbol="BTCUSDT PERP"
          />
        </div>
      </main>

      {/* ========================================================= */}
      {/* 3. PROPER FOOTER                                          */}
      {/* ========================================================= */}
      <footer className="bg-[#0A0E17] border-t border-[#141C2E] px-4 py-1.5 flex justify-between items-center text-xs font-mono text-gray-400 z-20 flex-shrink-0">
        {/* Left: Orderbook Summary */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <span className="text-gray-500">Best Bid:</span>
            <span className="text-emerald-400 font-bold">
              ${(marketData.orderbook?.best_bid || currentPrice - 0.5).toFixed(1)}
            </span>
          </div>
          <span className="text-gray-700">|</span>
          <div className="flex items-center space-x-1">
            <span className="text-gray-500">Best Ask:</span>
            <span className="text-red-400 font-bold">
              ${(marketData.orderbook?.best_ask || currentPrice + 0.5).toFixed(1)}
            </span>
          </div>
          <span className="text-gray-700 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center space-x-1">
            <span className="text-gray-500">Spread:</span>
            <span className="text-white font-semibold">${spread.toFixed(1)}</span>
          </div>
        </div>

        {/* Center: Live Data Source Telemetry */}
        <div className="hidden md:flex items-center space-x-2 text-[11px] text-gray-500">
          <span className="text-emerald-400 font-medium">● Candle Feed: Public API (0ms latency)</span>
          <span>•</span>
          <span className={isEngineLive ? 'text-blue-400' : 'text-gray-400'}>
            Heatmap Engine: Port 8080
          </span>
        </div>

        {/* Right: Sync Status & Candle Count */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <span className="text-gray-500">Candles:</span>
            <span className="text-emerald-400 font-bold">{candles.length} Synced</span>
          </div>
          <span className="text-gray-700">•</span>
          <span className="text-gray-500">Status: <strong className="text-emerald-400">Optimal</strong></span>
        </div>
      </footer>
    </div>
  );
}
