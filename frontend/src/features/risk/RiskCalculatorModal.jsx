import React, { useState, useEffect } from 'react';

export default function RiskCalculatorModal({ isOpen, onClose, currentPrice, prefilledPrice }) {
  const [instrument, setInstrument] = useState('BTCUSDT'); // 'BTCUSDT' (Linear 0.001 BTC) | 'BTCUSD' (Inverse $1)
  const [direction, setDirection] = useState('LONG'); // 'LONG' | 'SHORT'
  const [equity, setEquity] = useState(100000);
  const [riskPercent, setRiskPercent] = useState(0.5);
  const [entryPrice, setEntryPrice] = useState(currentPrice || 78500);
  const [stopPrice, setStopPrice] = useState((currentPrice || 78500) - 250);
  const [targetPrice, setTargetPrice] = useState((currentPrice || 78500) + 500);
  const [leverage, setLeverage] = useState(10);
  const [copied, setCopied] = useState(false);

  // Sync prefilled price or currentPrice when opened
  useEffect(() => {
    if (prefilledPrice && prefilledPrice > 0) {
      setEntryPrice(prefilledPrice);
      const diff = 250;
      setStopPrice(direction === 'LONG' ? prefilledPrice - diff : prefilledPrice + diff);
      setTargetPrice(direction === 'LONG' ? prefilledPrice + diff * 2 : prefilledPrice - diff * 2);
    } else if (currentPrice && currentPrice > 0 && entryPrice === 78500) {
      setEntryPrice(currentPrice);
      setStopPrice(direction === 'LONG' ? currentPrice - 250 : currentPrice + 250);
      setTargetPrice(direction === 'LONG' ? currentPrice + 500 : currentPrice - 500);
    }
  }, [prefilledPrice, currentPrice, isOpen]);

  if (!isOpen) return null;

  // Contract specs
  // BTCUSDT Linear: 1 contract = 0.001 BTC
  // BTCUSD Inverse #27: 1 contract = $1.00 USD
  const isLinear = instrument === 'BTCUSDT';
  const contractValueDesc = isLinear ? '0.001 BTC' : '$1.00 USD';

  // Math Calculations
  const plannedRiskAmount = equity * (riskPercent / 100);
  const priceDistance = Math.abs(entryPrice - stopPrice);
  const positionSizeBTC = priceDistance > 0 ? plannedRiskAmount / priceDistance : 0;
  const positionNotionalUSD = positionSizeBTC * entryPrice;

  let contractCount = 0;
  if (isLinear) {
    contractCount = Math.floor(positionSizeBTC / 0.001);
  } else {
    // Inverse #27: Each contract is $1 notional
    contractCount = Math.floor(positionNotionalUSD);
  }

  // Margin required
  const initialMarginUSD = leverage > 0 ? positionNotionalUSD / leverage : positionNotionalUSD;

  // Reward and R:R
  const targetDistance = Math.abs(targetPrice - entryPrice);
  const projectedRewardUSD = positionSizeBTC * targetDistance;
  const riskRewardRatio = priceDistance > 0 ? targetDistance / priceDistance : 0;

  // Liquidation Price estimation (Delta maintenance margin approx 0.5%)
  const mmRate = 0.005;
  let estimatedLiqPrice = 0;
  if (direction === 'LONG') {
    estimatedLiqPrice = entryPrice * (1 - 1 / leverage + mmRate);
  } else {
    estimatedLiqPrice = entryPrice * (1 + 1 / leverage - mmRate);
  }

  // Round-trip fee (Delta taker 0.03%, maker 0.01%)
  const estimatedFees = positionNotionalUSD * 0.0003 * 2;

  const handleCopy = () => {
    const text = `Delta Risk Plan [${instrument} ${direction}]
Entry: $${entryPrice.toFixed(1)}
Stop: $${stopPrice.toFixed(1)} (-$${priceDistance.toFixed(1)})
Target: $${targetPrice.toFixed(1)} (R:R 1:${riskRewardRatio.toFixed(2)})
Risk: $${plannedRiskAmount.toFixed(2)} (${riskPercent}%)
Size: ${positionSizeBTC.toFixed(4)} BTC (${contractCount.toLocaleString()} Contracts)
Margin Req (${leverage}x): $${initialMarginUSD.toFixed(2)}
Est Liq: $${estimatedLiqPrice.toFixed(1)}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
      <div className="terminal-card w-full max-w-xl border border-amber-500/40 shadow-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="terminal-header bg-[#0D1424] border-b border-[#1A253D] px-3 py-2 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-base">🛡️</span>
            <div>
              <span className="text-amber-400 font-bold text-xs tracking-wide">Delta Perpetual Risk Sizing Engine</span>
              <span className="text-[10px] text-gray-400 block font-mono">Institutional Capital Safeguard</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white px-2 py-0.5 rounded text-sm font-mono"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 space-y-3 text-xs font-mono overflow-y-auto flex-1">
          {/* Instrument & Direction Switcher */}
          <div className="grid grid-cols-2 gap-2 bg-[#070B12] p-1.5 rounded border border-[#141C2E]">
            {/* Instrument */}
            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Contract Specification</label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setInstrument('BTCUSDT')}
                  className={`btn-terminal text-[10px] py-1 ${isLinear ? 'active' : ''}`}
                >
                  BTCUSDT Linear (0.001)
                </button>
                <button
                  type="button"
                  onClick={() => setInstrument('BTCUSD')}
                  className={`btn-terminal text-[10px] py-1 ${!isLinear ? 'active' : ''}`}
                >
                  BTCUSD Inverse (#27 $1)
                </button>
              </div>
            </div>

            {/* Direction */}
            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Trade Direction</label>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setDirection('LONG')}
                  className={`btn-terminal text-[10px] py-1 ${direction === 'LONG' ? 'btn-terminal-success font-bold' : ''}`}
                >
                  ▲ LONG
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SHORT')}
                  className={`btn-terminal text-[10px] py-1 ${direction === 'SHORT' ? 'btn-terminal-danger font-bold' : ''}`}
                >
                  ▼ SHORT
                </button>
              </div>
            </div>
          </div>

          {/* Equity & Risk % */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-gray-400 block text-[10px] mb-1">Account Equity ($ USD)</label>
              <input
                type="number"
                value={equity}
                onChange={e => setEquity(Number(e.target.value))}
                className="terminal-input w-full"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-gray-400 text-[10px]">Risk Allowed (%):</label>
                <span className="text-amber-400 font-bold text-[11px]">${plannedRiskAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center space-x-1">
                {[0.25, 0.5, 1.0, 2.0, 3.0].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRiskPercent(pct)}
                    className={`btn-terminal text-[9px] px-1.5 py-0.5 flex-1 ${riskPercent === pct ? 'active' : ''}`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Price Levels (Entry, Stop Loss, Take Profit) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Entry */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-gray-400 text-[10px]">Entry ($)</label>
                {currentPrice && (
                  <button
                    type="button"
                    onClick={() => setEntryPrice(currentPrice)}
                    className="text-[9px] text-amber-400 hover:underline"
                    title="Use live mark price"
                  >
                    Mark
                  </button>
                )}
              </div>
              <input
                type="number"
                value={entryPrice}
                onChange={e => setEntryPrice(Number(e.target.value))}
                className="terminal-input w-full"
              />
            </div>

            {/* Stop Loss */}
            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Stop-Loss ($)</label>
              <input
                type="number"
                value={stopPrice}
                onChange={e => setStopPrice(Number(e.target.value))}
                className="terminal-input w-full border-red-500/40 text-red-300"
              />
            </div>

            {/* Target Price */}
            <div>
              <label className="text-gray-400 text-[10px] block mb-1">Take-Profit ($)</label>
              <input
                type="number"
                value={targetPrice}
                onChange={e => setTargetPrice(Number(e.target.value))}
                className="terminal-input w-full border-emerald-500/40 text-emerald-300"
              />
            </div>
          </div>

          {/* Leverage Slider */}
          <div className="bg-[#070B12] p-2 rounded border border-[#141C2E] space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-gray-400">Account Leverage: <strong className="text-white">{leverage}x</strong></span>
              <span className="text-gray-500">Margin Req: <strong className="text-amber-400">${initialMarginUSD.toFixed(1)}</strong></span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={leverage}
              onChange={e => setLeverage(Number(e.target.value))}
              className="w-full h-1.5 bg-[#141C2E] rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[8px] text-gray-500">
              <span>1x (Cash)</span>
              <span>10x (Safe)</span>
              <span>25x</span>
              <span>50x (Max Risk)</span>
            </div>
          </div>

          {/* Math Results Terminal Card */}
          <div className="bg-[#070B12] p-2.5 rounded border border-amber-500/35 space-y-1.5 text-[11px]">
            <div className="flex justify-between border-b border-[#141C2E] pb-1">
              <span className="text-gray-400">Calculated Position Size:</span>
              <span className="text-emerald-400 font-bold text-xs">{positionSizeBTC.toFixed(4)} BTC (${Math.round(positionNotionalUSD).toLocaleString()})</span>
            </div>

            <div className="flex justify-between border-b border-[#141C2E] pb-1">
              <span className="text-gray-400">Delta Contracts to Place ({contractValueDesc}):</span>
              <span className="text-amber-400 font-bold text-xs">{contractCount.toLocaleString()} Contracts</span>
            </div>

            <div className="flex justify-between border-b border-[#141C2E] pb-1">
              <span className="text-gray-400">Risk-to-Reward Ratio:</span>
              <span className={`font-bold ${riskRewardRatio >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                1 : {riskRewardRatio.toFixed(2)} (+${projectedRewardUSD.toFixed(2)})
              </span>
            </div>

            <div className="flex justify-between border-b border-[#141C2E] pb-1">
              <span className="text-gray-400">Estimated Liquidation Price:</span>
              <span className="text-red-400 font-bold">${estimatedLiqPrice.toFixed(1)}</span>
            </div>

            <div className="flex justify-between text-[10px]">
              <span className="text-gray-500">Round-Trip Delta Fees (0.03%):</span>
              <span className="text-gray-400">${estimatedFees.toFixed(2)}</span>
            </div>
          </div>

          {/* Critical Warnings */}
          {stopPrice === entryPrice && (
            <div className="p-2 rounded bg-red-950/40 border border-red-500/40 text-red-400 text-[10px]">
              ⚠️ Invalidation Distance is $0. Stop price must differ from entry price to calculate position sizing.
            </div>
          )}

          {riskPercent > 3.0 && (
            <div className="p-2 rounded bg-amber-950/40 border border-amber-500/40 text-amber-300 text-[10px]">
              ⚠️ High Risk Warning: Risking &gt;3% on a single crypto perpetual trade accelerates drawdown risk.
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] text-gray-500">
              * Delta Exchange rules: Contract Value = {contractValueDesc}. Always respect maintenance margin.
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleCopy}
                className="btn-terminal text-[11px] py-1 px-3"
              >
                {copied ? '✓ Copied' : '📋 Copy Plan'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-terminal-primary text-[11px] py-1 px-3 rounded"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

