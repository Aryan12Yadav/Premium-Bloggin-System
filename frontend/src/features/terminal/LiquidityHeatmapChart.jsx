import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// Format timestamp into clean date header like "Oct 28, 05:30"
function formatHoverTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hours}:${minutes}`;
}

// Aggregate 1-minute candles into 5-minute or 15-minute candles if needed
function aggregateCandles(candles1m, targetInterval = '5m') {
  if (!candles1m || candles1m.length === 0) return [];
  const span = targetInterval === '15m' ? 15 : 5;

  const buckets = [];
  let current = null;

  candles1m.forEach(c => {
    const d = new Date(c.start_time);
    const minute = d.getMinutes();
    const roundedMin = Math.floor(minute / span) * span;
    d.setMinutes(roundedMin, 0, 0);
    const bucketTime = d.toISOString();

    if (!current || current.start_time !== bucketTime) {
      if (current) buckets.push(current);
      current = {
        symbol: c.symbol,
        interval: targetInterval,
        start_time: bucketTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
        trade_count: c.trade_count || 0,
        is_closed: c.is_closed,
      };
    } else {
      if (c.high > current.high) current.high = c.high;
      if (c.low < current.low) current.low = c.low;
      current.close = c.close;
      current.volume += (c.volume || 0);
      current.trade_count += (c.trade_count || 0);
      current.is_closed = c.is_closed;
    }
  });

  if (current) buckets.push(current);
  return buckets;
}

// Dynamic Candle-based Liquidity Generator (Hyblock/CoinGlass logic)
// Evaluates candlestick swing pivots, liquidity pool formation, and swept void terminations
function computeCandleLiquidityPools(candles) {
  if (!candles || candles.length < 8) return [];

  const pools = [];
  const swingWindow = 4; // 4 bars pivot check

  for (let i = swingWindow; i < candles.length - 2; i++) {
    const c = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;

    for (let j = Math.max(0, i - swingWindow); j <= Math.min(candles.length - 1, i + swingWindow); j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isSwingHigh = false;
      if (candles[j].low <= c.low) isSwingLow = false;
    }

    if (isSwingHigh) {
      // Short liquidation pool sits above swing high
      const poolPrice = Math.round((c.high + 25) / 25) * 25;
      let sweptIdx = -1;
      for (let k = i + 1; k < candles.length; k++) {
        if (candles[k].high >= poolPrice) {
          sweptIdx = k;
          break;
        }
      }

      pools.push({
        type: 'ASK_POOL',
        startIdx: i,
        endIdx: sweptIdx === -1 ? candles.length - 1 : sweptIdx,
        isSwept: sweptIdx !== -1,
        price: poolPrice,
        intensity: Math.min(0.95, 0.45 + (c.volume || 10) / 40),
      });
    }

    if (isSwingLow) {
      // Long liquidation pool sits below swing low
      const poolPrice = Math.round((c.low - 25) / 25) * 25;
      let sweptIdx = -1;
      for (let k = i + 1; k < candles.length; k++) {
        if (candles[k].low <= poolPrice) {
          sweptIdx = k;
          break;
        }
      }

      pools.push({
        type: 'BID_POOL',
        startIdx: i,
        endIdx: sweptIdx === -1 ? candles.length - 1 : sweptIdx,
        isSwept: sweptIdx !== -1,
        price: poolPrice,
        intensity: Math.min(0.95, 0.45 + (c.volume || 10) / 40),
      });
    }
  }

  return pools;
}

// Professional Bookmap-style thermal color & glow configuration
function getHeatmapStyle(intensity, isAsk = false) {
  if (intensity < 0.22) return null;

  if (intensity < 0.45) {
    // Low depth / thin book
    return {
      core: isAsk ? 'rgba(244, 63, 94, 0.36)' : 'rgba(6, 182, 212, 0.36)',
      edge: isAsk ? 'rgba(244, 63, 94, 0.04)' : 'rgba(6, 182, 212, 0.04)',
      halo: null,
      glow: false,
    };
  } else if (intensity < 0.70) {
    // Moderate resting liquidity (Cyan / Green for Bids, Coral for Asks)
    return {
      core: isAsk ? 'rgba(244, 63, 94, 0.58)' : 'rgba(16, 185, 129, 0.58)',
      edge: isAsk ? 'rgba(244, 63, 94, 0.08)' : 'rgba(16, 185, 129, 0.08)',
      halo: isAsk ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
      glow: false,
    };
  } else if (intensity < 0.88) {
    // Dense resting liquidity (Luminous Golden Amber)
    return {
      core: 'rgba(250, 204, 21, 0.82)',
      edge: 'rgba(250, 204, 21, 0.14)',
      halo: 'rgba(250, 204, 21, 0.22)',
      glow: true,
    };
  } else {
    // Ultra Dense Institutional Wall (Fiery Solar Orange)
    return {
      core: 'rgba(249, 115, 22, 0.92)',
      edge: 'rgba(249, 115, 22, 0.18)',
      halo: 'rgba(249, 115, 22, 0.28)',
      glow: true,
    };
  }
}

// Map liquidity intensity to color scale:
function getHeatmapColor(intensity, isAsk = false) {
  const style = getHeatmapStyle(intensity, isAsk);
  return style ? style.core : 'transparent';
}

export default function LiquidityHeatmapChart({
  candles = [],
  activeHeatmap = [],
  heatmapHistory = [],
  liquiditySnapshot,
  currentPrice = 76900,
  timeframe = '1m',
  onTimeframeChange,
  symbol = 'BTCUSDT',
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Viewport & Pan/Zoom
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Toggles for Professional Analysis
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showProfile, setShowProfile] = useState(true);
  const [showSRZones, setShowSRZones] = useState(true);

  // Crosshair state
  const [crosshair, setCrosshair] = useState(null);

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleZoom = (factor) => {
    setZoomLevel(prev => Math.min(Math.max(prev * factor, 0.35), 6));
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91;
    setZoomLevel(prev => Math.min(Math.max(prev * zoomFactor, 0.35), 6));
  }, []);

  // Compute active candles for display
  const activeCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    if (candles[0]?.interval === timeframe) {
      return candles;
    }
    if (timeframe === '5m' || timeframe === '15m') {
      return aggregateCandles(candles, timeframe);
    }
    return candles;
  }, [candles, timeframe]);

  // Extract horizontal orderbook liquidity bins from Go backend
  const horizontalLiquidityBins = useMemo(() => {
    const binMap = new Map();

    if (liquiditySnapshot?.bins && Array.isArray(liquiditySnapshot.bins)) {
      liquiditySnapshot.bins.forEach(b => {
        const p = Math.round(b.bin_price || b.price_bin);
        if (!p) return;
        binMap.set(p, {
          price: p,
          bidNotional: b.bid_notional || 0,
          askNotional: b.ask_notional || 0,
          totalNotional: b.total_notional || ((b.bid_notional || 0) + (b.ask_notional || 0)),
          intensity: b.intensity !== undefined ? b.intensity : 0,
        });
      });
    }

    if (activeHeatmap && Array.isArray(activeHeatmap)) {
      activeHeatmap.forEach(b => {
        const p = Math.round(b.price_bin || b.bin_price);
        if (!p) return;
        const bid = b.bid_time_weighted || b.bid_close || b.bid_notional || 0;
        const ask = b.ask_time_weighted || b.ask_close || b.ask_notional || 0;
        const tot = bid + ask;
        if (!binMap.has(p)) {
          binMap.set(p, {
            price: p,
            bidNotional: bid,
            askNotional: ask,
            totalNotional: tot,
            intensity: 0,
          });
        }
      });
    }

    const arr = Array.from(binMap.values());
    if (arr.length > 0) {
      let maxTot = 1;
      arr.forEach(b => { if (b.totalNotional > maxTot) maxTot = b.totalNotional; });
      arr.forEach(b => {
        if (!b.intensity) b.intensity = Math.min(1.0, b.totalNotional / maxTot);
      });
    }
    return arr;
  }, [activeHeatmap, liquiditySnapshot]);

  // Candle-driven dynamic liquidity pools (shift with swing candles)
  const candleLiquidityPools = useMemo(() => {
    return computeCandleLiquidityPools(activeCandles);
  }, [activeCandles]);

  // Major S/R levels
  const { majorSupport, majorResistance } = useMemo(() => {
    let sup = null;
    let res = null;
    let maxBid = 0;
    let maxAsk = 0;

    horizontalLiquidityBins.forEach(b => {
      if (b.price < currentPrice && b.bidNotional > maxBid) {
        maxBid = b.bidNotional;
        sup = b;
      }
      if (b.price > currentPrice && b.askNotional > maxAsk) {
        maxAsk = b.askNotional;
        res = b;
      }
    });

    return { majorSupport: sup, majorResistance: res };
  }, [horizontalLiquidityBins, currentPrice]);

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
        y: e.clientY - dragStart.y,
      });
    }

    setCrosshair({ x: mouseX, y: mouseY });
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => {
    setIsDragging(false);
    setCrosshair(null);
  };

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const width = containerRef.current ? containerRef.current.clientWidth : 1000;
    const height = containerRef.current ? Math.max(containerRef.current.clientHeight, 450) : 520;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 1. Deep Canvas Background (Obsidian)
    ctx.fillStyle = '#06090F';
    ctx.fillRect(0, 0, width, height);

    const topMargin = 42;
    const rightMargin = 95;
    const bottomMargin = 34;
    const plotWidth = width - rightMargin;
    const plotHeight = height - bottomMargin - topMargin;

    if (plotWidth <= 50 || plotHeight <= 50) return;

    // Time scaling: candles count
    const baseDisplayCount = timeframe === '15m' ? 50 : (timeframe === '5m' ? 80 : 130);
    const displayCount = Math.max(Math.floor(baseDisplayCount / zoomLevel), 20);
    const visibleCandles = activeCandles.slice(-displayCount);
    const candleSpacing = plotWidth / Math.max(visibleCandles.length, 20);
    const candleWidth = Math.max(2, Math.min(18, candleSpacing * 0.72));

    // Price scaling
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
      const ref = currentPrice || 76900;
      minPrice = ref - 300;
      maxPrice = ref + 300;
    }

    const rawSpan = Math.max(maxPrice - minPrice, 50);
    const padding = Math.max(rawSpan * 0.18, 35);
    const centerPrice = (maxPrice + minPrice) / 2 + (panOffset.y / plotHeight) * rawSpan;
    const scaledSpan = Math.max(rawSpan + padding * 2, 60) / zoomLevel;
    const viewMinPrice = centerPrice - scaledSpan / 2;
    const viewMaxPrice = centerPrice + scaledSpan / 2;
    const priceRange = viewMaxPrice - viewMinPrice || 1;

    const priceToY = (price) => topMargin + plotHeight - ((price - viewMinPrice) / priceRange) * plotHeight;
    const yToPrice = (y) => viewMaxPrice - ((y - topMargin) / plotHeight) * priceRange;

    // Dedicated Axis Backgrounds
    ctx.fillStyle = '#080C16';
    ctx.fillRect(plotWidth, 0, rightMargin, height);
    ctx.fillRect(0, topMargin + plotHeight, width, bottomMargin);

    // Axis separator borders
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotWidth + 0.5, 0);
    ctx.lineTo(plotWidth + 0.5, height);
    ctx.moveTo(0, topMargin + plotHeight + 0.5);
    ctx.lineTo(width, topMargin + plotHeight + 0.5);
    ctx.stroke();

    // -------------------------------------------------------------
    // LAYER 1: HORIZONTAL GRIDLINES & PRICE AXIS (Y-AXIS)
    // -------------------------------------------------------------
    const targetSteps = 8;
    const rawStep = priceRange / targetSteps;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / magnitude;
    let stepMultiplier = 1;
    if (residual > 5) stepMultiplier = 10;
    else if (residual > 2) stepMultiplier = 5;
    else if (residual > 1) stepMultiplier = 2;
    const priceStep = Math.max(5, stepMultiplier * magnitude);

    const firstPriceTick = Math.ceil(viewMinPrice / priceStep) * priceStep;

    for (let p = firstPriceTick; p <= viewMaxPrice; p += priceStep) {
      const y = Math.round(priceToY(p)) + 0.5;
      if (y < topMargin || y > topMargin + plotHeight) continue;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(plotWidth, y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.moveTo(plotWidth, y);
      ctx.lineTo(plotWidth + 5, y);
      ctx.stroke();

      ctx.fillStyle = '#E2E8F0';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`$${p.toLocaleString()}`, plotWidth + 9, y + 4);
    }

    // -------------------------------------------------------------
    // LAYER 2: CANDLESTICK-DRIVEN DYNAMIC LIQUIDITY HEATMAP
    // (Shifts as candles form; terminates where swept; untraded pools extend)
    // -------------------------------------------------------------
    if (showHeatmap && visibleCandles.length > 0) {
      const binH = Math.min(12, Math.max(5, Math.abs(priceToY(viewMinPrice) - priceToY(viewMinPrice + 28))));
      const offsetIndex = Math.max(0, activeCandles.length - displayCount);
      const liveCandleIdx = visibleCandles.length - 1;
      const liveCandleX = Math.round(liveCandleIdx * candleSpacing + candleSpacing / 2 + panOffset.x);

      // 2A. Render Historical Candle-Driven Pools (Soft vertical thermal gradient)
      candleLiquidityPools.forEach(pool => {
        const y = Math.round(priceToY(pool.price));
        if (y < topMargin - binH || y > topMargin + plotHeight + binH) return;

        const visStart = Math.max(0, pool.startIdx - offsetIndex);
        const visEnd = Math.min(visibleCandles.length - 1, pool.endIdx - offsetIndex);
        if (visEnd < 0 || visStart >= visibleCandles.length) return;

        const startX = Math.round(visStart * candleSpacing + panOffset.x);
        const endX = Math.round(visEnd * candleSpacing + candleSpacing + panOffset.x);
        const poolW = Math.max(candleSpacing, endX - startX);

        const style = getHeatmapStyle(pool.intensity, pool.type === 'ASK_POOL');
        if (!style) return;

        // Soft vertical thermal gradient for authentic order flow heatmap feel
        const vGrad = ctx.createLinearGradient(0, y - binH / 2, 0, y + binH / 2);
        vGrad.addColorStop(0, style.edge);
        vGrad.addColorStop(0.5, style.core);
        vGrad.addColorStop(1, style.edge);

        ctx.fillStyle = vGrad;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(startX, y - binH / 2, poolW, binH, 2);
          ctx.fill();
        } else {
          ctx.fillRect(startX, y - binH / 2, poolW, binH);
        }

        // If swept, mark swept absorption tick
        if (pool.isSwept && visEnd < visibleCandles.length) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.fillRect(endX - 2, y - binH / 2, 2, binH);
        }
      });

      // 2B. Render Live Orderbook Depth from Go Backend at Right Edge (Subtle Soft Glow & Gradient)
      horizontalLiquidityBins.forEach(bin => {
        const y = Math.round(priceToY(bin.price));
        if (y < topMargin - binH || y > topMargin + plotHeight + binH) return;

        const style = getHeatmapStyle(bin.intensity, bin.price > currentPrice);
        if (!style) return;

        // Resting liquidity starts softly near the active candle and extends to right price axis
        const startX = Math.max(0, liveCandleX - 6);
        const endX = plotWidth;
        const w = endX - startX;
        if (w <= 8) return;

        // Subtle soft luminous halo underlay for dense yellow & orange walls
        if (style.glow && style.halo) {
          const haloH = Math.max(binH * 2.2, 14);
          const haloGrad = ctx.createLinearGradient(startX, y, endX, y);
          haloGrad.addColorStop(0, 'rgba(0,0,0,0)');
          haloGrad.addColorStop(0.20, style.halo);
          haloGrad.addColorStop(0.85, style.halo);
          haloGrad.addColorStop(1.0, 'rgba(0,0,0,0)');

          ctx.fillStyle = haloGrad;
          ctx.fillRect(startX, y - haloH / 2, w, haloH);
        }

        // Core thermal band with smooth horizontal gradient and rounded front tip
        const hGrad = ctx.createLinearGradient(startX, y, endX, y);
        hGrad.addColorStop(0, 'rgba(0,0,0,0)');
        hGrad.addColorStop(0.14, style.core);
        hGrad.addColorStop(0.80, style.core);
        hGrad.addColorStop(1.0, style.edge);

        ctx.fillStyle = hGrad;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(startX, y - binH / 2, w - 1, binH, [3, 0, 0, 3]);
          ctx.fill();
        } else {
          ctx.fillRect(startX, y - binH / 2, w - 1, binH);
        }
      });
    }

    // -------------------------------------------------------------
    // LAYER 3: INSTITUTIONAL S/R ZONES (DEMAND & SUPPLY HIGHLIGHTS)
    // -------------------------------------------------------------
    if (showSRZones) {
      if (majorResistance) {
        const resY = Math.round(priceToY(majorResistance.price)) + 0.5;
        if (resY >= topMargin && resY <= topMargin + plotHeight) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.70)';
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, resY);
          ctx.lineTo(plotWidth, resY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(30, 10, 15, 0.9)';
          ctx.strokeStyle = '#EF4444';
          ctx.beginPath();
          ctx.roundRect(4, resY - 9, 145, 18, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#FCA5A5';
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`SUPPLY: $${majorResistance.price.toLocaleString()}`, 10, resY + 3.5);

          ctx.fillStyle = '#DC2626';
          ctx.beginPath();
          ctx.roundRect(plotWidth + 1, resY - 8, 88, 16, 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`RES $${majorResistance.price.toLocaleString()}`, plotWidth + 4, resY + 3.5);
        }
      }

      if (majorSupport) {
        const supY = Math.round(priceToY(majorSupport.price)) + 0.5;
        if (supY >= topMargin && supY <= topMargin + plotHeight) {
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.70)';
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, supY);
          ctx.lineTo(plotWidth, supY);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = 'rgba(10, 30, 20, 0.9)';
          ctx.strokeStyle = '#22C55E';
          ctx.beginPath();
          ctx.roundRect(4, supY - 9, 145, 18, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#86EFAC';
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`DEMAND: $${majorSupport.price.toLocaleString()}`, 10, supY + 3.5);

          ctx.fillStyle = '#16A34A';
          ctx.beginPath();
          ctx.roundRect(plotWidth + 1, supY - 8, 88, 16, 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`SUP $${majorSupport.price.toLocaleString()}`, plotWidth + 4, supY + 3.5);
        }
      }
    }

    // -------------------------------------------------------------
    // LAYER 4: DEPTH PROFILE (Right Edge Shaded Bars)
    // -------------------------------------------------------------
    if (showProfile && horizontalLiquidityBins.length > 0) {
      let maxNotional = 100000;
      horizontalLiquidityBins.forEach(b => {
        if (b.totalNotional > maxNotional) maxNotional = b.totalNotional;
      });

      horizontalLiquidityBins.forEach(b => {
        const y = Math.round(priceToY(b.price)) + 0.5;
        if (y < topMargin - 15 || y > topMargin + plotHeight + 15) return;

        const isBid = b.price < currentPrice;
        const norm = Math.min(1.0, b.totalNotional / maxNotional);
        const maxBarW = Math.min(plotWidth * 0.22, 160);
        const barW = Math.max(6, norm * maxBarW);
        const barH = 10;
        const barX = plotWidth - barW;

        const grad = ctx.createLinearGradient(barX, y, plotWidth, y);
        if (isBid) {
          grad.addColorStop(0, 'rgba(34, 197, 94, 0.0)');
          grad.addColorStop(1, `rgba(34, 197, 94, ${0.15 + norm * 0.45})`);
        } else {
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.0)');
          grad.addColorStop(1, `rgba(239, 68, 68, ${0.15 + norm * 0.45})`);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(barX, y - barH / 2, barW, barH);

        ctx.fillStyle = isBid ? '#22C55E' : '#EF4444';
        ctx.fillRect(plotWidth - 2, y - barH / 2, 2, barH);
      });
    }

    // -------------------------------------------------------------
    // LAYER 5: CANDLESTICKS (Real-time Feed)
    // -------------------------------------------------------------
    if (visibleCandles.length === 0) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Connecting to real-time ${timeframe} candlestick feed...`, plotWidth / 2, topMargin + plotHeight / 2);
    } else {
      visibleCandles.forEach((c, idx) => {
        const x = Math.round(idx * candleSpacing + candleSpacing / 2 + panOffset.x) + 0.5;
        if (x < -20 || x > plotWidth + 20) return;

        const isUp = c.close >= c.open;
        const isLive = idx === visibleCandles.length - 1;

        const candleColor = isUp ? '#FFFFFF' : '#EF4444';
        const wickColor = isUp ? 'rgba(255, 255, 255, 0.95)' : 'rgba(239, 68, 68, 0.95)';

        const highY = Math.round(priceToY(c.high)) + 0.5;
        const lowY = Math.round(priceToY(c.low)) + 0.5;
        const openY = Math.round(priceToY(c.open)) + 0.5;
        const closeY = Math.round(priceToY(c.close)) + 0.5;

        const topBodyY = Math.min(openY, closeY);
        const bottomBodyY = Math.max(openY, closeY);
        const bodyH = Math.max(1.5, bottomBodyY - topBodyY);

        ctx.strokeStyle = wickColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, topBodyY);
        ctx.moveTo(x, bottomBodyY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        ctx.fillStyle = candleColor;
        ctx.fillRect(x - candleWidth / 2, topBodyY, candleWidth, bodyH);

        if (isUp) {
          ctx.strokeStyle = '#22C55E';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(x - candleWidth / 2, topBodyY, candleWidth, bodyH);
        }

        if (isLive) {
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x - candleWidth / 2 - 1.5, topBodyY - 1.5, candleWidth + 3, bodyH + 3);

          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('LIVE', x, Math.max(highY - 6, topMargin + 10));
        }

        // Time labels (X-Axis)
        const labelInterval = Math.max(1, Math.floor(80 / candleSpacing));
        if (idx % labelInterval === 0 && x > 20 && x < plotWidth - 30) {
          const d = new Date(c.start_time);
          if (!isNaN(d.getTime())) {
            const timeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, topMargin);
            ctx.lineTo(x, topMargin + plotHeight);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.moveTo(x, topMargin + plotHeight);
            ctx.lineTo(x, topMargin + plotHeight + 5);
            ctx.stroke();

            ctx.fillStyle = '#CBD5E1';
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(timeStr, x, topMargin + plotHeight + 20);
          }
        }
      });
    }

    // -------------------------------------------------------------
    // LAYER 6: CURRENT PRICE LINE & RIGHT AXIS PROMINENT BADGE
    // -------------------------------------------------------------
    if (currentPrice) {
      const currentY = Math.round(priceToY(currentPrice)) + 0.5;
      if (currentY >= topMargin && currentY <= topMargin + plotHeight) {
        ctx.strokeStyle = '#2563EB';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, currentY);
        ctx.lineTo(plotWidth, currentY);
        ctx.stroke();
        ctx.setLineDash([]);

        const badgeW = 88;
        const badgeH = 20;
        ctx.fillStyle = '#2563EB';
        ctx.beginPath();
        ctx.roundRect(plotWidth + 1, currentY - badgeH / 2, badgeW, badgeH, 3);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`$${currentPrice.toFixed(1)}`, plotWidth + 6, currentY + 4);
      }
    }

    // -------------------------------------------------------------
    // LAYER 7: INTERACTIVE CROSSHAIR & PRO TRADER HUD
    // -------------------------------------------------------------
    if (crosshair && crosshair.x < plotWidth && crosshair.y >= topMargin && crosshair.y < topMargin + plotHeight) {
      const hoveredPrice = yToPrice(crosshair.y);
      const candleIdx = Math.min(
        visibleCandles.length - 1,
        Math.max(0, Math.floor((crosshair.x - panOffset.x) / candleSpacing))
      );
      const hoveredCandle = visibleCandles[candleIdx];

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(crosshair.x, topMargin);
      ctx.lineTo(crosshair.x, topMargin + plotHeight);
      ctx.moveTo(0, crosshair.y);
      ctx.lineTo(plotWidth, crosshair.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Crosshair Price Badge
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(plotWidth + 1, crosshair.y - 10, 88, 20, 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`$${hoveredPrice.toFixed(1)}`, plotWidth + 6, crosshair.y + 4);

      if (hoveredCandle) {
        const timeStr = formatHoverTime(hoveredCandle.start_time);
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(crosshair.x - 45, topMargin + plotHeight + 2, 90, 20, 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(timeStr.slice(-5), crosshair.x, topMargin + plotHeight + 16);
      }

      // Professional Trader Inspection HUD
      const tipW = 185;
      const tipH = 72;
      let tipX = crosshair.x + 14;
      let tipY = crosshair.y - tipH / 2;
      if (tipX + tipW > plotWidth - 10) tipX = crosshair.x - tipW - 14;
      if (tipY + tipH > topMargin + plotHeight - 10) tipY = topMargin + plotHeight - tipH - 10;
      if (tipY < topMargin + 10) tipY = topMargin + 10;

      ctx.fillStyle = 'rgba(8, 12, 20, 0.95)';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tipW, tipH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('Price Level:', tipX + 8, tipY + 18);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(`$${Math.round(hoveredPrice).toLocaleString()}`, tipX + 85, tipY + 18);

      let zoneType = 'LIQUIDITY VOID';
      let zoneColor = '#94A3B8';
      let riskNote = 'Low support (slippage)';

      const matchedBin = horizontalLiquidityBins.find(b => Math.abs(b.price - hoveredPrice) <= 30);
      if (matchedBin && matchedBin.intensity >= 0.6) {
        if (hoveredPrice > currentPrice) {
          zoneType = 'SUPPLY WALL (RES)';
          zoneColor = '#EF4444';
          riskNote = 'Heavy limit selling';
        } else {
          zoneType = 'DEMAND WALL (SUP)';
          zoneColor = '#22C55E';
          riskNote = 'Heavy limit buying';
        }
      } else if (matchedBin && matchedBin.intensity >= 0.3) {
        zoneType = 'MODERATE DEPTH';
        zoneColor = '#06B6D4';
        riskNote = 'Balanced orderbook';
      }

      ctx.fillStyle = '#94A3B8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('Order Flow:', tipX + 8, tipY + 38);

      ctx.fillStyle = zoneColor;
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(zoneType, tipX + 75, tipY + 38);

      ctx.fillStyle = '#64748B';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(riskNote, tipX + 8, tipY + 58);
    }
  }, [
    activeCandles,
    horizontalLiquidityBins,
    candleLiquidityPools,
    majorSupport,
    majorResistance,
    currentPrice,
    timeframe,
    zoomLevel,
    panOffset,
    isDragging,
    crosshair,
    showHeatmap,
    showProfile,
    showSRZones,
  ]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#06090F] rounded overflow-hidden select-none border border-[#141C2E] flex flex-col flex-1"
    >
      {/* Top Professional Control Ribbon */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between bg-[#0A0E17]/95 backdrop-blur px-3 py-1.5 rounded border border-[#1E293E] text-xs font-mono shadow-md">
        {/* Left: Product & Timeframe */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-white font-bold text-xs">{symbol}</span>
          </div>

          <div className="flex items-center space-x-1 border-l border-gray-800 pl-3">
            <span className="text-gray-500 text-[10px] mr-1">Timeframe:</span>
            {['1m', '5m', '15m'].map(tf => (
              <button
                key={tf}
                onClick={() => onTimeframeChange && onTimeframeChange(tf)}
                className={`btn-terminal text-[11px] px-2 py-0.5 font-bold ${
                  timeframe === tf ? 'active' : ''
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Liquidity Density Legend & Live S/R Levels */}
        <div className="hidden lg:flex items-center space-x-3 text-[10px] text-gray-400 bg-[#070B12] px-3 py-1 rounded border border-[#141C2E]">
          <div className="flex items-center space-x-1.5">
            <span className="text-gray-500 font-semibold">Density:</span>
            <span className="text-gray-400">Low</span>
            <div className="flex items-center space-x-0.5">
              <span className="w-3.5 h-2.5 rounded-sm bg-[#06B6D4]" title="Moderate Liquidity"></span>
              <span className="w-3.5 h-2.5 rounded-sm bg-[#22C55E]" title="High Liquidity"></span>
              <span className="w-3.5 h-2.5 rounded-sm bg-[#FACC15]" title="Dense Liquidity"></span>
              <span className="w-3.5 h-2.5 rounded-sm bg-[#F97316]" title="Dense Wall"></span>
            </div>
            <span className="text-amber-400 font-semibold">Dense</span>
          </div>

          {majorSupport && (
            <>
              <span className="text-gray-700">•</span>
              <span className="text-emerald-400 font-semibold">
                Sup (Demand): ${majorSupport.price.toLocaleString()}
              </span>
            </>
          )}

          {majorResistance && (
            <>
              <span className="text-gray-700">•</span>
              <span className="text-red-400 font-semibold">
                Res (Supply): ${majorResistance.price.toLocaleString()}
              </span>
            </>
          )}
        </div>

        {/* Right: Controls & Toggles */}
        <div className="flex items-center space-x-2">
          {/* Heatmap Toggle */}
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`btn-terminal text-[10px] px-2 py-0.5 ${
              showHeatmap ? 'btn-terminal-primary font-bold' : 'opacity-60'
            }`}
            title="Toggle Liquidity Heatmap"
          >
            🔥 Heatmap {showHeatmap ? 'ON' : 'OFF'}
          </button>

          {/* S/R Institutional Levels Toggle */}
          <button
            onClick={() => setShowSRZones(!showSRZones)}
            className={`btn-terminal text-[10px] px-2 py-0.5 ${
              showSRZones ? 'btn-terminal-warning font-bold' : 'opacity-60'
            }`}
            title="Toggle Demand / Supply Institutional Zones"
          >
            🎯 S/R Zones {showSRZones ? 'ON' : 'OFF'}
          </button>

          {/* Depth Profile Toggle */}
          <button
            onClick={() => setShowProfile(!showProfile)}
            className={`btn-terminal text-[10px] px-2 py-0.5 ${
              showProfile ? 'btn-terminal-success font-bold' : 'opacity-60'
            }`}
            title="Toggle Orderbook Depth Profile"
          >
            📊 Depth {showProfile ? 'ON' : 'OFF'}
          </button>

          {/* Zoom Buttons */}
          <div className="flex items-center space-x-1 border-l border-gray-800 pl-2">
            <button
              onClick={() => handleZoom(1.2)}
              className="btn-terminal text-[11px] px-2 py-0.5"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => handleZoom(0.83)}
              className="btn-terminal text-[11px] px-2 py-0.5"
              title="Zoom Out"
            >
              -
            </button>
            <button
              onClick={resetView}
              className="btn-terminal text-[10px] px-2 py-0.5 text-amber-400 hover:text-amber-300"
              title="Auto-Fit Price View"
            >
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* Main Candlestick & Heatmap Canvas */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '100%',
          height: '100%',
          flex: 1,
          display: 'block',
          cursor: isDragging ? 'grabbing' : 'crosshair',
        }}
      />
    </div>
  );
}
