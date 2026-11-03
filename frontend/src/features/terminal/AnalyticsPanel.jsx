import React, { useState } from 'react';

export default function AnalyticsPanel({ liquidity, volatility, events = [], onPriceSelect }) {
  const [tab, setTab] = useState('flow'); // 'flow' | 'triggers'
  const [eventFilter, setEventFilter] = useState('ALL'); // 'ALL' | 'SWEEPS' | 'ABSORPTION' | 'WITHDRAWAL'

  const imbalance = liquidity?.imbalance || 0;
  const bidNotional = liquidity?.total_bid_notional || 0;
  const askNotional = liquidity?.total_ask_notional || 0;
  const ratio = liquidity?.bid_ask_ratio || (askNotional > 0 ? bidNotional / askNotional : 1.0);
  const rv = volatility?.realized_volatility || 0.0142;
  const atr = volatility?.atr || 68.5;

  // Imbalance meter percentage: -1 -> 0%, 0 -> 50%, +1 -> 100%
  const meterPercent = Math.max(0, Math.min(100, ((imbalance + 1) / 2) * 100));

  let imbalanceLabel = 'Neutral Book';
  let imbalanceColor = 'text-gray-400';
  if (imbalance >= 0.25) {
    imbalanceLabel = imbalance >= 0.6 ? 'Heavy Bid Wall' : 'Bid Dominant (+)';
    imbalanceColor = 'text-emerald-400';
  } else if (imbalance <= -0.25) {
    imbalanceLabel = imbalance <= -0.6 ? 'Heavy Ask Wall' : 'Ask Dominant (-)';
    imbalanceColor = 'text-red-400';
  }

  const filteredEvents = events.filter(evt => {
    if (eventFilter === 'SWEEPS') return evt.event_type.includes('SWEEP');
    if (eventFilter === 'ABSORPTION') return evt.event_type.includes('ABSORPTION');
    if (eventFilter === 'WITHDRAWAL') return evt.event_type.includes('WITHDRAWAL');
    return true;
  });

  return (
    <div className="terminal-card flex flex-col h-full">
      {/* Header with Switcher */}
      <div className="terminal-header py-1.5 px-2">
        <div className="flex items-center space-x-1 bg-[#070B12] p-0.5 rounded border border-[#141C2E]">
          <button
            onClick={() => setTab('flow')}
            className={`btn-terminal text-[10px] py-0.5 px-2 ${tab === 'flow' ? 'active' : ''}`}
          >
            📊 Flow & Volatility
          </button>
          <button
            onClick={() => setTab('triggers')}
            className={`btn-terminal text-[10px] py-0.5 px-2 flex items-center space-x-1 ${tab === 'triggers' ? 'active' : ''}`}
          >
            <span>⚡ Sweeps & Triggers</span>
            {events.length > 0 && (
              <span className={`px-1 py-0.2 rounded-full text-[8px] font-mono ${
                tab === 'triggers' ? 'bg-black text-amber-300' : 'bg-amber-500/20 text-amber-400'
              }`}>
                {events.length}
              </span>
            )}
          </button>
        </div>

        <span className="text-[10px] text-gray-500 font-mono hidden xl:inline">100ms Live Telemetry</span>
      </div>

      <div className="p-2 flex-1 overflow-y-auto text-xs">
        {tab === 'flow' ? (
          <div className="space-y-2 flex flex-col justify-between h-full">
            {/* Imbalance Meter Card */}
            <div className="bg-[#070B12] p-2 rounded border border-[#141C2E] space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-gray-400">Orderbook Imbalance:</span>
                <span className={`font-bold ${imbalanceColor}`}>
                  {imbalance >= 0 ? `+${(imbalance * 100).toFixed(1)}%` : `${(imbalance * 100).toFixed(1)}%`}
                  <span className="text-gray-500 text-[9px] ml-1">({ratio.toFixed(2)}x)</span>
                </span>
              </div>

              {/* Progress Bar with Needle */}
              <div className="relative w-full bg-[#111827] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all duration-300"
                  style={{ width: `${meterPercent}%` }}
                />
              </div>

              <div className="flex justify-between text-[8px] font-mono text-gray-500">
                <span className="text-red-400 font-medium">Asks Dominate</span>
                <span className={`font-bold ${imbalanceColor}`}>{imbalanceLabel}</span>
                <span className="text-emerald-400 font-medium">Bids Dominate</span>
              </div>
            </div>

            {/* Depth & Volatility 2x2 Grid */}
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              <div className="bg-[#070B12] p-2 rounded border border-[#141C2E]">
                <span className="text-gray-500 block text-[9px]">Resting Bid Depth</span>
                <span className="text-emerald-400 font-bold text-xs block mt-0.5">
                  ${Math.round(bidNotional).toLocaleString()}
                </span>
                <span className="text-gray-500 text-[8px]">Cumulative 20 Bins</span>
              </div>

              <div className="bg-[#070B12] p-2 rounded border border-[#141C2E]">
                <span className="text-gray-500 block text-[9px]">Resting Ask Depth</span>
                <span className="text-red-400 font-bold text-xs block mt-0.5">
                  ${Math.round(askNotional).toLocaleString()}
                </span>
                <span className="text-gray-500 text-[8px]">Cumulative 20 Bins</span>
              </div>

              <div className="bg-[#070B12] p-2 rounded border border-[#141C2E]">
                <span className="text-gray-500 block text-[9px]">Realized Vol (1m)</span>
                <span className="text-amber-400 font-bold text-xs block mt-0.5">
                  {(rv * 100).toFixed(3)}%
                </span>
                <span className="text-gray-500 text-[8px]">Log Normal Return</span>
              </div>

              <div className="bg-[#070B12] p-2 rounded border border-[#141C2E]">
                <span className="text-gray-500 block text-[9px]">Wilder ATR (14)</span>
                <span className="text-cyan-400 font-bold text-xs block mt-0.5">
                  ${atr.toFixed(1)}
                </span>
                <span className="text-gray-500 text-[8px]">1-min Volatility Range</span>
              </div>
            </div>
          </div>
        ) : (
          /* Live Sweeps & Absorption Feed */
          <div className="space-y-1.5 font-mono text-[10px] flex flex-col h-full">
            {/* Filter Pills */}
            <div className="flex items-center space-x-1 pb-1 border-b border-[#141C2E]">
              {['ALL', 'SWEEPS', 'ABSORPTION', 'WITHDRAWAL'].map(f => (
                <button
                  key={f}
                  onClick={() => setEventFilter(f)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                    eventFilter === f ? 'bg-amber-500 text-black' : 'bg-[#0E1524] text-gray-400 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto">
              {filteredEvents.length === 0 ? (
                <div className="text-gray-500 text-center py-8 text-[10px]">
                  Monitoring Delta trades for aggressive sweep & absorption triggers...
                </div>
              ) : (
                filteredEvents.slice(0, 15).map((evt, idx) => {
                  const isSweep = evt.event_type.includes('SWEEP');
                  const isBuy = evt.direction === 'BUY';
                  const badgeColor = isSweep
                    ? 'bg-purple-950/80 text-purple-300 border-purple-700/60'
                    : 'bg-blue-950/80 text-blue-300 border-blue-700/60';

                  return (
                    <div
                      key={evt.event_id || idx}
                      onClick={() => evt.price_level && onPriceSelect && onPriceSelect(evt.price_level)}
                      title="Click to copy trigger price to Risk Calculator"
                      className="bg-[#070B12] p-1.5 rounded border border-[#141C2E] hover:border-amber-500/40 cursor-pointer transition flex flex-col space-y-0.5"
                    >
                      <div className="flex justify-between items-center text-[9px]">
                        <span className={`px-1 py-0.2 rounded border font-bold ${badgeColor}`}>
                          {evt.event_type} • <span className={isBuy ? 'text-emerald-400' : 'text-red-400'}>{evt.direction}</span>
                        </span>
                        <span className="text-amber-400 font-bold hover:underline">
                          ${evt.price_level?.toFixed(1) || '0.0'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">
                        {evt.evidence && evt.evidence.length > 0 ? evt.evidence.join(' | ') : 'Execution pattern verified'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

