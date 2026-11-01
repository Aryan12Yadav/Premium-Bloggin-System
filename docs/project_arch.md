# 01_PROJECT_ARCHITECTURE.md

# BTCUSD LIQUIDITY INTELLIGENCE & AI RESEARCH PLATFORM
## System Architecture and Technical Design

---

# 1. PROJECT OVERVIEW

## 1.1 Purpose

Build a personal BTCUSD Liquidity Intelligence and AI Market Research Platform using Delta Exchange market data.

The system will collect real-time exchange data, maintain a synchronized orderbook, calculate liquidity metrics, generate a live one-minute liquidity heatmap, analyse market volatility and generate AI-powered research articles.

The platform will support manual real-money trading decisions.

Initial version:
- Single personal user.
- BTCUSD as primary instrument.
- Delta Exchange as primary exchange.
- One-minute liquidity heatmap.
- Five-minute and fifteen-minute confirmation.
- AI-powered market research.
- Manual trade execution.

Automatic real-money order execution is OUT OF SCOPE for the initial version.

---

# 2. SYSTEM REQUIREMENTS

## 2.1 Functional Requirements

FR-01: Connect to Delta Exchange public market-data APIs.

FR-02: Receive live BTCUSD trades.

FR-03: Receive orderbook snapshots and incremental updates.

FR-04: Maintain a synchronized local orderbook.

FR-05: Calculate bid-side and ask-side liquidity.

FR-06: Aggregate liquidity into configurable price bins.

FR-07: Generate one-minute liquidity heatmap data.

FR-08: Continuously update the heatmap during the minute.

FR-09: Identify liquidity concentration.

FR-10: Identify liquidity additions and removals.

FR-11: Calculate orderbook imbalance.

FR-12: Detect potential liquidity sweep and absorption events.

FR-13: Calculate one-minute realized volatility.

FR-14: Analyse five-minute and fifteen-minute market structure.

FR-15: Store historical market data.

FR-16: Compare current and historical market conditions.

FR-17: Generate AI research blogs.

FR-18: Display AI research in the React dashboard.

FR-19: Provide market-data health monitoring.

FR-20: Provide risk-management calculations.

## 2.2 Non-Functional Requirements

- Low processing latency.
- Correct market-data synchronization.
- Reliable WebSocket reconnection.
- Controlled memory usage.
- Bounded processing queues.
- Persistent historical data.
- Secure credentials.
- Recoverable service failures.
- Reproducible analytical calculations.
- Observable system performance.

Do not assume specific latency guarantees without benchmarks.

---

# 3. TECHNOLOGY ARCHITECTURE

## 3.1 Go Market Engine

Language: Go

Responsibilities:

1. Delta Exchange WebSocket connectivity.
2. Market-data ingestion.
3. Orderbook synchronization.
4. Trade processing.
5. Liquidity calculations.
6. One-minute aggregation.
7. Volatility calculations.
8. Market event detection.
9. Redis event publishing.
10. Market-data health monitoring.

Recommended libraries:

- Gorilla WebSocket.
- Gin, only where HTTP endpoints are required.
- pgx.
- go-redis.
- Go standard library.

## 3.2 Python Research Service

Language: Python

Framework: FastAPI

Responsibilities:

1. Historical market analysis.
2. Statistical comparisons.
3. Research event interpretation.
4. AI research article generation.
5. Research validation.
6. Article persistence.
7. Research API.

Recommended libraries:

- FastAPI.
- Pydantic.
- NumPy.
- Pandas.
- SQLAlchemy.
- PostgreSQL driver.
- LLM provider SDK.

Python must not independently recreate the live orderbook.

The Go engine remains the source of truth for real-time orderbook state and liquidity calculations.

## 3.3 React Frontend

Framework:
- React.
- Vite.
- JavaScript.

Visualization:
- HTML Canvas.
- TradingView Lightweight Charts.

Responsibilities:

- Live liquidity terminal.
- Heatmap rendering.
- Candlestick chart.
- Orderbook display.
- Volatility dashboard.
- Multi-timeframe controls.
- AI research dashboard.
- Risk calculator.
- Data-health display.

Frontend must never connect directly to Delta Exchange using private credentials.

---

# 4. HIGH-LEVEL SYSTEM ARCHITECTURE

```text
                 DELTA EXCHANGE
                        |
                        |
                PUBLIC WEBSOCKET
                        |
                        v
               +------------------+
               |   GO MARKET      |
               |     ENGINE       |
               +------------------+
                        |
          +-------------+-------------+
          |             |             |
          v             v             v
      ORDERBOOK       TRADE         CANDLE
      PROCESSOR       PROCESSOR     PROCESSOR
          |             |             |
          +-------------+-------------+
                        |
                        v
               LIQUIDITY ENGINE
                        |
             +----------+----------+
             |          |          |
             v          v          v
          LIQUIDITY  VOLATILITY  EVENT
          ANALYZER   ANALYZER    DETECTOR
             |          |          |
             +----------+----------+
                        |
                        v
                  REDIS STREAMS
                        |
             +----------+----------+
             |                     |
             v                     v
        REACT TERMINAL       PYTHON SERVICE
             |                     |
             v                     v
        LIVE HEATMAP        HISTORICAL ANALYSIS
                                   |
                                   v
                              LLM SERVICE
                                   |
                                   v
                              AI RESEARCH
                                   |
                                   v
                               DATABASE
```

---

# 5. MARKET DATA ARCHITECTURE

## 5.1 Exchange Connection

The Go engine will establish the required public WebSocket connections to Delta Exchange.

The exchange integration must be isolated inside an exchange adapter.

Do not allow Delta-specific payload structures to spread throughout the application.

Use normalized internal market events.

## 5.2 Exchange Adapter

Responsibilities:

- Connect.
- Authenticate only when required.
- Subscribe to supported channels.
- Parse incoming messages.
- Validate messages.
- Handle ping/pong.
- Handle disconnection.
- Reconnect.
- Resubscribe.
- Recover orderbook state.

The adapter must use verified current API specifications.

Official reference:

https://docs.delta.exchange/

## 5.3 Normalized Market Events

Convert exchange messages into internal models.

### Trade Event

```json
{
  "event_type": "trade",
  "exchange": "delta",
  "symbol": "BTCUSD",
  "price": 105000,
  "quantity": 0.05,
  "side": "buy",
  "exchange_timestamp": 1793520000000,
  "received_timestamp": 1793520000012
}
```

### Orderbook Event

```json
{
  "event_type": "orderbook_update",
  "symbol": "BTCUSD",
  "sequence": 123456,
  "timestamp": 1793520000000,
  "bids": [],
  "asks": []
}
```

These are internal illustrative schemas.

Actual exchange fields must be mapped using verified API documentation.

## 5.4 Instrument Metadata

At startup, retrieve and validate the instrument specification.

Required metadata:

- Symbol.
- Instrument identifier.
- Tick size.
- Quantity precision.
- Contract multiplier.
- Contract type.
- Settlement currency.
- Minimum order quantity.
- Trading status.

Do not hardcode contract assumptions.

---

# 6. ORDERBOOK ARCHITECTURE

## 6.1 Local Orderbook

Maintain two in-memory data structures:

Bids:
- Price to quantity mapping.
- Sorted from highest to lowest price.

Asks:
- Price to quantity mapping.
- Sorted from lowest to highest price.

The data structure must support efficient updates and ordered traversal.

## 6.2 Snapshot Workflow

1. Establish exchange connection.
2. Subscribe to orderbook feed.
3. Obtain the appropriate initial snapshot.
4. Initialize bid and ask levels.
5. Apply updates according to Delta's documented synchronization rules.
6. Validate sequence continuity where available.
7. Mark the book LIVE only after successful synchronization.

## 6.3 Update Workflow

```text
EXCHANGE UPDATE
       |
       v
VALIDATE MESSAGE
       |
       v
CHECK SEQUENCE
       |
       v
APPLY UPDATE
       |
       v
UPDATE LOCAL BOOK
       |
       v
RECALCULATE AFFECTED PRICE BINS
       |
       v
PUBLISH MARKET STATE
```

## 6.4 Recovery Workflow

If the sequence becomes invalid:

1. Stop publishing trusted liquidity calculations.
2. Mark orderbook RESYNCING.
3. Obtain a fresh snapshot.
4. Rebuild the local orderbook.
5. Reconcile buffered updates if required by the exchange protocol.
6. Validate synchronization.
7. Resume LIVE status.

Never continue with an incomplete book while displaying it as accurate.

---

# 7. LIQUIDITY ENGINE ARCHITECTURE

The liquidity engine will consume validated local orderbook state.

Responsibilities:

- Price binning.
- Bid liquidity aggregation.
- Ask liquidity aggregation.
- Notional calculations.
- Liquidity concentration.
- Liquidity persistence.
- Liquidity addition/removal.
- Orderbook imbalance.
- One-minute aggregation.

## 7.1 Processing Frequency

| Component | Frequency |
|---|---|
| Exchange ingestion | Continuous |
| Orderbook updates | As received |
| Liquidity calculations | On relevant updates |
| Heatmap aggregation | One-minute buckets |
| Frontend updates | Continuous |
| Historical persistence | Batched |

The system must not wait 60 seconds before updating the live terminal.

## 7.2 Price-Level Processing

Group individual orderbook prices into configurable bins.

Calculate separately:

- Bid notional.
- Ask notional.
- Total notional.
- Average liquidity.
- Maximum liquidity.
- Minimum liquidity.
- Liquidity persistence.

All calculations must follow the specifications in:

docs/02_MARKET_ENGINE_AND_MATHEMATICS.md

---

# 8. VOLATILITY ENGINE ARCHITECTURE

The volatility engine will consume validated market prices and candles.

Metrics:

- Simple returns.
- Log returns.
- Realized volatility.
- ATR.
- Rolling standard deviation.
- Volatility Z-score.
- Trading volume changes.
- Spread changes.

Maintain separate calculations for:

- 1-minute timeframe.
- 5-minute timeframe.
- 15-minute timeframe.

Do not mix unfinished candles with completed historical candles without identifying their status.

The market analytics engine must support reproducible historical calculations.

---

# 9. MARKET EVENT DETECTION

The event detector will consume:

- Orderbook changes.
- Executed trades.
- Price changes.
- Liquidity metrics.
- Volatility metrics.

Supported events:

1. Liquidity concentration.
2. Liquidity addition.
3. Liquidity withdrawal.
4. Potential liquidity sweep.
5. Potential absorption.
6. Orderbook imbalance.
7. Volatility expansion.
8. Volatility contraction.

Each event must contain:

- Event identifier.
- Instrument.
- Event timestamp.
- Price level.
- Event type.
- Supporting metrics.
- Data quality.
- Confidence or evidence classification.

Do not treat a statistical event as proof of institutional intent.

---

# 10. REDIS COMMUNICATION ARCHITECTURE

Redis will distribute calculated market data between services.

Recommended logical channels:

market:trades:BTCUSD

market:orderbook:BTCUSD

market:liquidity:BTCUSD

market:volatility:BTCUSD

market:events:BTCUSD

research:jobs

## 10.1 Redis Usage

Redis Streams:
- Historical event consumption within configured retention.
- Research job queues.
- Recoverable event processing.

Redis Pub/Sub:
- Transient frontend notifications.
- Non-critical real-time broadcasts.

Redis latest-state keys:
- Current market snapshot.
- Current liquidity state.
- Current data-health state.

Do not use Pub/Sub as the only persistence mechanism.

The application must define message IDs, timestamps, retention and consumer recovery behaviour.

---

# 11. PYTHON RESEARCH ARCHITECTURE

The Python service will not own exchange connectivity.

It will consume structured analytics from the Go engine and historical records from PostgreSQL.

Processing flow:

```text
GO ANALYTICS
     |
     v
REDIS STREAM
     |
     v
PYTHON RESEARCH SERVICE
     |
     v
HISTORICAL COMPARISON
     |
     v
RESEARCH PAYLOAD
     |
     v
LLM GENERATION
     |
     v
OUTPUT VALIDATION
     |
     v
POSTGRESQL
```

Research categories:

- Liquidity concentration.
- Liquidity sweeps.
- Liquidity absorption.
- Orderbook imbalance.
- Liquidity withdrawal.
- Volatility analysis.
- Liquidation estimates.
- Historical market comparison.

AI must distinguish actual exchange data from estimates and interpretations.

---

# 12. FRONTEND ARCHITECTURE

## 12.1 Main Routes

```text
/
    Dashboard

/terminal/btcusd
    Live Liquidity Terminal

/research
    Research Articles

/research/:article_id
    Article Details

/historical-analysis
    Historical Comparison

/settings
    User Preferences and Risk Settings
```

## 12.2 Terminal Layout

```text
+--------------------------------------------------+
| BTCUSD | LIVE | DATA HEALTH                      |
+--------------------------------------------------+
| 1m | 5m | 15m | Price | Volume | Spread          |
+--------------------------------------------------+
|                                                  |
|              LIQUIDITY HEATMAP                   |
|                                                  |
|       PRICE LEVELS / TIME / LIQUIDITY            |
|                                                  |
+--------------------------------------------------+
| BID LIQUIDITY | ASK LIQUIDITY | IMBALANCE         |
+--------------------------------------------------+
| ORDERBOOK                                        |
+--------------------------------------------------+
| VOLATILITY / MARKET STRUCTURE                    |
+--------------------------------------------------+
| AI RESEARCH SUMMARY                              |
+--------------------------------------------------+
```

## 12.3 Heatmap Rendering

Use HTML Canvas.

Do not create thousands of DOM elements for heatmap cells.

Canvas must support:

- Price-to-pixel conversion.
- Time-to-pixel conversion.
- Liquidity normalization.
- Horizontal liquidity bands.
- Bid/ask separation.
- Zoom.
- Scroll.
- Incremental updates.
- Historical playback where data is available.

Rendering must not modify the underlying analytical market data.

---

# 13. DATABASE ARCHITECTURE

PostgreSQL will store persistent application data.

TimescaleDB will be used for appropriate time-series tables.

Primary entities:

- Instruments.
- Market trades.
- Orderbook snapshots.
- Liquidity aggregates.
- Volatility metrics.
- Market events.
- Research articles.
- Research evidence.
- System health records.

Detailed schemas, constraints, indexes, hypertables and retention policies are defined in:

docs/03_AI_RESEARCH_AND_DATABASE.md

The database must not become a bottleneck for the live WebSocket receive loop.

---

# 14. REAL-TIME DATA DISTRIBUTION

## 14.1 Backend-to-Frontend Flow

```text
DELTA EXCHANGE
      |
      v
GO MARKET ENGINE
      |
      v
LIQUIDITY CALCULATION
      |
      v
REDIS
      |
      v
GO FRONTEND GATEWAY
      |
      v
BROWSER WEBSOCKET
      |
      v
REACT CANVAS
```

The browser must receive compact, normalized market updates.

Do not send unnecessary raw exchange messages.

Use initial state snapshots followed by incremental frontend updates.

If frontend updates are dropped, the client must request a fresh snapshot rather than continue with corrupted visual state.

## 14.2 Frontend Update Policy

- Maintain bounded frontend queues.
- Coalesce redundant visual updates.
- Render at an appropriate frame rate.
- Do not block market ingestion on browser rendering.
- Track the last applied update sequence.
- Resynchronize when frontend state is incomplete.

The frontend is a visualization consumer, not the source of truth.

---

# 15. SYSTEM DEPLOYMENT ARCHITECTURE

Deploy using Northflank and Docker.

Recommended services:

### Service 1: market-engine

Technology: Go

Responsibilities:
- Delta WebSocket.
- Orderbook.
- Liquidity.
- Volatility.
- Events.

Must remain continuously running.

### Service 2: research-api

Technology: Python + FastAPI

Responsibilities:
- Research APIs.
- Historical analysis.
- LLM generation.

### Service 3: frontend

Technology: React + Vite

Responsibilities:
- Trading terminal.
- Heatmap.
- Research UI.

### Service 4: PostgreSQL

Persistent market and research data.

### Service 5: Redis

Market-state distribution and research event queues.

Services should use private networking wherever supported.

Never expose internal databases or Redis publicly without a justified security design.

---

# 16. SERVICE HEALTH MANAGEMENT

Every backend service must expose health information.

Market engine:

- Exchange connection.
- Last market message.
- Orderbook synchronization.
- Last successful snapshot.
- Processing queue health.
- Redis connection.

Research API:

- API availability.
- Database connection.
- Redis connection.
- LLM provider availability.
- Research queue status.

Frontend:

- Backend connectivity.
- Market-data freshness.
- Last applied update.
- Current terminal status.

A healthy HTTP response does not automatically mean that the market data is healthy.

---

# 17. CONFIGURATION MANAGEMENT

Use environment variables.

Examples:

```env
APP_ENV=development

DELTA_API_KEY=
DELTA_API_SECRET=

DELTA_REST_URL=
DELTA_WS_PUBLIC_URL=

REDIS_URL=

DATABASE_URL=

RESEARCH_LLM_API_KEY=
RESEARCH_LLM_MODEL=

MARKET_SYMBOL=BTCUSD

LIQUIDITY_TIMEFRAME=1m
```

These are configuration placeholders.

Use only exchange URLs verified against the official Delta API documentation.

Never commit real credentials.

Maintain separate demo and production configuration.

---

# 18. ARCHITECTURAL BOUNDARIES

The following rules are mandatory.

1. Go owns real-time exchange data ingestion.
2. Go owns local orderbook state.
3. Go owns live liquidity calculations.
4. Python owns historical research workflows and LLM orchestration.
5. React owns presentation and user interaction.
6. PostgreSQL owns persistent historical records.
7. Redis distributes real-time state and events.
8. Frontend must never calculate authoritative exchange liquidity from incomplete visual data.
9. AI must never override raw market facts.
10. No automatic real-money order execution in the initial version.

---

# 19. IMPLEMENTATION ORDER

Implement the architecture in this order:

PHASE 1:
Create Go project and Delta Exchange adapter.

PHASE 2:
Implement WebSocket lifecycle and market-data normalization.

PHASE 3:
Implement orderbook snapshot and incremental synchronization.

PHASE 4:
Implement liquidity calculations and one-minute aggregation.

PHASE 5:
Implement Redis distribution.

PHASE 6:
Implement React Canvas heatmap.

PHASE 7:
Implement volatility and event detection.

PHASE 8:
Implement PostgreSQL historical persistence.

PHASE 9:
Implement Python historical research service.

PHASE 10:
Implement LLM article generation.

PHASE 11:
Implement risk-management interface.

PHASE 12:
Deploy and validate on Northflank.

Do not skip earlier phases.

---

# 20. ARCHITECTURE ACCEPTANCE CRITERIA

The architecture is approved for implementation only when:

- Every component has a clear responsibility.
- Data flow is documented.
- Exchange API integration is verified.
- Orderbook synchronization rules are defined.
- Liquidity calculations have a separate specification.
- Redis message contracts are defined.
- Database schemas are defined.
- Frontend communication contracts are defined.
- Failure handling is defined.
- Security boundaries are defined.
- Testing requirements are defined.

Any unresolved exchange-specific behaviour must be explicitly documented rather than guessed.

END OF DOCUMENT
