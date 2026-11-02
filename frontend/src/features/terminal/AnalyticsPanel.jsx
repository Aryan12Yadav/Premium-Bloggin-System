import React, { useState } from 'react';

export default function AnalyticsPanel({ liquidity, volatility, events = [] }) {
  const [tab, setTab] = useState('flow'); // 'flow' | 'triggers'

  const imbalance = liquidity?.imbalance || 0;
  const bidNotional = liquidity?.total_bid_notional || 0;
  const askNotional = liquidity?.total_ask_notional || 0;
  const rv = volatility?.realized_volatility || 0;
  const atr = volatility?.atr || 0;

  // Imbalance meter percentage: -1 -> 0%, 0 -> 50%, +1 -> 100%
  const meterPercent = Math.max(0, Math.min(100, ((imbalance + 1) / 2) * 100));

  let imbalanceLabel = 'Neutral';
  let imbalanceColor = 'text-gray-400';
  if (imbalance >= 0.25) {
    imbalanceLabel = imbalance >= 0.6 ? 'Heavy Bids' : 'Bid Dominance';
    imbalanceColor = 'text-emerald-400';
  } else if (imbalance <= -0.25) {
    imbalanceLabel = imbalance <= -0.6 ? 'Heavy Asks' : 'Ask Dominance';
    imbalanceColor = 'text-red-400';
  }

  return (
    <div className="terminal-card flex flex-col h-full">
      {/* Header with Switcher */}
      <div className="terminal-header py-1.5 px-2">
        <div className="flex items-center space-x-1 bg-[#070A10] p-0.5 rounded border border-[#161F2E] text-[10px]">
          <button
            onClick={() => setTab('flow')}
            className={`px-2 py-0.5 rounded font-bold transition ${
              tab === 'flow'
                ? 'bg-amber-500 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            📊 Flow & Volatility
          </button>
          <button
            onClick={() => setTab('triggers')}
            className={`px-2 py-0.5 rounded font-bold transition flex items-center space-x-1 ${
              tab === 'triggers'
                ? 'bg-amber-500 text-black shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <span>⚡ Live Sweeps</span>
            {events.length > 0 && (
              <span className={`px-1 py-0.2 rounded-full text-[8px] ${
                tab === 'triggers' ? 'bg-black text-amber-300' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {events.length}
              </span>
            )}
          </button>
        </div>
        <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">100ms Live Telemetry</span>
      </div>

      <div className="p-2.5 flex-1 overflow-y-auto text-xs">
        {tab === 'flow' ? (
          <div className="space-y-2.5 flex flex-col justify-between h-full">
            {/* Imbalance Meter */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] text-gray-400 font-medium">Orderbook Imbalance</span>
                <span className={`font-mono font-bold text-xs ${imbalanceColor}`}>
                  {imbalance >= 0 ? `+${(imbalance * 100).toFixed(1)}%` : `${(imbalance * 100).toFixed(1)}%`}
                </span>
              </div>
              <div className="w-full bg-[#131926] h-1.5 rounded-full overflow-hidden flex relative">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all duration-300"
                  style={{ width: `${meterPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] font-mono text-gray-500 mt-1">
                <span className="text-red-400">Asks Dominant</span>
                <span className={`font-bold ${imbalanceColor}`}>{imbalanceLabel}</span>
                <span className="text-emerald-400">Bids Dominant</span>
              </div>
            </div>

            {/* Depth & Volatility Grid */}
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              <div className="bg-[#080C14] p-2 rounded border border-[#141C2B]">
                <span className="text-gray-400 block text-[9px]">Bid Depth (Notional)</span>
                <span className="text-emerald-400 font-bold text-xs block">
                  ${Math.round(bidNotional).toLocaleString()}
                </span>
              </div>
              <div className="bg-[#080C14] p-2 rounded border border-[#141C2B]">
                <span className="text-gray-400 block text-[9px]">Ask Depth (Notional)</span>
                <span className="text-red-400 font-bold text-xs block">
                  ${Math.round(askNotional).toLocaleString()}
                </span>
              </div>
              <div className="bg-[#080C14] p-2 rounded border border-[#141C2B]">
                <span className="text-gray-400 block text-[9px]">Realized Vol (1m)</span>
                <span className="text-amber-400 font-bold text-xs block">
                  {(rv * 100).toFixed(3)}%
                </span>
              </div>
              <div className="bg-[#080C14] p-2 rounded border border-[#141C2B]">
                <span className="text-gray-400 block text-[9px]">ATR (Wilder 14)</span>
                <span className="text-cyan-400 font-bold text-xs block">
                  ${atr.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Live Sweeps & Absorption Feed */
          <div className="space-y-1.5 font-mono text-[10px]">
            {events.length === 0 ? (
              <div className="text-gray-500 text-center py-6 text-[10px]">
                Monitoring Delta trades for aggressive sweep & absorption triggers...
              </div>
            ) : (
              events.slice(0, 10).map((evt, idx) => {
                const isSweep = evt.event_type.includes('SWEEP');
                const badgeColor = isSweep
                  ? 'bg-purple-950/70 text-purple-300 border-purple-700/50'
                  : 'bg-blue-950/70 text-blue-300 border-blue-700/50';

                return (
                  <div
                    key={evt.event_id || idx}
                    className="bg-[#080C14] p-1.5 rounded border border-[#141C2B] flex flex-col space-y-0.5"
                  >
                    <div className="flex justify-between items-center text-[9px]">
                      <span className={`px-1 py-0.2 rounded border font-bold ${badgeColor}`}>
                        {evt.event_type} • {evt.direction}
                      </span>
                      <span className="text-amber-400 font-bold">
                        ${evt.price_level?.toFixed(1) || '0.0'}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {evt.evidence && evt.evidence.length > 0 ? evt.evidence[0] : 'Pattern verified'}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
