# 02 — Market Engine and Mathematics

**Project:** BTCUSD Liquidity Intelligence & AI Research Platform  
**Primary Service:** Go Market Engine  
**Exchange:** Delta Exchange  
**Status:** Technical Implementation Specification  
**Document Priority:** Critical

---

# 1. Purpose

This document defines the mathematical and engineering requirements of the Go Market Engine.

The Market Engine is responsible for:

1. Receiving real-time market data from Delta Exchange.
2. Maintaining a synchronized local orderbook.
3. Processing trades and orderbook changes.
4. Calculating visible bid and ask liquidity.
5. Aggregating liquidity into price levels and time buckets.
6. Generating liquidity events.
7. Calculating volatility metrics.
8. Publishing normalized market data to downstream services.

All calculations must be deterministic, testable, timestamped and reproducible.

The engine must never treat incomplete or stale market data as valid.

---

# 2. Market Engine Architecture

The Go Market Engine should use independent processing components.

```text
Delta Exchange WebSocket
          |
          v
   Connection Manager
          |
          v
   Message Decoder
          |
          v
   Data Normalizer
          |
          +--------------------+
          |                    |
          v                    v
    Trade Processor      Orderbook Processor
          |                    |
          v                    v
    Trade Store          Local Orderbook
          |                    |
          +---------+----------+
                    |
                    v
             Liquidity Engine
                    |
          +---------+----------+
          |                    |
          v                    v
     Heatmap Engine       Event Detector
          |                    |
          +---------+----------+
                    |
                    v
             Volatility Engine
                    |
                    v
             Event Publisher
                    |
          +---------+----------+
          |                    |
          v                    v
        Redis              PostgreSQL
          |
          v
    Frontend Gateway
```

Each component must have a single responsibility.

## 2.1 Recommended Go packages

```text
backend-go/
├── cmd/
│   └── market-engine/
│       └── main.go
│
├── internal/
│   ├── exchange/
│   │   ├── websocket_client.go
│   │   ├── connection_manager.go
│   │   ├── message_decoder.go
│   │   └── instrument_manager.go
│   │
│   ├── market/
│   │   ├── trade_processor.go
│   │   ├── orderbook_processor.go
│   │   ├── orderbook_sync.go
│   │   └── market_state.go
│   │
│   ├── liquidity/
│   │   ├── liquidity_calculator.go
│   │   ├── price_binner.go
│   │   ├── persistence_calculator.go
│   │   └── imbalance_calculator.go
│   │
│   ├── heatmap/
│   │   ├── heatmap_engine.go
│   │   ├── bucket_manager.go
│   │   └── aggregation.go
│   │
│   ├── volatility/
│   │   ├── returns.go
│   │   ├── realized_volatility.go
│   │   └── atr.go
│   │
│   ├── events/
│   │   ├── sweep_detector.go
│   │   ├── absorption_detector.go
│   │   ├── liquidity_withdrawal.go
│   │   └── event_manager.go
│   │
│   ├── publisher/
│   │   ├── redis_publisher.go
│   │   └── event_serializer.go
│   │
│   └── models/
│       ├── trade.go
│       ├── orderbook.go
│       ├── liquidity.go
│       ├── heatmap.go
│       └── market_event.go
│
└── tests/
```

This is the logical package structure. The agent may refine internal implementation without mixing responsibilities.

---

# 3. Instrument Metadata and Units

Before processing market data, the engine must load the current BTCUSD instrument metadata from Delta Exchange.

Do not assume contract specifications.

The following information must be verified from official exchange metadata:

- Instrument symbol and identifier.
- Contract type.
- Contract multiplier.
- Quantity unit.
- Tick size.
- Minimum order quantity.
- Settlement currency.
- Price precision.
- Quantity precision.
- Contract status.

## 3.1 Unit safety

The engine must distinguish:

| Field | Meaning |
|---|---|
| Price | Exchange-reported contract price |
| Quantity | Exchange-reported contract quantity |
| Contract multiplier | Instrument-specific contract value |
| Notional | Monetary exposure calculated using verified contract rules |
| Tick size | Minimum valid price increment |
| Timestamp | Event or exchange timestamp |

Never assume that `price × quantity` is USD notional without verifying the contract's multiplier and payoff specification.

Create a dedicated contract valuation function.

```go
type InstrumentMetadata struct {
    Symbol           string
    ContractType     string
    ContractSize     float64
    TickSize         float64
    QuantityStep     float64
    SettlementAsset  string
    PricePrecision   int
    QuantityPrecision int
}
```

The structure is illustrative. Fields must be adapted to verified Delta metadata.

```go
func CalculateNotional(
    price float64,
    quantity float64,
    metadata InstrumentMetadata,
) (float64, error)
```

The function must implement the instrument-specific valuation formula.

If the correct formula or multiplier is unknown, return an error rather than publishing an invented notional.

---

# 4. Market Data Normalization

All exchange messages must be converted into internal normalized structures.

The normalized schema must be independent of Delta's raw WebSocket payload.

## 4.1 Normalized trade

```go
type Trade struct {
    TradeID       string
    Symbol        string
    Price         float64
    Quantity      float64
    Side          string
    ExchangeTime  time.Time
    ReceivedTime  time.Time
    Notional      float64
}
```

Rules:

- Preserve exchange trade ID when available.
- Preserve exchange timestamp.
- Record local receive timestamp.
- Detect duplicate trades.
- Validate price and quantity.
- Never silently replace missing timestamps with arbitrary values.
- Normalize trade side only when the exchange provides reliable side information.

## 4.2 Normalized orderbook level

```go
type OrderbookLevel struct {
    Price    float64
    Quantity float64
}
```

## 4.3 Normalized orderbook state

```go
type Orderbook struct {
    Symbol          string
    Bids            []OrderbookLevel
    Asks            []OrderbookLevel
    ExchangeTime    time.Time
    ReceivedTime    time.Time
    Sequence        int64
    IsSynchronized  bool
}
```

The actual sequence type and field availability must follow the exchange protocol.

---

# 5. Orderbook Synchronization

This is one of the most critical components of the entire platform.

A mathematically correct liquidity calculation using an incorrect orderbook is still incorrect market intelligence.

## 5.1 Snapshot and incremental updates

The engine must support:

1. Initial orderbook snapshot.
2. Incremental orderbook updates.
3. Sequence validation, if supported by the exchange.
4. Local orderbook reconstruction.
5. Gap detection.
6. Resynchronization.

General workflow:

```text
Connect to Exchange
       |
       v
Subscribe to Orderbook
       |
       v
Receive Snapshot
       |
       v
Validate Snapshot
       |
       v
Build Local Orderbook
       |
       v
Apply Incremental Updates
       |
       v
Validate Update Continuity
       |
       +------ Valid ------> Continue Processing
       |
       +------ Invalid ----> Mark Orderbook Invalid
                                  |
                                  v
                           Request Resync
                                  |
                                  v
                            New Snapshot
```

The exact snapshot/update synchronization algorithm must follow Delta's current official protocol.

Do not assume that every exchange uses the same sequence-number semantics.

## 5.2 Update rules

For each incoming update:

- Identify the correct price level.
- Update its quantity.
- Remove the level when the exchange specifies that its quantity is zero.
- Maintain bids in descending price order.
- Maintain asks in ascending price order.
- Validate that best bid is below best ask, except where exchange-specific market conditions require special handling.
- Check sequence continuity when sequence metadata is available.

## 5.3 Orderbook invalidation

The orderbook must be marked invalid when:

- A sequence gap is detected.
- An update cannot be applied safely.
- The connection disconnects.
- A required snapshot is missing.
- The local state becomes inconsistent.
- The instrument metadata changes unexpectedly.

While invalid:

- Do not generate trusted liquidity events.
- Do not publish the state as LIVE.
- Do not calculate trusted heatmap values from the incomplete book.
- Trigger resynchronization.
- Publish an explicit health status.

## 5.4 Orderbook health states

```text
CONNECTING
LIVE
DELAYED
STALE
RESYNCING
DISCONNECTED
ERROR
```

`LIVE` means the feed is connected, the local book is synchronized and the latest data satisfies the configured freshness and integrity checks.

Connection status alone does not prove data correctness.

---

# 6. Liquidity Calculation

The liquidity engine calculates visible resting bid and ask liquidity.

It must not describe visible orderbook liquidity as total market liquidity.

## 6.1 Bid liquidity

For bid price level \(i\):

\[
L_{bid,i} = N(P_i,Q_i)
\]

Where:

- \(P_i\) = bid price.
- \(Q_i\) = bid quantity.
- \(N\) = verified instrument-specific notional calculation.

## 6.2 Ask liquidity

\[
L_{ask,i} = N(P_i,Q_i)
\]

The same instrument-specific valuation rules must apply.

## 6.3 Total visible bid liquidity

For a selected price range:

\[
L_{bid,total} = \sum_{i=1}^{n} L_{bid,i}
\]

## 6.4 Total visible ask liquidity

\[
L_{ask,total} = \sum_{i=1}^{n} L_{ask,i}
\]

The selected price range and depth must be stored with the calculation.

Never compare two liquidity totals without checking whether they use the same price range and depth.

## 6.5 Liquidity imbalance

\[
I =
\frac{L_{bid,total}-L_{ask,total}}
{L_{bid,total}+L_{ask,total}}
\]

Interpretation:

| Value | Interpretation |
|---|---|
| Close to +1 | Bid liquidity dominates |
| Close to -1 | Ask liquidity dominates |
| Close to 0 | Relatively balanced |

If both sides are zero, the result must be null or explicitly unavailable. Never divide by zero.

This is an orderbook imbalance metric, not a guaranteed directional trading signal.

## 6.6 Bid-to-ask ratio

\[
R =
\frac{L_{bid,total}}{L_{ask,total}}
\]

If ask liquidity is zero, return an unavailable value rather than infinity.

---

# 7. Price Binning

The heatmap groups orderbook liquidity into price intervals.

The engine must use the verified instrument tick size and a configurable bin width.

## 7.1 Price bin calculation

Let:

- \(P\) = orderbook price.
- \(B\) = configured price bin width.
- \(P_0\) = configured bin origin.

Then:

\[
BinIndex =
\left\lfloor
\frac{P-P_0}{B}
\right\rfloor
\]

The bin price is:

\[
BinPrice = P_0 + BinIndex \times B
\]

The bin width must be compatible with the instrument's tick size.

Do not use arbitrary floating-point rounding for exchange prices.

Use integer tick units or decimal-safe arithmetic internally.

## 7.2 Aggregation by bin

For all orderbook levels belonging to a price bin:

\[
L_{bin} = \sum_{i \in bin} L_i
\]

Maintain separate values for:

- Bid liquidity.
- Ask liquidity.
- Combined liquidity.

Do not merge bid and ask into one value when the UI needs to distinguish them.

---

# 8. One-Minute Heatmap Engine

The heatmap uses one-minute aggregation buckets.

**Important:** One-minute aggregation does not mean the frontend updates only once per minute.

The engine must continuously update the active bucket whenever valid market data arrives.

## 8.1 Bucket identification

For event timestamp \(t\):

\[
BucketStart =
\left\lfloor
\frac{t}{60}
\right\rfloor \times 60
\]

Use a consistent UTC timestamp convention.

The event timestamp should be preferred for historical ordering when reliable. The receive timestamp must also be retained to measure transport latency.

## 8.2 Bucket fields

Each price bin and minute bucket should maintain:

```go
type HeatmapBucket struct {
    Symbol          string
    BucketStart     time.Time
    PriceBin        float64

    BidOpen         float64
    BidHigh         float64
    BidLow          float64
    BidClose        float64

    AskOpen         float64
    AskHigh         float64
    AskLow          float64
    AskClose        float64

    BidTimeWeighted float64
    AskTimeWeighted float64

    BidMax          float64
    AskMax          float64

    BidAdded        float64
    AskAdded        float64

    BidRemoved      float64
    AskRemoved      float64

    ObservationCount int64
    CoverageMs       int64
    IsComplete       bool
}
```

The structure may be extended as implementation evolves.

## 8.3 OHLC aggregation

For each liquidity observation:

- Open: first valid observation.
- High: maximum valid observation.
- Low: minimum valid observation.
- Close: latest valid observation.

Calculate these separately for bids and asks.

## 8.4 Time-weighted average liquidity

A simple arithmetic average can be misleading when updates arrive at irregular intervals.

Use time-weighted averaging.

For observations \(L_i\), where each observation remains active for duration \(\Delta t_i\):

\[
TWAP_L =
\frac{\sum_i L_i \Delta t_i}
{\sum_i \Delta t_i}
\]

Here, TWAP means time-weighted average liquidity, not execution-price TWAP.

The implementation must:

- Attribute each observed state only to its valid duration.
- Avoid counting time across a known data gap.
- Cap observation duration at the minute boundary.
- Track covered time separately from the full 60-second bucket.
- Mark incomplete buckets when coverage is insufficient.

A bucket must not appear fully observed if the feed was disconnected for part of the minute.

## 8.5 Additions and removals

For a price level:

\[
\Delta Q = Q_{new}-Q_{old}
\]

If:

\[
\Delta Q > 0
\]

then the visible quantity increased.

If:

\[
\Delta Q < 0
\]

then the visible quantity decreased.

Record additions and removals separately for bids and asks.

Important: a decrease in visible quantity does not automatically prove cancellation. It can result from execution, cancellation, repricing, or other exchange-side changes.

Where reliable trade correlation is available, use it to improve classification. Otherwise label the change as an observed reduction.

## 8.6 Late and out-of-order events

The engine must define a bounded late-event policy.

- Retain exchange timestamps.
- Detect events that arrive after their minute bucket has closed.
- Update historical buckets only within the configured correction window.
- Do not silently rewrite older finalized history.
- Record corrections where applicable.

---

# 9. Liquidity Persistence

A large order appearing briefly should not receive the same interpretation as liquidity that remains visible for a sustained period.

Track liquidity persistence at each price bin.

## 9.1 Persistence duration

For a configured threshold \(T\):

\[
Persistence =
t_{end}-t_{start}
\]

Where the liquidity remains above the threshold during the measured interval.

If the liquidity drops below the threshold, the current persistence interval ends.

## 9.2 Persistence score

A configurable normalized score can be calculated:

\[
PersistenceScore =
\min\left(1,\frac{Duration}{T_{reference}}\right)
\]

Where:

- `Duration` is observed persistence.
- `T_reference` is a configurable reference duration.

This score is a feature for analysis, not a probability that the order will execute.

## 9.3 Required fields

- Price bin.
- Side.
- Initial observed liquidity.
- Maximum observed liquidity.
- Time first observed.
- Time last observed.
- Persistence duration.
- Number of additions.
- Number of reductions.
- Number of complete disappearances.
- Data coverage.
- Confidence or quality flags.

Do not claim that an order belongs to a specific institution or market participant.

---

# 10. Liquidity Withdrawal Detection

A liquidity withdrawal event occurs when visible resting quantity decreases materially over a short interval.

## 10.1 Reduction ratio

\[
ReductionRatio =
\frac{Q_{previous}-Q_{current}}
{Q_{previous}}
\]

Only calculate this when previous quantity is positive.

## 10.2 Detection conditions

An event may be generated when:

- Previous quantity exceeds a minimum threshold.
- Reduction ratio exceeds a configurable threshold.
- The change occurs within a configured time window.
- The orderbook is synchronized.
- The observation is not caused by a known data-quality issue.

## 10.3 Event classification

Possible classifications:

- `PARTIAL_REDUCTION`
- `LARGE_REDUCTION`
- `LEVEL_DISAPPEARED`
- `UNCLASSIFIED_REDUCTION`

Do not label every reduction as a cancellation.

When trade correlation suggests execution, record the evidence and classification separately.

---

# 11. Sweep Detection

A sweep is an interpretation of aggressive trading across multiple price levels.

The engine must use trade and orderbook evidence.

It must not identify a sweep solely because a price moved rapidly.

## 11.1 Buy-side aggressive sweep

Potential evidence:

- Aggressive buy trades.
- Execution across multiple ask price levels.
- High executed quantity or notional relative to a configured threshold.
- Concentrated activity within a short time window.

## 11.2 Sell-side aggressive sweep

Potential evidence:

- Aggressive sell trades.
- Execution across multiple bid price levels.
- High executed quantity or notional relative to a configured threshold.
- Concentrated activity within a short time window.

## 11.3 Sweep metrics

Track:

- Direction.
- Start price.
- End price.
- Number of price levels traversed.
- Total executed quantity.
- Total executed notional.
- Duration.
- Average execution price.
- Maximum execution price.
- Minimum execution price.
- Related orderbook changes.
- Data quality.

## 11.4 Sweep event confidence

Do not invent confidence percentages.

If a confidence score is implemented, it must be a documented rule-based score or a calibrated statistical model with validation data.

Use labels such as:

- `POSSIBLE_SWEEP`
- `CONFIRMED_TRADE_PATTERN`
- `INSUFFICIENT_EVIDENCE`

The term `CONFIRMED_TRADE_PATTERN` means the observed trade pattern satisfies the configured rules. It does not establish trader intent.

---

# 12. Absorption Detection

Absorption is a hypothesis that aggressive trading is being met by replenishing or persistent liquidity, while price movement remains relatively limited.

It cannot be proven from a single orderbook snapshot.

## 12.1 Potential buy-side absorption

Possible evidence:

- Aggressive sell volume is elevated.
- Bid liquidity remains present or replenishes.
- Price moves downward less than expected relative to selling activity.
- The pattern persists over a configured observation window.

## 12.2 Potential sell-side absorption

Possible evidence:

- Aggressive buy volume is elevated.
- Ask liquidity remains present or replenishes.
- Price moves upward less than expected relative to buying activity.
- The pattern persists over a configured observation window.

## 12.3 Supporting metrics

\[
AggressiveVolume =
\sum TradeQuantity
\]

Use notional instead of quantity when comparing instruments or contract sizes.

\[
PriceMove =
\frac{P_{end}-P_{start}}{P_{start}}
\]

Track:

- Aggressive buy/sell volume.
- Executed notional.
- Price movement.
- Visible liquidity replenishment.
- Level persistence.
- Number of observations.
- Observation duration.
- Orderbook synchronization quality.

## 12.4 Event output

Possible labels:

- `POSSIBLE_BID_ABSORPTION`
- `POSSIBLE_ASK_ABSORPTION`
- `ABSORPTION_PATTERN_WEAKENED`
- `INSUFFICIENT_EVIDENCE`

Always explain the supporting observations.

Never claim to know hidden orders or institutional intent.

---

# 13. Volatility Engine

The volatility engine calculates short-term market movement.

Required intervals:

- 1 minute.
- 5 minutes.
- 15 minutes.

Use consistent candle boundaries and timestamp conventions.

## 13.1 Candle data

For each interval:

- Open.
- High.
- Low.
- Close.
- Volume.
- Trade count.
- Start timestamp.
- End timestamp.
- Completeness.
- Data quality.

Do not calculate final candle values from incomplete trade history without marking them provisional.

## 13.2 Simple return

\[
R_t =
\frac{P_t-P_{t-1}}{P_{t-1}}
\]

## 13.3 Log return

\[
r_t =
\ln\left(\frac{P_t}{P_{t-1}}\right)
\]

Log returns are useful for statistical volatility calculations.

Handle zero or invalid prices explicitly.

## 13.4 Realized volatility

For \(n\) valid log returns:

\[
RV =
\sqrt{\sum_{i=1}^{n}r_i^2}
\]

This is realized volatility over the selected observation window.

For annualized volatility:

\[
RV_{annualized} =
RV \times \sqrt{K}
\]

Where \(K\) is the number of observation windows per year for the chosen sampling frequency.

Do not annualize unless the sampling interval and annualization convention are explicitly defined.

For the dashboard, prefer clearly labelled non-annualized short-window volatility unless annualization is specifically needed.

## 13.5 Rolling volatility

Use a rolling window of valid returns.

\[
\sigma =
\sqrt{
\frac{1}{n-1}
\sum_{i=1}^{n}(r_i-\bar r)^2
}
\]

The dashboard must show the window and sampling interval.

Do not mix 1-minute returns with 5-minute labels.

---

# 14. Average True Range (ATR)

ATR measures the average true range over a configured candle interval.

For each candle:

\[
TR_t =
\max
\begin{cases}
H_t-L_t\\
|H_t-C_{t-1}|\\
|L_t-C_{t-1}|
\end{cases}
\]

Where:

- \(H_t\) = current high.
- \(L_t\) = current low.
- \(C_{t-1}\) = previous close.

## 14.1 Initial ATR

For an initial period of \(n\) candles:

\[
ATR_n =
\frac{1}{n}\sum_{i=1}^{n}TR_i
\]

## 14.2 Wilder smoothing

For subsequent candles:

\[
ATR_t =
\frac{(n-1)ATR_{t-1}+TR_t}{n}
\]

The period must be configurable.

For example, ATR(14) means 14 candles, not necessarily 14 minutes.

Calculate separate ATR values for 1m, 5m and 15m candles when required.

---

# 15. Volume Analytics

Track volume independently from visible resting orderbook liquidity.

Required metrics:

- Total traded quantity.
- Total traded notional.
- Aggressive buy quantity.
- Aggressive sell quantity.
- Trade count.
- Average trade size.
- Volume change.
- Relative volume.

## 15.1 Relative volume

\[
RelativeVolume =
\frac{CurrentWindowVolume}
{HistoricalAverageVolume}
\]

The comparison must use equivalent time windows and the same volume unit.

If historical samples are insufficient, return unavailable rather than a misleading ratio.

## 15.2 Aggressive volume imbalance

When reliable trade-side classification is available:

\[
VolumeImbalance =
\frac{BuyVolume-SellVolume}
{BuyVolume+SellVolume}
\]

If side classification is unavailable or unreliable, do not infer it from price movement alone.

---

# 16. Spread Analytics

Best bid and best ask are used to calculate the spread.

\[
Spread = BestAsk-BestBid
\]

Mid-price:

\[
MidPrice =
\frac{BestBid+BestAsk}{2}
\]

Relative spread:

\[
RelativeSpread =
\frac{Spread}{MidPrice}
\]

Display spread in both price units and basis points where meaningful.

\[
SpreadBps =
RelativeSpread \times 10000
\]

If the orderbook is invalid or crossed unexpectedly, suppress trusted spread analytics and raise a data-quality warning.

---

# 17. Event Detection Framework

All detected events must use a common structure.

```go
type MarketEvent struct {
    EventID       string
    Symbol        string
    EventType     string
    Direction     string

    StartTime     time.Time
    EndTime       time.Time

    StartPrice    float64
    EndPrice      float64

    Metrics       map[string]any
    Evidence      []string
    QualityFlags  []string

    Confidence    *float64
    CreatedAt     time.Time
}
```

`Confidence` must remain optional.

Do not populate it with arbitrary values.

## 17.1 Event types

```text
LIQUIDITY_ADDED
LIQUIDITY_REDUCED
LIQUIDITY_WITHDRAWAL
POSSIBLE_SWEEP
POSSIBLE_BID_ABSORPTION
POSSIBLE_ASK_ABSORPTION
HIGH_VOLUME
HIGH_VOLATILITY
SPREAD_EXPANSION
ORDERBOOK_IMBALANCE
```

## 17.2 Event deduplication

The event engine must avoid generating duplicate events for the same underlying observation.

Use:

- Event identity.
- Instrument.
- Event type.
- Price range.
- Time window.
- Detection rule version.

Events may be updated when new evidence arrives, but the update must be traceable.

## 17.3 Event explanation

Every event should contain:

1. What happened.
2. When it happened.
3. At which price range.
4. Which measurements support it.
5. Whether the evidence is complete.
6. What remains uncertain.

---

# 18. Data Quality and Freshness

Every analytical output must carry data-quality information.

Required fields:

```json
{
  "data_status": "LIVE",
  "orderbook_synchronized": true,
  "exchange_timestamp": "UTC timestamp",
  "received_timestamp": "UTC timestamp",
  "latency_ms": 0,
  "coverage_ratio": 1.0,
  "quality_flags": []
}
```

The values above are illustrative placeholders, not actual market measurements.

## 18.1 Latency

\[
Latency =
ReceivedTime-ExchangeTime
\]

Use synchronized clocks.

Negative or implausible latency must trigger a clock-quality warning.

Measure separately:

- Exchange-to-receive latency.
- Processing latency.
- Publication latency.
- Frontend delivery latency.

Do not combine them into one unexplained number.

## 18.2 Stale data

Configure freshness thresholds.

When the feed exceeds its permitted age:

- Change the feed health state.
- Mark derived metrics stale.
- Stop generating trusted events.
- Display the last update timestamp.
- Resume trusted calculations only after recovery and synchronization.

A connected WebSocket does not guarantee fresh data.

---

# 19. Processing and Concurrency Rules

The engine must handle bursts without silently losing critical events.

Requirements:

- Use bounded channels.
- Define queue capacity.
- Track queue depth.
- Track dropped-message count.
- Apply backpressure.
- Avoid unbounded goroutine creation.
- Avoid concurrent unsynchronized writes to the same orderbook.
- Use a single logical owner for each instrument's orderbook state, or an equivalently safe synchronization design.
- Keep exchange ingestion separate from slow database writes.
- Batch historical persistence.
- Do not block WebSocket reading on research or LLM operations.

## 19.1 Critical event handling

Orderbook updates and trades must not be silently dropped.

If overload makes safe processing impossible:

1. Mark data quality degraded.
2. Invalidate the affected local state where necessary.
3. Trigger recovery or resynchronization.
4. Record the incident.
5. Do not publish incomplete data as LIVE.

---

# 20. Redis Event Contracts

Publish normalized market data and analytical events.

Suggested logical channels:

```text
market:trade
market:orderbook
market:liquidity
market:heatmap
market:volatility
market:event
market:health
```

These are internal application channel names, not Delta Exchange channel names.

## 20.1 Heatmap message

```json
{
  "symbol": "BTCUSD",
  "interval": "1m",
  "bucket_start": "UTC timestamp",
  "price_bin": 0,
  "bid_liquidity": 0,
  "ask_liquidity": 0,
  "bid_time_weighted": 0,
  "ask_time_weighted": 0,
  "coverage_ms": 0,
  "is_complete": false,
  "data_status": "LIVE"
}
```

Zero values are schema examples only.

## 20.2 Event message

```json
{
  "event_id": "event-id",
  "symbol": "BTCUSD",
  "event_type": "POSSIBLE_SWEEP",
  "direction": "BUY",
  "start_time": "UTC timestamp",
  "end_time": "UTC timestamp",
  "metrics": {},
  "evidence": [],
  "quality_flags": []
}
```

## 20.3 Delivery guarantees

Use Redis Streams or another durable mechanism for events that must be recoverable.

Use Pub/Sub only for transient notifications where missed messages can be repaired using a fresh snapshot.

The frontend must be able to recover from missed incremental updates by requesting a new snapshot.

---

# 21. Performance Requirements

Performance targets must be benchmarked under realistic BTCUSD market activity.

Measure:

| Metric | Requirement |
|---|---|
| Exchange message processing | Low and measurable latency |
| Orderbook update processing | No silent sequence gaps |
| Liquidity calculation | Bounded processing time |
| Heatmap update | Continuous active-bucket updates |
| Event detection | No blocking of ingestion |
| Redis publishing | Bounded queues and monitored latency |
| Database persistence | Batched and isolated from ingestion |
| Memory usage | Stable under sustained load |

Do not claim a fixed latency guarantee before testing against the actual exchange feed, deployment region and infrastructure.

Record p50, p95 and p99 latency.

---

# 22. Configuration

Use environment variables or validated configuration files.

Illustrative configuration:

```env
MARKET_SYMBOL=BTCUSD

HEATMAP_INTERVAL=1m
HEATMAP_PRICE_BIN_WIDTH=
HEATMAP_MIN_COVERAGE_RATIO=

ORDERBOOK_STALE_THRESHOLD_MS=
TRADE_STALE_THRESHOLD_MS=

LIQUIDITY_MIN_NOTIONAL=
LIQUIDITY_PERSISTENCE_SECONDS=

SWEEP_WINDOW_MS=
SWEEP_MIN_NOTIONAL=
SWEEP_MIN_LEVELS=

ABSORPTION_WINDOW_MS=
VOLATILITY_WINDOW_1M=
VOLATILITY_WINDOW_5M=
VOLATILITY_WINDOW_15M=

ATR_PERIOD=14

REDIS_URL=
DATABASE_URL=
```

Values must be validated at startup.

Do not silently substitute zero or arbitrary defaults for critical configuration.

Thresholds should be configurable and documented, then calibrated using historical and replay data.

---

# 23. Testing Requirements

Every mathematical component must have deterministic unit tests.

## 23.1 Orderbook tests

- Initial snapshot construction.
- Bid ordering.
- Ask ordering.
- Quantity update.
- Level deletion.
- Sequence gap.
- Duplicate update.
- Invalid update.
- Reconnection.
- Snapshot resynchronization.
- Crossed or invalid book handling.

## 23.2 Liquidity tests

- Bid notional.
- Ask notional.
- Contract multiplier.
- Zero quantity.
- Invalid price.
- Zero ask liquidity.
- Zero bid liquidity.
- Imbalance.
- Different price ranges.
- Decimal and tick-size precision.

## 23.3 Heatmap tests

- Correct minute boundary.
- Price bin assignment.
- Bid/ask separation.
- OHLC aggregation.
- Time-weighted average.
- Partial bucket coverage.
- Disconnected interval.
- Late event correction.
- Incomplete bucket handling.

## 23.4 Event tests

- Liquidity addition.
- Liquidity reduction.
- Withdrawal threshold.
- Buy sweep.
- Sell sweep.
- Possible absorption.
- Duplicate event suppression.
- Insufficient evidence.
- Invalid orderbook suppression.

## 23.5 Volatility tests

- Simple returns.
- Log returns.
- Rolling volatility.
- Realized volatility.
- ATR initialization.
- Wilder smoothing.
- 1m, 5m and 15m candle boundaries.
- Missing candle handling.
- Invalid price handling.

---

# 24. Historical Replay

The engine must support historical or recorded-data replay.

Replay is essential for validating event detection and calculations before relying on live data.

Requirements:

- Preserve original event timestamps.
- Preserve event ordering.
- Support configurable replay speed.
- Reconstruct orderbook state.
- Recalculate liquidity and heatmap values.
- Reproduce event detection.
- Compare calculated output with stored reference results.
- Identify nondeterministic processing behaviour.

The same input data and configuration should produce equivalent analytical results.

---

# 25. Production Acceptance Criteria

The Market Engine is ready for integration only when the following conditions are met.

### Exchange and orderbook

- [ ] Delta's current official market-data protocol has been verified.
- [ ] Instrument metadata is loaded and validated.
- [ ] Snapshot and incremental updates are synchronized correctly.
- [ ] Sequence gaps or equivalent integrity failures are detected.
- [ ] Resynchronization works after disconnects.
- [ ] Invalid orderbooks cannot generate trusted analytics.

### Liquidity and heatmap

- [ ] Contract-specific notional calculation is verified.
- [ ] Bid and ask liquidity are calculated separately.
- [ ] Price binning respects tick size.
- [ ] One-minute buckets update continuously.
- [ ] Time-weighted liquidity is calculated correctly.
- [ ] Partial data coverage is visible.
- [ ] Additions and reductions are not misrepresented as confirmed cancellations.

### Analytics

- [ ] Liquidity persistence is calculated.
- [ ] Sweep detection uses trade evidence.
- [ ] Absorption detection uses multiple observations.
- [ ] Volatility metrics pass deterministic tests.
- [ ] ATR calculations pass reference tests.
- [ ] Events include supporting evidence and quality flags.

### Reliability

- [ ] Queue sizes are bounded.
- [ ] Overload is observable.
- [ ] Database writes cannot block ingestion.
- [ ] Redis recovery behaviour is tested.
- [ ] Stale data is clearly identified.
- [ ] Historical replay produces reproducible results.
- [ ] p50, p95 and p99 latency are measured.

---

# 26. Final Engineering Rules

1. Data correctness takes priority over visual smoothness.
2. Never calculate trusted liquidity from an invalid orderbook.
3. Never assume a generic contract valuation formula.
4. Never confuse visible orderbook liquidity with total market liquidity.
5. Never call every orderbook reduction a cancellation.
6. Never claim a sweep or absorption event without supporting observations.
7. Never label estimated liquidations as actual exchange liquidations.
8. Never allow AI processing to block market-data ingestion.
9. Never hide missing data or incomplete heatmap coverage.
10. Every calculation must have unit tests.
11. Every event must be traceable to its source observations.
12. Every important threshold must be configurable and documented.

**The Go Market Engine must produce trustworthy, reproducible market intelligence—not merely attractive market visualizations.**