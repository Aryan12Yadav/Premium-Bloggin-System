# BTCUSD LIQUIDITY INTELLIGENCE & AI MARKET RESEARCH PLATFORM
## Complete Technical Architecture, Mathematical Logic & Implementation Specification

**Project Type:** Personal Cryptocurrency Trading Intelligence System  
**Primary Exchange:** Delta Exchange  
**Primary Trading Instrument:** BTCUSD Perpetual  
**Initial Users:** 1 (Personal Use)  
**Primary Objective:** Real-time liquidity tracking, market volatility analysis, AI-based research and informed trading decisions.  
**Deployment Platform:** Northflank

---

# 1. PROJECT OVERVIEW

## 1.1 Project Vision

The objective is to develop a real-time BTCUSD Liquidity Intelligence and AI Market Research Platform that analyses cryptocurrency market data from Delta Exchange.

The system will collect live orderbook data, market trades, prices, candles and available derivatives metrics.

A dedicated trading terminal will visualize market liquidity through a 1-minute horizontal liquidity heatmap.

The platform will also analyse historical and real-time market behaviour and generate AI-powered research blogs explaining why particular market movements occurred.

The user will use this information to make manual trading decisions and execute real trades on Delta Exchange.

## 1.2 Core Objectives

1. Collect real-time BTCUSD market data.
2. Track bid-side and ask-side liquidity.
3. Generate a live 1-minute liquidity heatmap.
4. Identify liquidity concentration and withdrawal.
5. Detect liquidity sweeps and potential absorption.
6. Analyse market volatility.
7. Compare current market conditions with historical sessions.
8. Generate AI-based research blogs.
9. Provide higher-timeframe confirmation using 5-minute and 15-minute analysis.
10. Provide risk-management calculations before real trading.

## 1.3 System Philosophy

The platform must prioritize:

- Data accuracy.
- Low processing latency.
- Reliable WebSocket connections.
- Correct orderbook synchronization.
- Transparent mathematical calculations.
- Historical data integrity.
- Evidence-based AI research.
- Risk management.

The system must never fabricate actual liquidation events, market activity or historical observations.

---

# 2. TECHNOLOGY STACK

## 2.1 Backend and Infrastructure

| Component | Technology | Responsibility |
|---|---|---|
| Real-time Engine | Go | Market data processing |
| HTTP Framework | Gin | Go service APIs |
| WebSocket Client | Gorilla WebSocket | Exchange connectivity |
| Concurrency | Goroutines + Channels | Concurrent processing |
| Frontend | React + Vite | Trading terminal |
| Heatmap Renderer | HTML Canvas | Liquidity visualization |
| Candlestick Charts | Lightweight Charts | Price visualization |
| Research Backend | Python + FastAPI | Research processing |
| Data Analysis | NumPy + Pandas | Statistical calculations |
| Cache | Redis | Real-time data distribution |
| Database | PostgreSQL | Persistent storage |
| Time-Series Extension | TimescaleDB | Historical market data |
| AI | LLM API | Research generation |
| Deployment | Northflank | Production hosting |
| Containerization | Docker | Application packaging |

## 2.2 Why Go?

Go will handle the most time-sensitive component.

Responsibilities:

- Maintain Delta Exchange WebSocket connections.
- Process incoming orderbook updates.
- Maintain the local orderbook.
- Calculate liquidity metrics.
- Aggregate 1-minute liquidity data.
- Calculate market volatility.
- Publish real-time data.

Go is selected because its concurrency model and deployment simplicity suit this workload.

Rust is not required for the initial implementation. Performance optimization should be driven by actual profiling rather than assumptions.

## 2.3 Why React?

React will provide an independent trading terminal.

HTML Canvas will render the heatmap instead of creating thousands of individual DOM elements.

React will handle:
- Terminal navigation.
- Market selection.
- Timeframe controls.
- Heatmap settings.
- Research blog display.
- Risk calculations.
- Market status.

The Canvas rendering engine will handle high-frequency visual updates independently of React component rendering.

---

# 3. COMPLETE SYSTEM ARCHITECTURE

## 3.1 High-Level Architecture

```text
                DELTA EXCHANGE
                       |
              Public WebSocket
                       |
                       v
                GO MARKET ENGINE
                       |
          +------------+-------------+
          |            |             |
          v            v             v
      Orderbook      Trade         Candle
      Processor      Processor     Processor
          |            |             |
          +------------+-------------+
                       |
                       v
               LIQUIDITY ENGINE
                       |
          +------------+-------------+
          |            |             |
          v            v             v
       Liquidity     Volatility    Event
       Analyzer      Analyzer      Detector
          |            |             |
          +------------+-------------+
                       |
                       v
                  REDIS STREAMS
                       |
             +---------+---------+
             |                   |
             v                   v
        REACT TERMINAL      PYTHON SERVICE
             |                   |
             v                   v
        LIVE HEATMAP        RESEARCH ENGINE
                                 |
                                 v
                              LLM API
                                 |
                                 v
                          AI RESEARCH BLOG
                                 |
                                 v
                         POSTGRESQL / TIMESCALE
```

## 3.2 Data Flow

The complete data flow:

1. Delta Exchange sends market data.
2. Go receives WebSocket messages.
3. Go validates timestamps and sequence information.
4. Orderbook processor maintains the latest market state.
5. Liquidity engine calculates price-level liquidity.
6. Volatility engine calculates market metrics.
7. Event detector identifies significant market events.
8. Redis distributes processed market data.
9. React renders the live heatmap.
10. Python receives structured analytical data.
11. Python performs historical comparisons.
12. LLM generates research content.
13. PostgreSQL stores research articles and historical records.

The LLM must not receive every raw market tick.

It should receive structured analytical summaries and relevant historical evidence.

---

# 4. DELTA EXCHANGE MARKET DATA INTEGRATION

## 4.1 Data Sources

Primary source: Delta Exchange public market APIs.

Required market data:

| Data | Purpose |
|---|---|
| Trades | Actual executed transactions |
| Orderbook | Bid and ask liquidity |
| Mark Price | Derivatives reference price |
| Candlesticks | Historical price analysis |
| Open Interest | Outstanding derivatives exposure |
| Funding Rate | Perpetual market funding information |
| Instrument Information | Contract specifications |

Potential WebSocket channels include:

- trades
- ob_l2
- ob_updates, where supported
- mark_price
- candlesticks

Historical candle information can be retrieved through the historical candles REST API.

Exact endpoints, channel names, subscription payloads, authentication requirements and sequence rules must be verified against the current Delta Exchange API documentation before implementation.

Official documentation:

https://docs.delta.exchange/

## 4.2 Market Data Processing

Every incoming message should contain or be associated with:

- Exchange timestamp.
- Local receive timestamp.
- Instrument identifier.
- Event type.
- Price.
- Quantity.
- Sequence number, where available.

Example normalized market event:

```json
{
  "exchange": "delta",
  "symbol": "BTCUSD",
  "event_type": "trade",
  "exchange_timestamp": 1793520000000,
  "received_timestamp": 1793520000012,
  "price": 105000,
  "quantity": 0.05,
  "side": "buy"
}
```

This is an illustrative internal schema, not an actual Delta subscription response.

## 4.3 Orderbook Synchronization

This is one of the most critical components.

The Go engine must maintain a correct local orderbook.

Process:

1. Subscribe to the appropriate orderbook feed.
2. Receive a valid initial snapshot.
3. Build bid and ask price-level maps.
4. Apply incremental updates.
5. Validate sequence continuity if provided.
6. Detect missing or invalid updates.
7. Resynchronize using a fresh snapshot.
8. Mark the orderbook invalid until synchronization completes.

Important:

Never calculate a liquidity heatmap using an incomplete or stale orderbook.

Use a clear data-health status:

- LIVE
- DELAYED
- STALE
- RESYNCING
- DISCONNECTED

If Delta's selected channel exposes only a limited number of levels, the terminal must not claim that it represents complete exchange-wide orderbook liquidity.

---

# 5. LIVE LIQUIDITY TRACKER TERMINAL

## 5.1 Main Objective

The terminal will identify visible market liquidity at different BTCUSD price levels.

The user should be able to understand:

- Where large bid orders are positioned.
- Where large ask orders are positioned.
- Which price levels have high liquidity concentration.
- Where liquidity is increasing.
- Where liquidity is disappearing.
- How liquidity changes as price moves.

## 5.2 Heatmap Visualization

The heatmap will use:

- X-axis: Time.
- Y-axis: Price.
- Horizontal bands: Price-level liquidity.
- Color intensity: Relative liquidity concentration.

The heatmap should update continuously.

The 1-minute timeframe represents the aggregation interval, not a restriction that the screen can update only once per minute.

## 5.3 Price Binning

The raw orderbook contains many individual price levels.

For visualization, group them into price bins.

Let:

- P = Individual price.
- ΔP = Price bin width.
- P₀ = Reference price.

Price bin:

\[
Bin(P)=\left\lfloor\frac{P-P_0}{\Delta P}\right\rfloor
\]

Example:

Suppose BTCUSD prices are:

105000, 105010, 105020, 105030.

If the bin width is $50, these levels can be grouped into a single price region.

The bin width must be configurable and should respect instrument tick size.

## 5.4 Bid Liquidity Calculation

Bid liquidity represents resting buy limit orders.

For price bin j:

\[
BidLiquidity_j=\sum_{i \in j} P_i \times Q_i
\]

Where:

- Pᵢ = Order price.
- Qᵢ = Order quantity.

## 5.5 Ask Liquidity Calculation

Ask liquidity represents resting sell limit orders.

\[
AskLiquidity_j=\sum_{i \in j} P_i \times Q_i
\]

Both values are expressed as notional value in quote currency, subject to the instrument's contract multiplier and quantity conventions.

Do not assume that raw contract quantity always equals BTC quantity.

Verify the BTCUSD instrument specification before calculating notional exposure.

## 5.6 Total Liquidity

\[
TotalLiquidity_j=BidLiquidity_j+AskLiquidity_j
\]

This gives the combined visible resting liquidity at a price region.

## 5.7 Orderbook Imbalance

Calculate the relative difference between bid and ask liquidity.

\[
Imbalance=
\frac{BidLiquidity-AskLiquidity}
{BidLiquidity+AskLiquidity}
\]

Interpretation:

| Value | Interpretation |
|---|---|
| +0.70 | Strong bid-side dominance |
| +0.30 | Moderate bid-side dominance |
| 0.00 | Balanced |
| -0.30 | Moderate ask-side dominance |
| -0.70 | Strong ask-side dominance |

These are illustrative interpretation thresholds, not universal trading signals.

## 5.8 Liquidity Concentration

Identify price bins with unusually high liquidity.

Calculate a rolling baseline:

\[
Mean_L=\frac{1}{N}\sum_{i=1}^{N}L_i
\]

\[
Std_L=\sqrt{\frac{1}{N}
\sum_{i=1}^{N}(L_i-Mean_L)^2}
\]

Liquidity Z-score:

\[
Z_L=\frac{L_{current}-Mean_L}{Std_L}
\]

A high positive Z-score indicates liquidity above its historical baseline.

Use separate baselines for bid and ask liquidity.

Do not compare liquidity levels without accounting for distance from the current market price.

## 5.9 Liquidity Persistence

A large order appearing for only one update may not be meaningful.

Track how long liquidity remains visible.

For a price bin:

\[
Persistence=
\frac{\text{Time bin has significant liquidity}}
{\text{Total observed time}}
\times100
\]

Example:

If a price level has significant liquidity for 45 seconds in a 60-second window:

\[
Persistence=75\%
\]

Persistence helps distinguish sustained visible liquidity from short-lived orderbook changes.

It does not prove that the orders will remain available.

---

# 6. ONE-MINUTE LIQUIDITY AGGREGATION

## 6.1 Aggregation Logic

The system must maintain continuous orderbook updates and calculate one-minute historical summaries.

For every price bin, maintain:

1. Average bid liquidity.
2. Average ask liquidity.
3. Maximum bid liquidity.
4. Maximum ask liquidity.
5. Minimum bid liquidity.
6. Minimum ask liquidity.
7. Opening liquidity.
8. Closing liquidity.
9. Liquidity additions.
10. Liquidity removals.
11. Persistence.
12. Data coverage.

## 6.2 Average Liquidity

Use time-weighted averages rather than simply averaging incoming messages.

\[
AverageLiquidity=
\frac{1}{T}\int_0^T L(t)\,dt
\]

For discrete observations:

\[
AverageLiquidity=
\frac{\sum_i L_i\Delta t_i}{T}
\]

This prevents periods with more frequent WebSocket messages from receiving disproportionate weight.

## 6.3 Maximum Liquidity

\[
MaxLiquidity=\max(L_1,L_2,\ldots,L_n)
\]

## 6.4 Net Liquidity Change

\[
NetChange=L_{close}-L_{open}
\]

Positive value means visible liquidity increased.

Negative value means visible liquidity decreased.

## 6.5 Liquidity Added and Removed

Track updates at individual price levels.

For a particular price:

\[
Added=\sum_i\max(0,Q_i-Q_{i-1})
\]

\[
Removed=\sum_i\max(0,Q_{i-1}-Q_i)
\]

These calculations are valid only when consecutive orderbook states are correctly synchronized.

Important distinction:

Removed quantity is not necessarily cancelled quantity. It may have been executed, replaced, repriced or removed through other exchange-side changes.

Correlate orderbook changes with actual trade events before classifying liquidity withdrawal or execution.

---

# 7. HEATMAP COLOR INTENSITY

The heatmap must represent liquidity strength visually.

Do not use arbitrary colors without a defined mathematical scale.

Use a normalized value.

\[
Intensity=
\frac{L-L_{min}}
{L_{max}-L_{min}}
\]

Result:

- 0 = Lowest liquidity.
- 0.5 = Medium liquidity.
- 1 = Highest liquidity.

For better visualization, use a rolling percentile-based normalization.

Example:

- Below 50th percentile: Weak liquidity.
- 50th–75th percentile: Moderate liquidity.
- 75th–90th percentile: High liquidity.
- Above 90th percentile: Very high liquidity.

Keep the scale consistent across the selected comparison window.

Use separate bid and ask layers.

Historical heatmap cells should preserve the values calculated at that time. Do not recolor historical cells using only the latest orderbook.

---

# 8. LIQUIDITY EVENT DETECTION

The system should detect market events using mathematical conditions.

These events will be used both in the terminal and AI research engine.

## 8.1 Liquidity Sweep Detection

A liquidity sweep candidate occurs when price trades through a previously identified liquidity level.

Detection conditions:

1. Significant liquidity existed at a price level.
2. Price traded through that level.
3. Trade volume increased around the event.
4. Orderbook liquidity changed.
5. Subsequent price action is observed.

A sweep must not be classified solely because a candle wick crossed a price level.

The engine should classify:

- Potential sweep.
- Confirmed trade-through.
- Rejection after sweep.
- Continuation after sweep.

The label must describe observed evidence rather than imply hidden institutional activity.

## 8.2 Liquidity Absorption

Absorption is a potential condition in which aggressive market orders execute while price movement remains relatively limited.

Example:

Large sell market volume occurs near a price level, but price does not move down proportionally and bid liquidity replenishes.

Trade direction should be derived from the exchange's actual aggressor-side information, if available.

A simplified metric:

\[
AbsorptionRatio=
\frac{AggressiveTradeVolume}
{|\Delta Price|+\epsilon}
\]

A high ratio suggests substantial executed volume relative to price movement.

Use consistent price and volume units and calibrate this metric against historical observations.

This is an indicator, not proof of hidden orders.

## 8.3 Liquidity Withdrawal

Detect when visible resting liquidity decreases significantly.

\[
WithdrawalRatio=
\frac{L_{previous}-L_{current}}
{L_{previous}}
\]

A positive value indicates a decrease.

Correlate with executed trades:

- If corresponding trades occurred, some reduction may be execution.
- If no matching trades occurred, cancellation or repricing may be more plausible.
- If data is incomplete, classification should remain uncertain.

---

# 9. MARKET VOLATILITY ENGINE

## 9.1 One-Minute Returns

Let:

- Pₜ = Current price.
- Pₜ₋₁ = Previous minute closing price.

Simple return:

\[
R_t=\frac{P_t-P_{t-1}}{P_{t-1}}
\]

Log return:

\[
r_t=\ln\left(\frac{P_t}{P_{t-1}}\right)
\]

Log returns will be used for historical statistical calculations.

## 9.2 Realized Volatility

For a rolling window of N one-minute returns:

\[
RV=\sqrt{\sum_{i=1}^{N}r_i^2}
\]

Annualized volatility can be calculated separately if required:

\[
AnnualizedRV=RV\times\sqrt{525600}
\]

Here 525600 represents minutes in a 365-day year.

Do not confuse annualized volatility with actual one-minute volatility.

## 9.3 Volatility Z-score

\[
Z_v=
\frac{RV_{current}-Mean(RV)}
{Std(RV)}
\]

Use this to identify abnormal volatility relative to a historical baseline.

## 9.4 Additional Volatility Metrics

The engine should also calculate:

- High-low range.
- ATR.
- Rolling standard deviation.
- Trading volume changes.
- Price acceleration.
- Spread expansion.
- Orderbook depth changes.

ATR:

\[
TR=\max(H-L,|H-C_{prev}|,|L-C_{prev}|)
\]

Average True Range:

\[
ATR_n=SMA(TR,n)
\]

Use 1-minute calculations for fast market conditions and higher-timeframe calculations for context.

---

# 10. MULTI-TIMEFRAME ANALYSIS

The terminal will primarily use 1-minute liquidity tracking.

However, trade decisions must consider 5-minute and 15-minute market structure.

## 10.1 One-Minute

Purpose:

- Liquidity concentration.
- Orderbook imbalance.
- Liquidity additions and removals.
- Trade flow.
- Short-term volatility.
- Sweep candidates.

## 10.2 Five-Minute

Purpose:

- Short-term market structure.
- Local support and resistance.
- Volatility confirmation.
- Price reaction after liquidity events.

## 10.3 Fifteen-Minute

Purpose:

- Broader trend.
- Major price structure.
- Historical liquidity regions.
- Higher-timeframe volatility regime.

## 10.4 Timeframe Confirmation

Example research scenario:

- 15m: Price structure is bullish.
- 5m: Price is approaching a significant liquidity region.
- 1m: Ask-side liquidity decreases and buying pressure increases.

The system can classify this as a potential bullish setup.

It must not automatically classify it as a confirmed BUY signal.

---

# 11. AI MARKET RESEARCH ENGINE

## 11.1 Objective

The AI Research Engine will convert analytical market data into understandable research articles.

It should explain:

- What happened?
- When did it happen?
- Which price levels were involved?
- What changed in the orderbook?
- Was volatility unusually high?
- What historical conditions were similar?
- What evidence supports the interpretation?
- What remains uncertain?

The AI must not generate generic articles without supporting market evidence.

## 11.2 Data Sources

The research engine will use:

1. Delta Exchange trades.
2. Delta Exchange orderbook.
3. Delta Exchange mark price.
4. Historical candles.
5. Open interest, when available.
6. Funding rates, when available.
7. Go engine's calculated liquidity metrics.
8. Historical records stored in PostgreSQL/TimescaleDB.

## 11.3 Eight Research Categories

### A. Liquidity Analysis

Example:

"Bitcoin Liquidity Concentration: Where Are Large Orders Positioned?"

Content:

- Highest bid liquidity.
- Highest ask liquidity.
- Liquidity concentration.
- Liquidity persistence.
- Price-level comparison.
- Historical liquidity changes.

### B. Liquidity Sweeps

Example:

"Bitcoin Traded Through a Major Liquidity Zone: What Happened Next?"

Content:

- Previous liquidity levels.
- Trade-through evidence.
- Trading volume.
- Orderbook changes.
- Price recovery or continuation.

### C. Liquidity Absorption

Example:

"Large Sell Pressure Was Absorbed Near Bitcoin Support"

Content:

- Aggressive sell volume.
- Price reaction.
- Bid replenishment.
- Absorption ratio.
- Subsequent price movement.

### D. Orderbook Imbalance

Example:

"Buy-Side Liquidity Increased While Bitcoin Price Remained Flat"

Content:

- Bid and ask liquidity.
- Imbalance ratio.
- One-minute changes.
- Higher-timeframe context.

### E. Liquidity Withdrawal

Example:

"Why Bitcoin Ask-Side Liquidity Decreased Within Minutes"

Content:

- Visible liquidity removal.
- Trade correlation.
- Spread changes.
- Possible market implications.

### F. Volatility Research

Example:

"Why Bitcoin Volatility Increased During the Asian Trading Session"

Content:

- One-minute returns.
- Realized volatility.
- Volume changes.
- Orderbook depth.
- Spread expansion.
- Open interest and funding changes.

### G. Liquidation Research

Example:

"Estimated Bitcoin Liquidation Clusters Around Key Price Levels"

Content:

- Available actual liquidation events.
- Estimated liquidation zones.
- Open interest.
- Leverage assumptions.
- Price reaction.

Estimated liquidation zones must always be labelled as estimates.

Public orderbook data cannot establish the exact leverage and liquidation price of all market participants.

### H. Historical Comparison

Example:

"How Current Bitcoin Liquidity Conditions Compare With Previous Sessions"

Content:

- Historical liquidity concentration.
- Similar volatility regimes.
- Previous price reactions.
- Volume comparison.
- Observed similarities and differences.

---

# 12. AI RESEARCH ARTICLE STRUCTURE

Every article should follow a standard structure.

1. Research Title.
2. Executive Summary.
3. Market Snapshot.
4. Price Analysis.
5. Liquidity Analysis.
6. Volatility Analysis.
7. Important Market Events.
8. Historical Comparison.
9. AI Interpretation.
10. Bullish Scenario.
11. Bearish Scenario.
12. Invalidation Conditions.
13. Risk Factors.
14. Conclusion.
15. Data Sources and Timestamps.

Each article should include:

- Instrument.
- Analysis timeframe.
- Start and end timestamps.
- Data coverage.
- Data freshness.
- Calculation methodology.
- Evidence references.

AI should distinguish between measured facts, statistical interpretations and hypotheses.

---

# 13. AI RESEARCH GENERATION PIPELINE

The AI model must not receive raw WebSocket messages continuously.

Instead:

```text
DELTA EXCHANGE
      |
      v
GO MARKET ENGINE
      |
      v
ANALYTICAL CALCULATIONS
      |
      v
EVENT DETECTION
      |
      v
STRUCTURED JSON
      |
      v
PYTHON FASTAPI
      |
      v
HISTORICAL COMPARISON
      |
      v
LLM RESEARCH GENERATION
      |
      v
VALIDATION
      |
      v
RESEARCH BLOG
      |
      v
POSTGRESQL
```

## 13.1 Example Research Payload

```json
{
  "symbol": "BTCUSD",
  "timeframe": "1m",
  "period": {
    "start": "2026-11-01T10:00:00Z",
    "end": "2026-11-01T10:01:00Z"
  },
  "market": {
    "open": 105000,
    "high": 105120,
    "low": 104950,
    "close": 105080
  },
  "liquidity": {
    "bid_notional": 1200000,
    "ask_notional": 900000,
    "imbalance": 0.1429,
    "persistence": 0.82
  },
  "volatility": {
    "realized_volatility": 0.0012,
    "volume_change": 0.35
  },
  "events": [
    {
      "type": "liquidity_concentration",
      "price_level": 104900,
      "side": "bid",
      "evidence": "high_relative_bid_depth"
    }
  ],
  "data_quality": {
    "orderbook_valid": true,
    "coverage": 1.0
  }
}
```

Values above are illustrative and must not be treated as actual Delta Exchange market data.

## 13.2 LLM Instructions

The research model must follow these rules:

- Use only supplied analytical evidence.
- Never invent prices or volume.
- Never invent actual liquidation events.
- Distinguish estimates from observations.
- Mention missing data.
- Explain uncertainty.
- Do not guarantee market direction.
- Do not present hypotheses as confirmed facts.
- Cite the relevant timestamps and analytical records.

## 13.3 Blog Generation Frequency

Do not generate an AI blog on every tick.

Recommended strategy:

- Real-time terminal: Continuous.
- Market-event detection: Continuous.
- Research summary: Every 15–30 minutes when sufficient evidence exists.
- Major market event article: Event-triggered.
- Historical research: On demand.

This keeps LLM costs and unnecessary requests under control.

---

# 14. TRADING DECISION SUPPORT

The terminal will support manual BTCUSD trading decisions.

It will not initially execute real trades automatically.

## 14.1 Market Analysis

Before considering a trade, evaluate:

1. Higher-timeframe market structure.
2. Current liquidity concentration.
3. Bid/ask imbalance.
4. Trade flow.
5. Volatility.
6. Spread.
7. Data freshness.
8. Potential invalidation level.

## 14.2 Potential Bullish Setup

Illustrative conditions:

- 15m market structure is bullish.
- 5m price approaches a significant bid liquidity region.
- 1m shows selling pressure being absorbed.
- Bid liquidity replenishes.
- Price begins to recover.

The terminal can show:

"Potential bullish setup – confirmation required."

## 14.3 Potential Bearish Setup

Illustrative conditions:

- 15m market structure is bearish.
- 5m price approaches an ask liquidity region.
- 1m shows buying pressure weakening.
- Ask liquidity replenishes.
- Price begins to reject the region.

The terminal can show:

"Potential bearish setup – confirmation required."

These conditions require historical testing and calibration before being used in real trading.

---

# 15. RISK MANAGEMENT ENGINE

This component is mandatory because the platform will be used for real-money trading.

## 15.1 Risk Per Trade

Define:

- E = Account equity.
- r = Risk percentage.
- R = Maximum permitted monetary loss.

\[
R=E\times r
\]

Example:

Account equity = ₹100,000.

Risk percentage = 0.5%.

\[
R=100000\times0.005
\]

\[
R=₹500
\]

This is the planned risk, not a guarantee of maximum loss. Slippage, gaps, fees and liquidation can increase actual losses.

## 15.2 Position Sizing

For a linear contract:

\[
PositionSize=
\frac{RiskAmount}
{|EntryPrice-StopPrice|}
\]

This formula must be adjusted for the contract multiplier, settlement currency, inverse/quanto mechanics and fees.

For BTCUSD, use the exact Delta Exchange instrument specification and exchange-provided PnL calculation methodology.

Never assume a generic linear-contract formula applies to every BTCUSD perpetual contract.

## 15.3 Stop-Loss

The system should calculate:

- Entry price.
- Stop-loss price.
- Position size.
- Expected loss.
- Trading fees.
- Estimated slippage.
- Liquidation price, where the exchange API supports reliable calculation.

## 15.4 Mandatory Safeguards

- Configurable maximum daily loss.
- Maximum position size.
- Maximum leverage setting.
- Maximum number of concurrent positions.
- Spread threshold.
- Stale-data protection.
- Manual trade confirmation.
- Emergency trading disable switch.

A stop-loss is not guaranteed to execute at the exact requested price.

---

# 16. FRONTEND TERMINAL DESIGN

## 16.1 Routes

```text
/
    Dashboard

/terminal/btcusd
    Live Liquidity Terminal

/research
    AI Research Articles

/research/:article_id
    Research Article Details

/historical-analysis
    Historical Market Analysis

/settings
    Trading Preferences
    Risk Settings
    Data Settings
```

## 16.2 Liquidity Terminal Layout

```text
+--------------------------------------------------+
| BTCUSD     LIVE     DATA HEALTH: NORMAL           |
+--------------------------------------------------+
| 1m | 5m | 15m | Price | Volume | Spread          |
+--------------------------------------------------+
|                                                  |
|               LIQUIDITY HEATMAP                  |
|                                                  |
| Price     Horizontal Bands              Time    |
|                                                  |
| 105200    [ASK LIQUIDITY]                        |
| 105100    [ASK LIQUIDITY]                        |
| 105000    [BID LIQUIDITY]                        |
| 104900    [BID LIQUIDITY]                        |
|                                                  |
+--------------------------------------------------+
| BID / ASK | IMBALANCE | VOLATILITY | DEPTH       |
+--------------------------------------------------+
| ORDERBOOK                                        |
+--------------------------------------------------+
| 5M / 15M MARKET STRUCTURE                        |
+--------------------------------------------------+
| AI RESEARCH SUMMARY                               |
+--------------------------------------------------+
```

## 16.3 Canvas Rendering

The heatmap should use a dedicated Canvas renderer.

Rendering process:

1. Receive aggregated liquidity data.
2. Map price levels to Y coordinates.
3. Map timestamps to X coordinates.
4. Normalize liquidity intensity.
5. Draw horizontal cells.
6. Update only changed regions where practical.
7. Maintain a rolling time window.
8. Support zoom and scroll.

Do not re-render the entire React application for every market update.

Use a separate rendering loop and bounded update queue.

---

# 17. DATABASE DESIGN

Use PostgreSQL with TimescaleDB for time-series data.

Recommended tables:

## 17.1 instruments

- id
- exchange
- symbol
- contract_type
- tick_size
- quantity_step
- contract_multiplier
- settlement_currency
- status

## 17.2 market_trades

- id
- instrument_id
- exchange_timestamp
- receive_timestamp
- price
- quantity
- aggressor_side
- exchange_trade_id

## 17.3 orderbook_snapshots

- id
- instrument_id
- timestamp
- sequence_number
- bids
- asks
- synchronization_status

## 17.4 liquidity_aggregates

- id
- instrument_id
- bucket_timestamp
- price_bin
- bid_average
- ask_average
- bid_maximum
- ask_maximum
- bid_minimum
- ask_minimum
- liquidity_added
- liquidity_removed
- persistence
- coverage

## 17.5 volatility_metrics

- id
- instrument_id
- timestamp
- timeframe
- log_return
- realized_volatility
- atr
- trading_volume
- spread

## 17.6 market_events

- id
- instrument_id
- event_type
- event_timestamp
- price_level
- evidence
- confidence
- data_quality

## 17.7 research_articles

- id
- title
- category
- symbol
- timeframe
- start_timestamp
- end_timestamp
- article_content
- model_name
- generated_at
- validation_status

## 17.8 research_evidence

- id
- article_id
- metric_name
- metric_value
- source_timestamp
- source_record_id

All historical timestamps should be stored in UTC.

Use appropriate indexes, retention policies and hypertables for high-volume time-series tables.

---

# 18. REDIS ARCHITECTURE

Redis will provide fast distribution of market data.

Suggested streams:

```text
market:trades:BTCUSD

market:orderbook:BTCUSD

market:liquidity:BTCUSD

market:volatility:BTCUSD

market:events:BTCUSD

research:jobs
```

Use:

- Redis Streams for durable event processing within configured retention.
- Redis Pub/Sub for transient real-time notifications.
- Redis hashes or strings for latest market snapshots.

Important:

Redis Pub/Sub is not a historical database.

If a consumer disconnects, it may miss messages. Use Redis Streams or PostgreSQL for the required recovery and persistence mechanisms.

---

# 19. GO PROJECT STRUCTURE

```text
market-engine/
│
├── cmd/
│   └── server/
│       └── main.go
│
├── internal/
│   ├── exchange/
│   │   ├── delta_client.go
│   │   ├── websocket.go
│   │   └── subscriptions.go
│   │
│   ├── orderbook/
│   │   ├── snapshot.go
│   │   ├── updater.go
│   │   ├── validator.go
│   │   └── synchronizer.go
│   │
│   ├── market/
│   │   ├── trade_processor.go
│   │   ├── candle_processor.go
│   │   └── market_state.go
│   │
│   ├── liquidity/
│   │   ├── calculator.go
│   │   ├── aggregator.go
│   │   ├── persistence.go
│   │   └── detector.go
│   │
│   ├── analytics/
│   │   ├── volatility.go
│   │   ├── imbalance.go
│   │   └── statistics.go
│   │
│   ├── events/
│   │   ├── sweep_detector.go
│   │   ├── absorption_detector.go
│   │   └── withdrawal_detector.go
│   │
│   ├── stream/
│   │   ├── redis_publisher.go
│   │   └── websocket_server.go
│   │
│   ├── repository/
│   ├── config/
│   └── monitoring/
│
├── tests/
├── Dockerfile
├── go.mod
└── .env.example
```

# 20. PYTHON RESEARCH SERVICE STRUCTURE

```text
research-service/
│
├── app/
│   ├── main.py
│   │
│   ├── api/
│   │   ├── research_routes.py
│   │   └── historical_routes.py
│   │
│   ├── services/
│   │   ├── research_service.py
│   │   ├── comparison_service.py
│   │   └── generation_service.py
│   │
│   ├── managers/
│   │   ├── market_analysis_manager.py
│   │   └── llm_manager.py
│   │
│   ├── analytics/
│   │   ├── volatility_analysis.py
│   │   ├── liquidity_analysis.py
│   │   └── historical_analysis.py
│   │
│   ├── repositories/
│   ├── models/
│   ├── schemas/
│   ├── prompts/
│   └── config/
│
├── tests/
├── Dockerfile
└── requirements.txt
```

# 21. REACT FRONTEND STRUCTURE

```text
frontend/
│
├── src/
│   ├── components/
│   │
│   ├── features/
│   │   ├── terminal/
│   │   │   ├── HeatmapCanvas.jsx
│   │   │   ├── LiquidityPanel.jsx
│   │   │   ├── OrderbookPanel.jsx
│   │   │   ├── MarketChart.jsx
│   │   │   └── TimeframeSelector.jsx
│   │   │
│   │   ├── research/
│   │   │   ├── ResearchList.jsx
│   │   │   ├── ResearchArticle.jsx
│   │   │   └── ResearchSummary.jsx
│   │   │
│   │   └── risk/
│   │       └── RiskCalculator.jsx
│   │
│   ├── services/
│   │   ├── marketApi.js
│   │   ├── researchApi.js
│   │   └── websocketService.js
│   │
│   ├── hooks/
│   ├── store/
│   ├── pages/
│   └── App.jsx
│
├── Dockerfile
└── package.json
```

# 22. NORTHFLANK DEPLOYMENT

The application will be deployed through Docker-based services.

Recommended deployment:

| Service | Type | Responsibility |
|---|---|---|
| market-engine | Combined Service | Go WebSocket engine |
| research-api | Combined Service | Python FastAPI |
| frontend | Combined Service | React application |
| postgres | Managed/Combined resource | Persistent database |
| redis | Managed/Combined resource | Market data distribution |

If Northflank's managed database offerings are used, configure their persistence and backup options appropriately.

## 22.1 Deployment Requirements

- Keep Go market engine continuously running.
- Configure automatic restart.
- Configure health checks.
- Configure environment variables.
- Keep credentials in secret variables.
- Use persistent storage for self-hosted database services.
- Enable PostgreSQL backups.
- Configure Redis persistence if required.
- Configure appropriate CPU and memory limits.

## 22.2 Important Network Consideration

Deploy the market engine in a region that offers good connectivity to Delta Exchange's WebSocket infrastructure.

Benchmark actual round-trip and processing latency before selecting the production region.

Do not assume the closest geographic region is automatically the fastest.

---

# 23. LATENCY AND PERFORMANCE ENGINEERING

The objective is to minimize unnecessary processing and network delays.

## 23.1 Engineering Rules

1. Maintain a shared exchange market-data connection.
2. Avoid creating duplicate WebSocket connections.
3. Use bounded channels.
4. Avoid unbounded message queues.
5. Keep orderbook processing in memory.
6. Avoid database writes on every individual orderbook update.
7. Batch historical writes.
8. Use incremental heatmap updates.
9. Avoid sending raw orderbook data to the browser.
10. Use Redis for distributing aggregated market state.

## 23.2 Measure Latency

Track these metrics separately:

- Exchange timestamp to local receive time.
- Local receive to processing completion.
- Processing completion to Redis publication.
- Redis publication to frontend receipt.
- Frontend receipt to completed rendering.

Use monotonic local clocks for local duration measurements.

Exchange-to-local delay measurements require clock synchronization and must account for clock uncertainty.

Do not claim a particular latency SLA until real measurements establish it.

---

# 24. DATA RELIABILITY AND FAIL-SAFE SYSTEM

A fast incorrect terminal is more dangerous than a slower accurate terminal.

Mandatory conditions:

### WebSocket Failure

- Detect disconnection.
- Reconnect with exponential backoff and jitter.
- Resubscribe to required channels.
- Fetch a new snapshot.
- Rebuild local orderbook.
- Resume valid analytics.

### Missing Updates

- Detect sequence gaps where supported.
- Mark orderbook invalid.
- Stop publishing trustworthy liquidity metrics.
- Resynchronize.

### Stale Data

- Calculate data age.
- Display stale status.
- Disable trade confirmation recommendations.

### Database Failure

- Do not block market ingestion indefinitely.
- Use bounded buffering.
- Record dropped or unavailable historical data.
- Restore ingestion and reconcile where possible.

### AI Failure

- Keep terminal operational.
- Mark research generation as failed or delayed.
- Never fabricate an article to fill a missing result.

---

# 25. SECURITY

- Store Delta API credentials only on the backend.
- Never expose API secrets to React.
- Use environment variables.
- Use separate demo and live credentials.
- Use least-privilege API permissions.
- Enable withdrawal permissions only if genuinely required; preferably do not enable them.
- Keep initial real trading execution manual.
- Protect private API endpoints.
- Use authenticated terminal access.
- Keep sensitive logs free of credentials.

The market-data service should not require trading permissions when using public market-data channels.

---

# 26. TESTING STRATEGY

Before real-money usage, test the complete pipeline.

## 26.1 Unit Tests

Test:

- Orderbook update logic.
- Price binning.
- Bid/ask aggregation.
- Liquidity calculations.
- Imbalance calculations.
- Volatility calculations.
- Event detection.
- Position sizing.

## 26.2 Integration Tests

Test:

- Delta WebSocket connection.
- Snapshot and incremental updates.
- Redis publication.
- Database persistence.
- FastAPI research generation.
- React WebSocket consumption.

## 26.3 Failure Tests

Simulate:

- Network disconnection.
- Sequence mismatch.
- Missing market messages.
- Redis outage.
- Database outage.
- Delayed data.
- LLM API failure.
- High-frequency message bursts.

## 26.4 Historical Replay

Create a replay engine using recorded market data.

Replay previous market sessions and evaluate:

- Whether liquidity zones were detected correctly.
- Whether detected events had valid supporting evidence.
- Whether volatility metrics matched independent calculations.
- Whether heatmap reconstruction was accurate.

Historical replay must preserve the original event ordering and timestamps.

---

# 27. DEVELOPMENT ROADMAP

## Phase 1: Delta Exchange Integration

- Create Go project.
- Connect Delta public WebSocket.
- Subscribe to BTCUSD data.
- Receive trades and orderbook updates.
- Implement snapshot synchronization.
- Implement reconnect handling.

**Deliverable:** Reliable live market data.

## Phase 2: Liquidity Engine

- Implement orderbook maps.
- Implement price binning.
- Calculate bid/ask liquidity.
- Calculate orderbook imbalance.
- Implement one-minute aggregation.
- Implement liquidity persistence.

**Deliverable:** Validated liquidity calculations.

## Phase 3: Heatmap Terminal

- Build React application.
- Implement Canvas rendering.
- Implement horizontal price levels.
- Implement live updates.
- Add 1m, 5m and 15m controls.
- Add orderbook panel.
- Add market data health status.

**Deliverable:** Functional live BTCUSD terminal.

## Phase 4: Market Analytics

- Implement realized volatility.
- Implement ATR.
- Implement liquidity withdrawal detection.
- Implement sweep candidates.
- Implement absorption indicators.
- Add historical comparison.

**Deliverable:** Market event detection engine.

## Phase 5: AI Research

- Build FastAPI service.
- Integrate PostgreSQL.
- Implement historical analysis.
- Prepare structured JSON payloads.
- Build research prompts.
- Integrate LLM.
- Validate generated articles.
- Store and display research blogs.

**Deliverable:** AI-powered market research platform.

## Phase 6: Risk Management

- Position-size calculator.
- Contract-specific PnL calculations.
- Stop-loss risk calculation.
- Daily loss limits.
- Data freshness safeguards.
- Manual trading workflow.

**Deliverable:** Trading decision-support system.

## Phase 7: Northflank Deployment

- Prepare Dockerfiles.
- Create Northflank project.
- Deploy Go engine.
- Deploy Python API.
- Deploy React frontend.
- Configure PostgreSQL.
- Configure Redis.
- Configure secrets.
- Configure health checks.
- Perform production testing.

**Deliverable:** Deployed personal trading intelligence platform.

---

# 28. FINAL PRODUCT FEATURES

The finished platform should contain the following modules.

| Module | Final Capability |
|---|---|
| Market Monitor | Live BTCUSD price and trades |
| Liquidity Tracker | Bid/ask liquidity analysis |
| Live Heatmap | Horizontal 1-minute liquidity visualization |
| Orderbook Analyzer | Depth and imbalance |
| Liquidity Detector | Concentration, withdrawal and sweep candidates |
| Volatility Engine | Realized volatility and ATR |
| Multi-Timeframe Analysis | 1m, 5m and 15m |
| Historical Analyzer | Previous session comparisons |
| AI Research Engine | Evidence-backed research blogs |
| Risk Calculator | Position size and loss calculations |
| Data Health Monitor | Connection and synchronization status |

---

# 29. NON-NEGOTIABLE TECHNICAL PRINCIPLES

1. Never use incomplete orderbook data for trustworthy liquidity calculations.
2. Never confuse visible liquidity with actual executed volume.
3. Never interpret every liquidity removal as a cancellation.
4. Never call estimated liquidation levels actual liquidation events.
5. Never generate AI research from unsupported assumptions.
6. Never let AI automatically place real orders in the initial version.
7. Never ignore stale data.
8. Never use the same aggregation assumptions for all instruments without checking their contract specifications.
9. Never prioritize visual smoothness over data correctness.
10. Never claim profitability based solely on historical pattern detection.

---

# 30. FINAL PROJECT DEFINITION

**Project Name:** BTCUSD Liquidity Intelligence & AI Research Terminal

**Primary Purpose:**

To build a personal real-time market intelligence platform that tracks BTCUSD liquidity on Delta Exchange using a 1-minute horizontal heatmap, analyses market behaviour across 1-minute, 5-minute and 15-minute timeframes, identifies significant liquidity and volatility events, and generates AI-powered research articles using verified market data.

The system will provide analytical insights and risk-management support for manual real-money trading decisions.

**Final Technology Architecture:**

- Go for real-time exchange connectivity and liquidity processing.
- React + Canvas for live terminal visualization.
- Python + FastAPI for historical analysis and AI research.
- Redis for real-time event distribution.
- PostgreSQL + TimescaleDB for persistent historical data.
- LLM for research generation.
- Docker + Northflank for deployment.

**Development Priority:**

Data Accuracy → Orderbook Reliability → Liquidity Calculations → Live Heatmap → Historical Analytics → AI Research → Risk Management → Production Deployment.

**Final Objective:**

Build a reliable, low-latency, evidence-based BTCUSD trading intelligence system that helps the user understand market liquidity, volatility and market behaviour before executing trades manually on Delta Exchange.

---

**END OF TECHNICAL PROJECT SPECIFICATION**