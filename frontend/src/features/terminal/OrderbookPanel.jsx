import React from 'react';

export default function OrderbookPanel({ orderbook }) {
  if (!orderbook || !orderbook.bids || !orderbook.asks) {
    return (
      <div className="terminal-card p-4 text-xs font-mono text-gray-500">
        Connecting to Orderbook L2 feed...
      </div>
    );
  }

  const bids = orderbook.bids.slice(0, 10);
  const asks = orderbook.asks.slice(0, 10);

  // Calculate max notional for visual depth bar scaling
  let maxNotional = 1;
  [...bids, ...asks].forEach(lvl => {
    if (lvl.notional > maxNotional) maxNotional = lvl.notional;
  });

  return (
    <div className="terminal-card flex flex-col h-full">
      <div className="terminal-header">
        <span>Orderbook L2 Depth</span>
        <div className="flex items-center space-x-2 text-[10px]">
          <span className="text-gray-400">Spread:</span>
          <span className="text-white font-mono font-bold">${orderbook.spread?.toFixed(1) || '0.0'}</span>
          <span className="text-amber-400 font-mono">({orderbook.spread_bps?.toFixed(2) || '0.00'} bps)</span>
        </div>
      </div>

      <div className="p-2 grid grid-cols-2 gap-2 text-[11px] font-mono flex-1 overflow-y-auto">
        {/* Bids Column */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-gray-500 pb-1 border-b border-[#1E2538]">
            <span>Bid Price</span>
            <span>Notional ($)</span>
          </div>
          {bids.map((b, i) => {
            const barWidth = Math.min(100, (b.notional / maxNotional) * 100);
            return (
              <div key={i} className="relative flex justify-between py-0.5 px-1 rounded overflow-hidden">
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none"
                  style={{ width: `${barWidth}%` }}
                />
                <span className="text-emerald-400 font-bold z-10">${b.price.toFixed(1)}</span>
                <span className="text-gray-300 z-10">${Math.round(b.notional).toLocaleString()}</span>
              </div>
            );
          })}
        </div>

        {/* Asks Column */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-gray-500 pb-1 border-b border-[#1E2538]">
            <span>Ask Price</span>
            <span>Notional ($)</span>
          </div>
          {asks.map((a, i) => {
            const barWidth = Math.min(100, (a.notional / maxNotional) * 100);
            return (
              <div key={i} className="relative flex justify-between py-0.5 px-1 rounded overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-red-500/15 pointer-events-none"
                  style={{ width: `${barWidth}%` }}
                />
                <span className="text-red-400 font-bold z-10">${a.price.toFixed(1)}</span>
                <span className="text-gray-300 z-10">${Math.round(a.notional).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
