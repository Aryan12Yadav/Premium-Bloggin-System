import React, { useState, useEffect, useRef } from 'react';
import LiquidityHeatmapChart from './features/terminal/LiquidityHeatmapChart';
import OrderbookPanel from './features/terminal/OrderbookPanel';
import AnalyticsPanel from './features/terminal/AnalyticsPanel';
import RiskCalculatorModal from './features/risk/RiskCalculatorModal';
import ResearchModal from './features/research/ResearchModal';
import './styles/terminal.css';

export default function App() {
  const [marketData, setMarketData] = useState({
    symbol: 'BTCUSD',
    orderbook: null,
    liquidity: null,
    heatmap: [],
    candles: [],
    events: [],
    volatility: null,
    status: 'CONNECTING',
  });

  const [timeframe, setTimeframe] = useState('1m');
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toUTCString());

  const wsRef = useRef(null);

  // Time ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

    // Initial fallback fetch
    fetch('http://localhost:8080/api/candles')
      .then(r => r.json())
      .then(candles => {
        if (candles && Array.isArray(candles)) {
          setMarketData(prev => ({ ...prev, candles }));
        }
      })
      .catch(() => {});

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const currentPrice = marketData.orderbook?.best_bid || 78500;
  const spread = marketData.orderbook?.spread || 0.5;
  const spreadBps = marketData.orderbook?.spread_bps || 0.06;
  const imbalance = marketData.liquidity?.imbalance || 0;
  const isLive = marketData.status === 'LIVE';

  return (
    <div className="h-screen w-screen bg-[#06090F] flex flex-col overflow-hidden select-none">
      {/* Sleek Top Navigation Ribbon */}
      <header className="bg-[#0B0F17] border-b border-[#161F2E] px-3 py-1.5 flex justify-between items-center z-20 flex-shrink-0">
        {/* Left: Product & Live Price */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-fast"></span>
            <span className="font-bold text-sm tracking-wide text-white">BTCUSD</span>
            <span className="bg-[#121A2A] text-amber-400 px-1.5 py-0.2 rounded text-[10px] font-mono border border-amber-500/25">
              DELTA #27 PERP
            </span>
          </div>

          <div className="flex items-baseline space-x-1 font-mono">
            <span className="text-white font-bold text-base glow-amber">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          </div>
        </div>

        {/* Center: Live Orderbook & Volatility HUD Ribbon */}
        <div className="hidden md:flex items-center space-x-4 text-[11px] font-mono bg-[#070A10] px-3 py-1 rounded border border-[#161F2E]">
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
        </div>

        {/* Right: Status & Action Modals */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 bg-[#070A10] px-2 py-0.5 rounded border border-[#161F2E] text-[10px] font-mono">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLive ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            ></span>
            <span className={isLive ? 'text-emerald-400 font-bold' : 'text-red-400'}>
              {marketData.status}
            </span>
          </div>

          <span className="text-gray-500 font-mono text-[10px] hidden xl:inline">
            {currentTime}
          </span>

          <button
            onClick={() => setIsRiskModalOpen(true)}
            className="bg-[#101726] hover:bg-[#1A2438] text-amber-300 border border-amber-500/25 px-2.5 py-1 rounded text-xs font-mono font-medium transition flex items-center space-x-1"
          >
            <span>🛡️</span>
            <span>Risk Calc</span>
          </button>
          <button
            onClick={() => setIsResearchModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 rounded text-xs font-mono font-bold transition shadow shadow-amber-500/20 flex items-center space-x-1"
          >
            <span>🧠</span>
            <span>AI Research</span>
          </button>
        </div>
      </header>

      {/* Main Terminal Dashboard Grid */}
      <main className="flex-1 p-2 grid grid-cols-12 gap-2 overflow-hidden">
        {/* Left Column: Coinfuty Unified Liquidity Heatmap + Candlestick Chart (8 Cols) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col h-full overflow-hidden">
          <div className="terminal-card flex-1 flex flex-col overflow-hidden">
            <div className="terminal-header py-1 px-3">
              <div className="flex items-center space-x-2">
                <span className="text-gray-200 font-bold">BTCUSD Coinfuty-Style Liquidity Heatmap</span>
                <span className="text-gray-500 text-[10px] font-mono">• Delta Product #27</span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-mono">
                <span>Bin: $50</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">{marketData.candles.length} Candles</span>
              </div>
            </div>
            <div className="p-1.5 flex-1 flex flex-col overflow-hidden">
              <LiquidityHeatmapChart
                candles={marketData.candles}
                activeHeatmap={marketData.heatmap}
                liquiditySnapshot={marketData.liquidity}
                currentPrice={currentPrice}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                symbol="BTCUSD (Product #27)"
              />
            </div>
          </div>
        </div>

        {/* Right Column: L2 Orderbook Depth & Market Intelligence HUD (4 Cols) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-2 h-full overflow-hidden">
          {/* Top Half: Orderbook L2 Depth */}
          <div className="flex-[5] min-h-[220px] overflow-hidden">
            <OrderbookPanel orderbook={marketData.orderbook} />
          </div>

          {/* Bottom Half: Flow, Volatility & Live Sweeps Switcher */}
          <div className="flex-[5] min-h-[220px] overflow-hidden">
            <AnalyticsPanel
              liquidity={marketData.liquidity}
              volatility={marketData.volatility}
              events={marketData.events}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <RiskCalculatorModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        currentPrice={currentPrice}
      />
      <ResearchModal
        isOpen={isResearchModalOpen}
        onClose={() => setIsResearchModalOpen(false)}
      />
    </div>
  );
}
