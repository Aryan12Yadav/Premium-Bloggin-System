import React, { useState, useEffect, useRef } from 'react';
import LiquidityHeatmapChart from './features/terminal/LiquidityHeatmapChart';
import HeatmapCanvas from './features/terminal/HeatmapCanvas';
import CandleChart from './features/terminal/CandleChart';
import OrderbookPanel from './features/terminal/OrderbookPanel';
import AnalyticsPanel from './features/terminal/AnalyticsPanel';
import EventStream from './features/terminal/EventStream';
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
  const [viewMode, setViewMode] = useState('unified'); // 'unified' or 'split'
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
            setMarketData(prev => ({
              ...prev,
              orderbook: d.orderbook || prev.orderbook,
              liquidity: d.liquidity || prev.liquidity,
              heatmap: d.active_heatmap || prev.heatmap,
              status: envelope.status || 'LIVE',
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
  const isLive = marketData.status === 'LIVE';

  return (
    <div className="min-h-screen bg-[#070A10] flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-[#0D121D] border-b border-[#1A2234] px-4 py-2 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="font-bold text-sm tracking-wider text-white">BTCUSD LIQUIDITY INTELLIGENCE</span>
          </div>
          <span className="bg-[#151D2E] text-amber-400 px-2 py-0.5 rounded text-[10px] font-mono border border-amber-500/30">
            DELTA PERPETUAL
          </span>
          <div className="flex items-center space-x-1.5 text-xs font-mono">
            <span className="text-gray-400">Mark:</span>
            <span className="text-white font-bold text-base glow-amber">
              ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center space-x-3">
          {/* Health Badge */}
          <div className="flex items-center space-x-1.5 bg-[#0A0E17] px-2.5 py-1 rounded border border-[#1A2234] text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? 'bg-emerald-500 animate-ping' : 'bg-red-500'
              }`}
            ></span>
            <span className={isLive ? 'text-emerald-400 font-bold' : 'text-red-400'}>
              {marketData.status}
            </span>
          </div>

          <span className="text-gray-500 font-mono text-[11px] hidden md:inline">
            {currentTime}
          </span>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0A0E17] p-0.5 rounded border border-[#1A2234] text-xs font-mono">
            <button
              onClick={() => setViewMode('unified')}
              className={`px-2.5 py-1 rounded transition ${
                viewMode === 'unified'
                  ? 'bg-purple-600 text-white font-bold shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🟣 Unified Heatmap
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded transition ${
                viewMode === 'split'
                  ? 'bg-[#1E2A40] text-amber-300 font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Split View
            </button>
          </div>

          {/* Action Modals */}
          <button
            onClick={() => setIsRiskModalOpen(true)}
            className="bg-[#141C2B] hover:bg-[#1E2A40] text-amber-300 border border-amber-500/30 px-3 py-1 rounded text-xs font-mono font-medium transition"
          >
            🛡️ Risk Calc
          </button>
          <button
            onClick={() => setIsResearchModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1 rounded text-xs font-mono font-bold transition shadow-lg shadow-amber-500/20"
          >
            🧠 AI Research Blogs
          </button>
        </div>
      </header>

      {/* Main Terminal Dashboard Grid */}
      <main className="flex-1 p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 overflow-y-auto">
        {/* Left Column (Charts & Heatmap) - 8 Cols */}
        <div className="lg:col-span-8 flex flex-col space-y-3">
          {viewMode === 'unified' ? (
            /* Coinfuty Institutional Unified Candlestick + Liquidity Heatmap Overlay */
            <div className="terminal-card flex-1 flex flex-col">
              <div className="terminal-header">
                <span className="flex items-center space-x-2">
                  <span className="text-amber-400 font-bold">BTCUSD Coinfuty-Style Liquidity Heatmap</span>
                  <span className="text-gray-400 text-[10px] font-normal">• Delta Product #27</span>
                </span>
                <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-mono">
                  <span>Bin: $50</span>
                  <span>•</span>
                  <span>TWAP Density</span>
                  <span>•</span>
                  <span className="text-emerald-400">{marketData.candles.length} Candles</span>
                </div>
              </div>
              <div className="p-2 flex-1">
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
          ) : (
            /* Split View */
            <>
              {/* Candlestick Chart */}
              <div className="terminal-card">
                <div className="terminal-header">
                  <span>BTCUSD Candlestick Telemetry ({timeframe})</span>
                  <span className="text-gray-400 font-mono text-[10px]">Delta Exchange Market Flow</span>
                </div>
                <div className="p-2">
                  <CandleChart
                    candles={marketData.candles}
                    currentPrice={currentPrice}
                    timeframe={timeframe}
                    onTimeframeChange={setTimeframe}
                  />
                </div>
              </div>

              {/* Horizontal Liquidity Heatmap */}
              <div className="terminal-card flex-1">
                <div className="terminal-header">
                  <span>1-Minute Horizontal Liquidity Heatmap</span>
                  <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-mono">
                    <span>Bin: $50</span>
                    <span>•</span>
                    <span>Time-Weighted TWAP</span>
                  </div>
                </div>
                <div className="p-2">
                  <HeatmapCanvas
                    activeHeatmap={marketData.heatmap}
                    currentPrice={currentPrice}
                    binWidth={50}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column (Orderbook, Analytics, Events) - 4 Cols */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          {/* Orderbook Panel */}
          <div className="h-[270px]">
            <OrderbookPanel orderbook={marketData.orderbook} />
          </div>

          {/* Analytics & Volatility HUD */}
          <div className="h-[210px]">
            <AnalyticsPanel
              liquidity={marketData.liquidity}
              volatility={marketData.volatility}
            />
          </div>

          {/* Live Events Stream */}
          <div className="flex-1 min-h-[170px]">
            <EventStream events={marketData.events} />
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
