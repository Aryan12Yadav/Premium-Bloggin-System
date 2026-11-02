import React from 'react';

export default function OrderbookPanel({ orderbook }) {
  if (!orderbook || !orderbook.bids || !orderbook.asks) {
    return (
      <div className="terminal-card p-4 text-xs font-mono text-gray-500 flex items-center justify-center h-full">
        Connecting to Orderbook L2 feed...
      </div>
    );
  }

  const bids = orderbook.bids.slice(0, 8);
  const asks = orderbook.asks.slice(0, 8);

  // Calculate max notional for visual depth bar scaling
  let maxNotional = 1;
  [...bids, ...asks].forEach(lvl => {
    if (lvl.notional > maxNotional) maxNotional = lvl.notional;
  });

  const bestBid = orderbook.best_bid || (bids[0]?.price) || 0;
  const bestAsk = orderbook.best_ask || (asks[0]?.price) || 0;
  const spread = orderbook.spread || (bestAsk - bestBid) || 0;
  const spreadBps = orderbook.spread_bps || 0;

  return (
    <div className="terminal-card flex flex-col h-full">
      <div className="terminal-header">
        <span className="font-bold text-gray-200">L2 Orderbook</span>
        <div className="flex items-center space-x-1.5 text-[10px] font-mono">
          <span className="text-gray-400">Spread:</span>
          <span className="text-amber-400 font-bold">${spread.toFixed(1)}</span>
          <span className="text-gray-500">({spreadBps.toFixed(2)} bps)</span>
        </div>
      </div>

      <div className="p-2 grid grid-cols-2 gap-2 text-[11px] font-mono flex-1 overflow-y-auto">
        {/* Bids Column */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] text-gray-500 pb-1 border-b border-[#1E2538] px-1 font-semibold">
            <span>Bid ($)</span>
            <span>Size (BTC)</span>
          </div>
          {bids.map((b, i) => {
            const barWidth = Math.min(100, (b.notional / maxNotional) * 100);
            return (
              <div key={i} className="relative flex justify-between py-0.5 px-1 rounded overflow-hidden hover:bg-emerald-500/10 transition">
                <div
                  className="absolute right-0 top-0 bottom-0 bg-emerald-500/20 pointer-events-none"
                  style={{ width: `${barWidth}%` }}
                />
                <span className="text-emerald-400 font-bold z-10">${b.price.toFixed(1)}</span>
                <span className="text-gray-300 z-10">{b.quantity.toFixed(3)}</span>
              </div>
            );
          })}
        </div>

        {/* Asks Column */}
        <div className="space-y-0.5">
          <div className="flex justify-between text-[10px] text-gray-500 pb-1 border-b border-[#1E2538] px-1 font-semibold">
            <span>Ask ($)</span>
            <span>Size (BTC)</span>
          </div>
          {asks.map((a, i) => {
            const barWidth = Math.min(100, (a.notional / maxNotional) * 100);
            return (
              <div key={i} className="relative flex justify-between py-0.5 px-1 rounded overflow-hidden hover:bg-red-500/10 transition">
                <div
                  className="absolute left-0 top-0 bottom-0 bg-red-500/20 pointer-events-none"
                  style={{ width: `${barWidth}%` }}
                />
                <span className="text-red-400 font-bold z-10">${a.price.toFixed(1)}</span>
                <span className="text-gray-300 z-10">{a.quantity.toFixed(3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
