import React, { useRef, useEffect, useState } from 'react';

// Heatmap Color Palette based on normalized intensity [0, 1]
function getHeatmapColor(intensity, isBid) {
  if (intensity <= 0) return 'rgba(15, 23, 42, 0.4)';
  if (intensity < 0.25) {
    const t = intensity / 0.25;
    return `rgba(30, 27, 75, ${0.4 + 0.3 * t})`; // Deep indigo/purple
  } else if (intensity < 0.5) {
    const t = (intensity - 0.25) / 0.25;
    return isBid
      ? `rgba(6, 182, 212, ${0.7 + 0.2 * t})` // Cyan for bid
      : `rgba(99, 102, 241, ${0.7 + 0.2 * t})`; // Indigo for ask
  } else if (intensity < 0.75) {
    const t = (intensity - 0.5) / 0.25;
    return isBid
      ? `rgba(34, 197, 94, ${0.8 + 0.2 * t})` // Neon green
      : `rgba(245, 158, 11, ${0.8 + 0.2 * t})`; // Amber
  } else {
    const t = (intensity - 0.75) / 0.25;
    return isBid
      ? `rgba(52, 211, 153, 1.0)` // Bright emerald
      : `rgba(239, 68, 68, 1.0)`; // Flame red
  }
}

export default function HeatmapCanvas({ activeHeatmap, currentPrice, binWidth = 50 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Resize canvas to display dimensions
    const width = containerRef.current ? containerRef.current.clientWidth : 800;
    const height = 340;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Background fill
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    if (!activeHeatmap || activeHeatmap.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting 1-minute orderbook liquidity telemetry...', width / 2, height / 2);
      return;
    }

    // Determine price boundaries
    const prices = activeHeatmap.map(b => b.price_bin);
    const minPrice = Math.min(...prices) - binWidth;
    const maxPrice = Math.max(...prices) + binWidth;
    const priceRange = maxPrice - minPrice || 1;

    // Margin definitions
    const rightMargin = 75;
    const plotWidth = width - rightMargin;

    // Draw horizontal grid lines and liquidity cells
    const cellHeight = Math.max(12, (binWidth / priceRange) * height);

    // Find max liquidity for normalization
    let maxNotional = 1;
    activeHeatmap.forEach(b => {
      const tot = (b.bid_time_weighted || b.bid_close) + (b.ask_time_weighted || b.ask_close);
      if (tot > maxNotional) maxNotional = tot;
    });

    activeHeatmap.forEach(bucket => {
      const y = height - ((bucket.price_bin - minPrice) / priceRange) * height;
      const bidNotional = bucket.bid_time_weighted || bucket.bid_close || 0;
      const askNotional = bucket.ask_time_weighted || bucket.ask_close || 0;
      const total = bidNotional + askNotional;
      const intensity = Math.min(1, total / maxNotional);

      // Render horizontal liquidity band
      const isBid = bidNotional >= askNotional;
      ctx.fillStyle = getHeatmapColor(intensity, isBid);
      ctx.fillRect(0, y - cellHeight / 2, plotWidth, cellHeight - 1);

      // Subtle border for high intensity clusters
      if (intensity > 0.6) {
        ctx.strokeStyle = isBid ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, y - cellHeight / 2, plotWidth, cellHeight - 1);
      }

      // Draw price tick on right axis
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "JetBrains Mono"';
      ctx.textAlign = 'left';
      ctx.fillText(`$${bucket.price_bin.toLocaleString()}`, plotWidth + 8, y + 3);
    });

    // Draw current price line if available
    if (currentPrice && currentPrice >= minPrice && currentPrice <= maxPrice) {
      const priceY = height - ((currentPrice - minPrice) / priceRange) * height;

      ctx.strokeStyle = '#F59E0B';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, priceY);
      ctx.lineTo(plotWidth, priceY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Current Price badge
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(plotWidth, priceY - 9, rightMargin - 4, 18);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px "JetBrains Mono"';
      ctx.fillText(`$${currentPrice.toFixed(1)}`, plotWidth + 6, priceY + 4);
    }
  }, [activeHeatmap, currentPrice, binWidth]);

  return (
    <div ref={containerRef} className="relative w-full h-[340px] bg-[#090D16] rounded select-none">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '340px', display: 'block' }}
      />
      {/* Legend Badge Overlay */}
      <div className="absolute top-2 left-3 flex items-center space-x-3 bg-[#0E131F]/90 backdrop-blur px-2.5 py-1 rounded border border-[#1E2538] text-[10px] font-mono">
        <span className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-gray-300">Bid Depth</span>
        </span>
        <span className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <span className="text-gray-300">Ask Depth</span>
        </span>
        <span className="flex items-center space-x-1">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span className="text-gray-300">Mark Price</span>
        </span>
        <span className="text-gray-500 border-l border-gray-700 pl-2">1m TWAP Aggregation</span>
      </div>
    </div>
  );
}
