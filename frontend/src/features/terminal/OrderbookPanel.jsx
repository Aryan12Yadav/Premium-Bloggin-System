import React, { useState } from 'react';

export default function OrderbookPanel({ orderbook, onPriceSelect }) {
  const [depthLimit, setDepthLimit] = useState(10); // 8, 10, 14

  if (!orderbook || !orderbook.bids || !orderbook.asks) {
    return (
      <div className="terminal-card p-4 text-xs font-mono text-gray-500 flex flex-col items-center justify-center h-full space-y-2">
        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
        <span>Hydrating Delta L2 Orderbook telemetry...</span>
      </div>
    );
  }

  const bids = (orderbook.bids || []).slice(0, depthLimit);
  const asks = (orderbook.asks || []).slice(0, depthLimit);

  // Calculate cumulative notionals & max for visual depth bar scaling
  let cumBid = 0;
  const bidsWithCum = bids.map(b => {
    cumBid += b.notional || (b.price * b.quantity);
    return { ...b, cumNotional: cumBid };
  });

  let cumAsk = 0;
  const asksWithCum = asks.map(a => {
    cumAsk += a.notional || (a.price * a.quantity);
    return { ...a, cumNotional: cumAsk };
  });

  const maxNotional = Math.max(cumBid, cumAsk, 100000);

  const bestBid = orderbook.best_bid || (bids[0]?.price) || 0;
  const bestAsk = orderbook.best_ask || (asks[0]?.price) || 0;
  const spread = orderbook.spread || (bestAsk - bestBid) || 0;
  const spreadBps = orderbook.spread_bps || ((spread / (bestBid || 1)) * 10000) || 0;

  return (
    <div className="terminal-card flex flex-col h-full">
      <div className="terminal-header">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-gray-200">L2 Orderbook</span>
          <span className="text-[10px] text-gray-500 font-mono hidden xl:inline">• Delta 20-Deep</span>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-mono">
          <div className="flex items-center space-x-1 bg-[#070B12] px-1.5 py-0.5 rounded border border-[#141C2E]">
            <span className="text-gray-400">Spread:</span>
            <span className="text-amber-400 font-bold">${spread.toFixed(1)}</span>
            <span className="text-gray-500 text-[9px]">({spreadBps.toFixed(1)} bps)</span>
          </div>

          <div className="flex items-center space-x-0.5 bg-[#070B12] p-0.5 rounded border border-[#141C2E]">
            {[8, 10, 14].map(lim => (
              <button
                key={lim}
                onClick={() => setDepthLimit(lim)}
                className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                  depthLimit === lim ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                {lim}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Two-Column Depth Ladder */}
      <div className="p-1.5 grid grid-cols-2 gap-1.5 text-[11px] font-mono flex-1 overflow-y-auto">
        {/* Bids Column */}
        <div className="flex flex-col space-y-0.5">
          <div className="flex justify-between text-[9px] text-gray-400 pb-0.5 border-b border-[#141C2E] px-1 font-semibold">
            <span>Bid ($)</span>
            <span>Size (BTC)</span>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto">
            {bidsWithCum.map((b, i) => {
              const barWidth = Math.min(100, (b.cumNotional / maxNotional) * 100);
              return (
                <div
                  key={i}
                  onClick={() => onPriceSelect && onPriceSelect(b.price)}
                  title={`Click to set Entry/Stop in Risk Calc: $${b.price.toFixed(1)} (Total: $${Math.round(b.cumNotional).toLocaleString()})`}
                  className="relative flex justify-between items-center py-0.5 px-1 rounded overflow-hidden hover:bg-emerald-500/15 cursor-pointer transition group"
                >
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/20 pointer-events-none transition-all duration-200"
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className="text-emerald-400 font-bold z-10 group-hover:underline">${b.price.toFixed(1)}</span>
                  <span className="text-gray-300 z-10 text-[10px]">{b.quantity.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Asks Column */}
        <div className="flex flex-col space-y-0.5">
          <div className="flex justify-between text-[9px] text-gray-400 pb-0.5 border-b border-[#141C2E] px-1 font-semibold">
            <span>Ask ($)</span>
            <span>Size (BTC)</span>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto">
            {asksWithCum.map((a, i) => {
              const barWidth = Math.min(100, (a.cumNotional / maxNotional) * 100);
              return (
                <div
                  key={i}
                  onClick={() => onPriceSelect && onPriceSelect(a.price)}
                  title={`Click to set Entry/Stop in Risk Calc: $${a.price.toFixed(1)} (Total: $${Math.round(a.cumNotional).toLocaleString()})`}
                  className="relative flex justify-between items-center py-0.5 px-1 rounded overflow-hidden hover:bg-red-500/15 cursor-pointer transition group"
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-red-500/20 pointer-events-none transition-all duration-200"
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className="text-red-400 font-bold z-10 group-hover:underline">${a.price.toFixed(1)}</span>
                  <span className="text-gray-300 z-10 text-[10px]">{a.quantity.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Summary Bar */}
      <div className="px-2 py-1 bg-[#070B12] border-t border-[#141C2E] flex justify-between items-center text-[9px] font-mono">
        <div className="flex items-center space-x-1">
          <span className="text-gray-500">Total Bids:</span>
          <span className="text-emerald-400 font-bold">${(cumBid / 1000000).toFixed(2)}M</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="text-gray-500">Total Asks:</span>
          <span className="text-red-400 font-bold">${(cumAsk / 1000000).toFixed(2)}M</span>
        </div>
      </div>
    </div>
  );
}

