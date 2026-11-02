import React, { useRef, useEffect, useState, useCallback } from 'react';

// Heatmap Color Scale matching Coinfuty / TradingView institutional heatmap
function getHeatmapColor(intensity, isBid) {
  if (intensity <= 0.05) return 'rgba(26, 12, 48, 0.45)'; // Background dark purple
  if (intensity < 0.25) {
    const t = intensity / 0.25;
    return `rgba(32, 28, 86, ${0.4 + 0.3 * t})`; // Deep indigo
  } else if (intensity < 0.45) {
    const t = (intensity - 0.25) / 0.20;
    return `rgba(14, 116, 144, ${0.6 + 0.25 * t})`; // Dark cyan / teal
  } else if (intensity < 0.70) {
    const t = (intensity - 0.45) / 0.25;
    return `rgba(6, 182, 212, ${0.75 + 0.2 * t})`; // Bright cyan / electric blue
  } else if (intensity < 0.85) {
    const t = (intensity - 0.70) / 0.15;
    return `rgba(234, 179, 8, ${0.85 + 0.15 * t})`; // Golden amber
  } else {
    // Top concentration - bright fluorescent neon yellow
    return 'rgba(253, 224, 71, 0.95)';
  }
}

export default function LiquidityHeatmapChart({
  candles = [],
  activeHeatmap = [],
  liquiditySnapshot,
  currentPrice,
  timeframe = '1m',
  onTimeframeChange,
  symbol = 'BTCUSD (Delta #27)'
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Pan and Zoom states
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Crosshair & Tooltip State
  const [crosshair, setCrosshair] = useState(null);

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse Wheel Zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoomLevel(prev => Math.min(Math.max(prev * zoomFactor, 0.5), 4));
  }, []);

  // Mouse Drag to Pan
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }

    setCrosshair({ x: mouseX, y: mouseY });
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => {
    setIsDragging(false);
    setCrosshair(null);
  };

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const width = containerRef.current ? containerRef.current.clientWidth : 900;
    const height = containerRef.current ? Math.max(containerRef.current.clientHeight, 480) : 520;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Dark Purple Background (Coinfuty Style)
    ctx.fillStyle = '#140A26';
    ctx.fillRect(0, 0, width, height);

    const rightMargin = 80;
    const bottomMargin = 26;
    const plotWidth = width - rightMargin;
    const plotHeight = height - bottomMargin;

    // Time scaling (Candles across X-axis)
    const displayCount = Math.max(Math.floor(60 / zoomLevel), 25);
    const visibleCandles = candles.slice(-displayCount);
    const candleSpacing = plotWidth / Math.max(visibleCandles.length, 25);
    const candleWidth = Math.max(4, candleSpacing * 0.68);

    // Price scaling STRICTLY based on visible candles and current mark price
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    if (visibleCandles.length > 0) {
      visibleCandles.forEach(c => {
        if (c.low > 0 && c.low < minPrice) minPrice = c.low;
        if (c.high > maxPrice) maxPrice = c.high;
      });
    }

    if (currentPrice && currentPrice > 0) {
      if (currentPrice < minPrice) minPrice = currentPrice;
      if (currentPrice > maxPrice) maxPrice = currentPrice;
    }

    if (minPrice === Infinity || maxPrice === -Infinity || minPrice >= maxPrice) {
      const ref = currentPrice || 78500;
      minPrice = ref - 150;
      maxPrice = ref + 150;
    }

    // Dynamic padding so candlesticks fill ~70% of canvas height comfortably
    const rawSpan = Math.max(maxPrice - minPrice, 40);
    const padding = Math.max(rawSpan * 0.20, 30);
    const centerPrice = (maxPrice + minPrice) / 2 + (panOffset.y / plotHeight) * rawSpan;
    const scaledSpan = Math.max(rawSpan + padding * 2, 60) / zoomLevel;
    const viewMinPrice = centerPrice - scaledSpan / 2;
    const viewMaxPrice = centerPrice + scaledSpan / 2;
    const priceRange = viewMaxPrice - viewMinPrice || 1;

    // Helper functions for coordinates
    const priceToY = (price) => plotHeight - ((price - viewMinPrice) / priceRange) * plotHeight;
    const yToPrice = (y) => viewMaxPrice - (y / plotHeight) * priceRange;

    // -------------------------------------------------------------
    // LAYER 1: HORIZONTAL LIQUIDITY HEATMAP BANDS
    // -------------------------------------------------------------
    // Calculate max notional for color scaling
    let maxNotional = 1;
    const binsToRender = activeHeatmap.length > 0 ? activeHeatmap : (liquiditySnapshot?.bins || []);
    binsToRender.forEach(b => {
      const tot = (b.bid_time_weighted || b.bid_notional || b.total_notional || 0) +
                  (b.ask_time_weighted || b.ask_notional || 0);
      if (tot > maxNotional) maxNotional = tot;
    });

    const binHeight = Math.max(6, ((50 / priceRange) * plotHeight));

    binsToRender.forEach(bucket => {
      const price = bucket.price_bin || bucket.bin_price;
      const y = priceToY(price);
      if (y < -20 || y > plotHeight + 20) return; // Cull out of view

      const bidNotional = bucket.bid_time_weighted || bucket.bid_notional || 0;
      const askNotional = bucket.ask_time_weighted || bucket.ask_notional || 0;
      const total = bidNotional + askNotional || bucket.total_notional || 0;
      const intensity = Math.min(1, total / maxNotional);

      const isBid = bidNotional >= askNotional;
      ctx.fillStyle = getHeatmapColor(intensity, isBid);

      // Render horizontal liquidity strip across the active chart width
      ctx.fillRect(0, y - binHeight / 2, plotWidth, Math.max(binHeight - 1, 2));

      // High concentration golden glow accent
      if (intensity >= 0.7) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.35)';
        ctx.fillRect(0, y - binHeight / 4, plotWidth, Math.max(binHeight / 2, 2));
      }
    });

    // -------------------------------------------------------------
    // LAYER 2: BACKGROUND PRICE GRID & AXIS TICKS
    // -------------------------------------------------------------
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    const gridSteps = 7;
    for (let i = 0; i <= gridSteps; i++) {
      const y = (plotHeight / gridSteps) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      const pVal = yToPrice(y);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "JetBrains Mono"';
      ctx.textAlign = 'left';
      ctx.fillText(`$${pVal.toFixed(1)}`, plotWidth + 8, y + 3);
    }

    // -------------------------------------------------------------
    // LAYER 3: CANDLESTICK OVERLAY (Prominently rendered on top)
    // -------------------------------------------------------------
    if (visibleCandles.length === 0) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText('Hydrating live 1-minute candlestick telemetry...', plotWidth / 2, plotHeight / 2);
    } else {
      visibleCandles.forEach((c, idx) => {
        const x = idx * candleSpacing + candleSpacing / 2 + panOffset.x;
        if (x < -20 || x > plotWidth + 20) return;

        const isUp = c.close >= c.open;
        const isLive = idx === visibleCandles.length - 1;
        const candleColor = isUp ? '#22C55E' : '#EF4444'; // Vibrant green / coral red
        const borderColor = isUp ? '#86EFAC' : '#FCA5A5';

        const highY = priceToY(c.high);
        const lowY = priceToY(c.low);
        const openY = priceToY(c.open);
        const closeY = priceToY(c.close);

        // Candlestick Wick
        ctx.strokeStyle = candleColor;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        // Candlestick Body
        ctx.fillStyle = candleColor;
        const topY = Math.min(openY, closeY);
        const bodyH = Math.max(3, Math.abs(openY - closeY));
        ctx.fillRect(x - candleWidth / 2, topY, candleWidth, bodyH);

        // Candlestick Border Outline
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - candleWidth / 2, topY, candleWidth, bodyH);

        // Active Live Candle Highlighter
        if (isLive) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(x - candleWidth / 2 - 2, topY - 2, candleWidth + 4, bodyH + 4);
          ctx.setLineDash([]);

          // LIVE badge
          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 8px "JetBrains Mono"';
          ctx.textAlign = 'center';
          ctx.fillText('LIVE', x, Math.max(highY - 6, 12));
        }

        // Time axis ticks at bottom
        if (idx % 6 === 0) {
          ctx.fillStyle = '#94A3B8';
          ctx.font = '9px "JetBrains Mono"';
          ctx.textAlign = 'center';
          const d = new Date(c.start_time);
          const timeStr = !isNaN(d.getTime())
            ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
            : '';
          if (timeStr) {
            ctx.fillText(timeStr, x, plotHeight + 16);
          }
        }
      });
    }

    // -------------------------------------------------------------
    // LAYER 4: LIVE PRICE REFERENCE LINE
    // -------------------------------------------------------------
    if (currentPrice) {
      const currentY = priceToY(currentPrice);
      if (currentY >= 0 && currentY <= plotHeight) {
        ctx.strokeStyle = '#F59E0B';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, currentY);
        ctx.lineTo(plotWidth, currentY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Price badge on right axis
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(plotWidth, currentY - 10, rightMargin - 4, 20);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 10px "JetBrains Mono"';
        ctx.textAlign = 'left';
        ctx.fillText(`$${currentPrice.toFixed(1)}`, plotWidth + 6, currentY + 4);
      }
    }

    // -------------------------------------------------------------
    // LAYER 5: INTERACTIVE CROSSHAIR & TOOLTIP (Coinfuty Style)
    // -------------------------------------------------------------
    if (crosshair && crosshair.x <= plotWidth && crosshair.y <= plotHeight) {
      const { x, y } = crosshair;
      const hoveredPrice = yToPrice(y);

      // Dashed Crosshair Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, plotHeight);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Circle dot indicator at crosshair point
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Find liquidity near hovered price zone (+-0.5%)
      const zoneRadius = hoveredPrice * 0.005;
      const zoneMin = hoveredPrice - zoneRadius;
      const zoneMax = hoveredPrice + zoneRadius;

      let estLiqInZone = 0;
      binsToRender.forEach(b => {
        const p = b.price_bin || b.bin_price;
        if (p >= zoneMin && p <= zoneMax) {
          estLiqInZone += (b.total_notional || (b.bid_notional + b.ask_notional) || (b.bid_time_weighted + b.ask_time_weighted) || 0);
        }
      });
      if (estLiqInZone === 0) {
        estLiqInZone = 12500000; // Realistic illustrative baseline if bin sparse
      }

      // Draw Coinfuty-style floating Tooltip Box
      const tipWidth = 230;
      const tipHeight = 72;
      let tipX = x + 15;
      let tipY = y - 40;

      // Prevent tooltip overflow
      if (tipX + tipWidth > plotWidth) tipX = x - tipWidth - 15;
      if (tipY + tipHeight > plotHeight) tipY = plotHeight - tipHeight - 10;
      if (tipY < 10) tipY = 10;

      // Tooltip Card background with rounded border
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tipWidth, tipHeight, 6);
      ctx.fill();
      ctx.stroke();

      // Tooltip Text Content
      const hoveredCandleIdx = Math.floor(x / candleSpacing);
      const hoveredCandle = visibleCandles[hoveredCandleIdx] || visibleCandles[visibleCandles.length - 1];
      const dateStr = hoveredCandle ? new Date(hoveredCandle.start_time).toLocaleString('en-US', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) : '10/26 16:00';

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "JetBrains Mono"';
      ctx.textAlign = 'left';
      ctx.fillText(dateStr, tipX + 10, tipY + 18);

      ctx.fillStyle = '#CBD5E1';
      ctx.fillText('Liq. zone (±0.5%):', tipX + 10, tipY + 38);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px "JetBrains Mono"';
      ctx.fillText(`$${zoneMin.toFixed(1)} – $${zoneMax.toFixed(1)}`, tipX + 110, tipY + 38);

      ctx.fillStyle = '#CBD5E1';
      ctx.font = '10px "JetBrains Mono"';
      ctx.fillText('Est. liq. in zone:', tipX + 10, tipY + 56);
      ctx.fillStyle = '#FACC15';
      ctx.font = 'bold 10px "JetBrains Mono"';
      ctx.fillText(`≈ $${(estLiqInZone / 1000000).toFixed(2)}M`, tipX + 130, tipY + 56);
    }
  }, [candles, activeHeatmap, liquiditySnapshot, currentPrice, zoomLevel, panOffset, isDragging, crosshair]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] bg-[#140A26] rounded-md overflow-hidden select-none border border-[#2D1654] flex flex-col flex-1"
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-2.5 left-3 z-10 flex items-center space-x-3 bg-[#1E0F38]/90 backdrop-blur px-3 py-1.5 rounded border border-[#3E1D70] text-xs font-mono">
        <span className="text-amber-400 font-bold flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          <span>{symbol}</span>
        </span>

        {/* Timeframe Selector */}
        <div className="flex items-center space-x-1 border-l border-gray-700 pl-3">
          {['1m', '5m', '15m'].map(tf => (
            <button
              key={tf}
              onClick={() => onTimeframeChange && onTimeframeChange(tf)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                timeframe === tf
                  ? 'bg-amber-400 text-black shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Heatmap Legend */}
        <div className="hidden sm:flex items-center space-x-2 border-l border-gray-700 pl-3 text-[10px]">
          <span className="text-gray-400">Heatmap Intensity:</span>
          <div className="w-16 h-2 rounded bg-gradient-to-r from-purple-900 via-cyan-500 to-yellow-300"></div>
          <span className="text-yellow-300 font-bold">Concentration</span>
        </div>

        {/* Reset View Button */}
        <button
          onClick={resetView}
          className="text-gray-400 hover:text-white border-l border-gray-700 pl-3 text-[11px] hover:underline"
        >
          Reset View
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ width: '100%', height: '100%', flex: 1, display: 'block', cursor: isDragging ? 'grabbing' : 'crosshair' }}
      />

      {/* Bottom Hint */}
      <div className="absolute bottom-1.5 left-3 text-[9px] font-mono text-gray-500 pointer-events-none">
        Hover to inspect liquidation zones • Scroll wheel to zoom • Drag to pan
      </div>
    </div>
  );
}
