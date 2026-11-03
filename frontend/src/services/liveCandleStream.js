/**
 * Live Realtime Candlestick Ingestion Service (Binance Public REST & WebSocket)
 * Streams real-time 1m & 5m BTCUSDT candles with tick-by-tick bar updates and zero latency.
 */

export class LiveCandleStream {
  constructor({ symbol = 'BTCUSDT', interval = '1m', onCandleUpdate, onSnapshot }) {
    this.symbol = symbol.toUpperCase();
    this.interval = interval;
    this.onCandleUpdate = onCandleUpdate;
    this.onSnapshot = onSnapshot;
    this.ws = null;
    this.isDestroyed = false;
    this.reconnectTimer = null;
    this.candles = [];
  }

  async start() {
    this.isDestroyed = false;
    await this.fetchHistoricalCandles();
    this.connectWebSocket();
  }

  async fetchHistoricalCandles() {
    const endpoints = [
      `https://api.binance.com/api/v3/klines?symbol=${this.symbol}&interval=${this.interval}&limit=500`,
      `https://data-api.binance.vision/api/v3/klines?symbol=${this.symbol}&interval=${this.interval}&limit=500`,
      `https://api1.binance.com/api/v3/klines?symbol=${this.symbol}&interval=${this.interval}&limit=500`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const rawKlines = await res.json();
        if (!Array.isArray(rawKlines) || rawKlines.length === 0) continue;

        const formatted = rawKlines.map(k => ({
          symbol: this.symbol,
          interval: this.interval,
          start_time: new Date(k[0]).toISOString(),
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          trade_count: k[8],
          is_closed: true,
        }));

        this.candles = formatted;
        if (this.onSnapshot) {
          this.onSnapshot(this.candles);
        }
        return;
      } catch (err) {
        // try next endpoint
      }
    }
    console.warn('[LiveCandleStream] All endpoints failed to fetch historical candles');
  }

  connectWebSocket() {
    if (this.isDestroyed) return;
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }

    const streamName = `${this.symbol.toLowerCase()}@kline_${this.interval}`;
    const wsUrl = `wss://stream.binance.com:9443/ws/${streamName}`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      console.log(`[LiveCandleStream] Connected to live feed: ${streamName}`);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (!msg || !msg.k) return;

        const k = msg.k;
        const liveCandle = {
          symbol: this.symbol,
          interval: this.interval,
          start_time: new Date(k.t).toISOString(),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
          trade_count: k.n,
          is_closed: k.x,
        };

        if (this.onCandleUpdate) {
          this.onCandleUpdate(liveCandle);
        }
      } catch (err) {
        console.error('[LiveCandleStream] Message parse error:', err);
      }
    };

    ws.onclose = () => {
      if (!this.isDestroyed) {
        this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 2000);
      }
    };

    ws.onerror = (err) => {
      console.warn('[LiveCandleStream] WebSocket error:', err);
      try { ws.close(); } catch (e) {}
    };
  }

  setInterval(newInterval) {
    if (this.interval === newInterval) return;
    this.interval = newInterval;
    this.start();
  }

  destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
  }
}
