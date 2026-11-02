import React, { useState } from 'react';

export default function RiskCalculatorModal({ isOpen, onClose, currentPrice }) {
  const [equity, setEquity] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(0.5);
  const [entryPrice, setEntryPrice] = useState(currentPrice || 78500);
  const [stopPrice, setStopPrice] = useState((currentPrice || 78500) - 250);
  const contractMultiplier = 0.001; // Delta BTCUSDT contract value

  if (!isOpen) return null;

  // Formula calculations
  const plannedRiskAmount = equity * (riskPercent / 100);
  const priceDistance = Math.abs(entryPrice - stopPrice);
  const positionSize = priceDistance > 0 ? plannedRiskAmount / priceDistance : 0;
  const contractCount = Math.floor(positionSize / contractMultiplier);
  const estimatedFees = positionSize * entryPrice * 0.0003 * 2; // Maker/Taker round-trip approx

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="terminal-card w-full max-w-lg border border-amber-500/40 shadow-2xl">
        <div className="terminal-header flex justify-between items-center bg-[#151C2C]">
          <span className="text-amber-400 font-bold flex items-center space-x-2">
            <span>🛡️</span>
            <span>Delta Perpetual Risk Management Calculator</span>
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white px-2 py-0.5 rounded text-sm"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs font-mono">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 block mb-1">Account Equity (E)</label>
              <input
                type="number"
                value={equity}
                onChange={e => setEquity(Number(e.target.value))}
                className="w-full bg-[#0A0E17] border border-[#1E2538] rounded px-3 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Risk Percentage (r %)</label>
              <input
                type="number"
                step="0.1"
                value={riskPercent}
                onChange={e => setRiskPercent(Number(e.target.value))}
                className="w-full bg-[#0A0E17] border border-[#1E2538] rounded px-3 py-1.5 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 block mb-1">Entry Price ($)</label>
              <input
                type="number"
                value={entryPrice}
                onChange={e => setEntryPrice(Number(e.target.value))}
                className="w-full bg-[#0A0E17] border border-[#1E2538] rounded px-3 py-1.5 text-white"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Stop-Loss Price ($)</label>
              <input
                type="number"
                value={stopPrice}
                onChange={e => setStopPrice(Number(e.target.value))}
                className="w-full bg-[#0A0E17] border border-[#1E2538] rounded px-3 py-1.5 text-white"
              />
            </div>
          </div>

          {/* Results Card */}
          <div className="bg-[#0A0E17] p-3 rounded border border-amber-500/30 space-y-2">
            <div className="flex justify-between border-b border-gray-800 pb-1">
              <span className="text-gray-400">Max Permitted Loss (R = E × r):</span>
              <span className="text-amber-400 font-bold">${plannedRiskAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-1">
              <span className="text-gray-400">Price Invalidation Distance:</span>
              <span className="text-white">${priceDistance.toFixed(1)}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-1">
              <span className="text-gray-400">Recommended Position Size (BTC):</span>
              <span className="text-emerald-400 font-bold">{positionSize.toFixed(4)} BTC</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-1">
              <span className="text-gray-400">Delta Contract Count (0.001 BTC):</span>
              <span className="text-emerald-400 font-bold">{contractCount.toLocaleString()} Contracts</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-gray-400">Est. Round-Trip Fees (0.03%):</span>
              <span className="text-gray-300">${estimatedFees.toFixed(2)}</span>
            </div>
          </div>

          <p className="text-[10px] text-gray-500 leading-relaxed">
            * Mathematical Safeguard: Slippage, funding rates, and execution delay can widen actual loss. Never exceed planned risk limits.
          </p>
        </div>
      </div>
    </div>
  );
}
