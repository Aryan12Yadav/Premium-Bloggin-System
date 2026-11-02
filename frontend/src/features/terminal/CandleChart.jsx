import React, { useRef, useEffect, useState } from 'react';

export default function CandleChart({ candles = [], currentPrice, timeframe = '1m', onTimeframeChange }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const width = containerRef.current ? containerRef.current.clientWidth : 800;
    const height = 260;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    if (!candles || candles.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Accumulating tick trades for candlestick telemetry...', width / 2, height / 2);
      return;
    }

    const rightMargin = 75;
    const bottomMargin = 20;
    const plotWidth = width - rightMargin;
    const plotHeight = height - bottomMargin;

    // Price scaling
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 1;

    candles.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    });

    if (minPrice === Infinity) minPrice = 78000;
    if (maxPrice === -Infinity) maxPrice = 79000;
    const pricePadding = (maxPrice - minPrice) * 0.1 || 50;
    minPrice -= pricePadding;
    maxPrice += pricePadding;
    const priceRange = maxPrice - minPrice;

    // Grid lines
    ctx.strokeStyle = '#151C2C';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (plotHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      const pVal = maxPrice - (i / 5) * priceRange;
      ctx.fillStyle = '#64748B';
      ctx.font = '9px "JetBrains Mono"';
      ctx.textAlign = 'left';
      ctx.fillText(`$${pVal.toFixed(1)}`, plotWidth + 8, y + 3);
    }

    // Render Candles
    const barSpacing = plotWidth / Math.max(candles.length, 20);
    const candleWidth = Math.max(3, barSpacing * 0.7);

    candles.forEach((c, idx) => {
      const x = idx * barSpacing + barSpacing / 2;
      const isUp = c.close >= c.open;
      const candleColor = isUp ? '#22C55E' : '#EF4444';

      const highY = plotHeight - ((c.high - minPrice) / priceRange) * plotHeight;
      const lowY = plotHeight - ((c.low - minPrice) / priceRange) * plotHeight;
      const openY = plotHeight - ((c.open - minPrice) / priceRange) * plotHeight;
      const closeY = plotHeight - ((c.close - minPrice) / priceRange) * plotHeight;

      // Draw Wick
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw Body
      ctx.fillStyle = candleColor;
      const topY = Math.min(openY, closeY);
      const bodyH = Math.max(2, Math.abs(openY - closeY));
      ctx.fillRect(x - candleWidth / 2, topY, candleWidth, bodyH);

      // Volume bar at bottom
      const volH = (c.volume / maxVol) * 40;
      ctx.fillStyle = isUp ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(x - candleWidth / 2, plotHeight - volH, candleWidth, volH);
    });
  }, [candles, currentPrice]);

  return (
    <div ref={containerRef} className="relative w-full h-[260px] bg-[#090D16] rounded overflow-hidden select-none">
      {/* Timeframe Bar */}
      <div className="absolute top-2 left-3 z-10 flex items-center space-x-1 bg-[#0E131F]/90 backdrop-blur px-1.5 py-1 rounded border border-[#1E2538] text-[10px] font-mono">
        {['1m', '5m', '15m'].map(tf => (
          <button
            key={tf}
            onClick={() => onTimeframeChange && onTimeframeChange(tf)}
            className={`px-2 py-0.5 rounded transition ${
              timeframe === tf ? 'bg-amber-500 text-black font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: '260px', display: 'block' }} />
    </div>
  );
}
