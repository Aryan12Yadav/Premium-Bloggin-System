import React from 'react';

export default function AnalyticsPanel({ liquidity, volatility }) {
  const imbalance = liquidity?.imbalance || 0;
  const bidNotional = liquidity?.total_bid_notional || 0;
  const askNotional = liquidity?.total_ask_notional || 0;
  const rv = volatility?.realized_volatility || 0;
  const atr = volatility?.atr || 0;

  // Imbalance meter percentage: -1 -> 0%, 0 -> 50%, +1 -> 100%
  const meterPercent = Math.max(0, Math.min(100, ((imbalance + 1) / 2) * 100));

  let imbalanceLabel = 'Balanced';
  let imbalanceColor = 'text-gray-300';
  if (imbalance >= 0.3) {
    imbalanceLabel = imbalance >= 0.7 ? 'Strong Bid Dominance' : 'Moderate Bid Dominance';
    imbalanceColor = 'text-emerald-400';
  } else if (imbalance <= -0.3) {
    imbalanceLabel = imbalance <= -0.7 ? 'Strong Ask Dominance' : 'Moderate Ask Dominance';
    imbalanceColor = 'text-red-400';
  }

  return (
    <div className="terminal-card flex flex-col h-full">
      <div className="terminal-header">
        <span>Market Analytics & Volatility HUD</span>
        <span className="text-[10px] text-gray-500 font-mono">Formula-Verified</span>
      </div>

      <div className="p-3 space-y-3 flex-1 flex flex-col justify-between text-xs">
        {/* Imbalance Section */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] text-gray-400 font-medium">Orderbook Imbalance (I)</span>
            <span className={`font-mono font-bold ${imbalanceColor}`}>
              {imbalance >= 0 ? `+${imbalance.toFixed(4)}` : imbalance.toFixed(4)}
            </span>
          </div>

          {/* Visual Dial Bar */}
          <div className="w-full bg-[#151C2C] h-2 rounded-full overflow-hidden flex relative">
            <div
              className="h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 transition-all duration-300"
              style={{ width: `${meterPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-gray-500 mt-1">
            <span>-1.0 (Asks)</span>
            <span className={imbalanceColor}>{imbalanceLabel}</span>
            <span>+1.0 (Bids)</span>
          </div>
        </div>

        {/* Notional Depth Metrics */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1E2538] font-mono">
          <div className="bg-[#0A0E17] p-2 rounded border border-[#161E30]">
            <span className="text-[10px] text-gray-400 block">Total Bid Depth</span>
            <span className="text-emerald-400 font-bold text-sm block">
              ${Math.round(bidNotional).toLocaleString()}
            </span>
          </div>
          <div className="bg-[#0A0E17] p-2 rounded border border-[#161E30]">
            <span className="text-[10px] text-gray-400 block">Total Ask Depth</span>
            <span className="text-red-400 font-bold text-sm block">
              ${Math.round(askNotional).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Volatility & ATR Metrics */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1E2538] font-mono">
          <div className="bg-[#0A0E17] p-2 rounded border border-[#161E30]">
            <span className="text-[10px] text-gray-400 block">Realized Vol (RV)</span>
            <span className="text-amber-400 font-bold text-sm block">
              {(rv * 100).toFixed(3)}%
            </span>
          </div>
          <div className="bg-[#0A0E17] p-2 rounded border border-[#161E30]">
            <span className="text-[10px] text-gray-400 block">ATR (14 Wilder)</span>
            <span className="text-cyan-400 font-bold text-sm block">
              ${atr.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
