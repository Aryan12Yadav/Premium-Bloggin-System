# AGENTS.md
# MASTER ENGINEERING INSTRUCTIONS

## 1. PROJECT IDENTITY

Project Name: BTCUSD Liquidity Intelligence & AI Research Platform

Project Type: Personal Cryptocurrency Trading Intelligence System

Primary Exchange: Delta Exchange

Primary Instrument: BTCUSD Perpetual

Primary Objective:

Build a reliable, low-latency market intelligence platform that collects real-time Delta Exchange market data, tracks liquidity through a 1-minute heatmap, analyses market volatility, generates AI-powered research blogs and supports informed manual trading decisions.

The platform is intended for personal use with real-money trading.

The system must prioritize data accuracy, reliability, security and risk management over unnecessary complexity.

---

## 2. CORE PRODUCT MODULES

The platform consists of the following modules:

### A. Real-Time Market Data Engine

- Connect to Delta Exchange public WebSocket APIs.
- Receive BTCUSD market trades.
- Receive orderbook snapshots and incremental updates.
- Receive mark price and supported candle updates.
- Collect historical market data through REST APIs.
- Maintain a synchronized local orderbook.
- Detect missing or invalid market updates.
- Recover automatically from connection failures.

### B. Liquidity Intelligence Engine

- Calculate bid-side liquidity.
- Calculate ask-side liquidity.
- Aggregate liquidity into configurable price bins.
- Calculate liquidity concentration.
- Calculate orderbook imbalance.
- Calculate liquidity persistence.
- Track liquidity additions and removals.
- Detect potential liquidity sweeps.
- Detect potential liquidity absorption.
- Detect liquidity withdrawal.

### C. Live Heatmap Terminal

- Display BTCUSD horizontal liquidity heatmap.
- Use a 1-minute aggregation timeframe.
- Continue receiving live updates without waiting for the next minute.
- Display price levels and historical liquidity.
- Display bid and ask liquidity independently.
- Support zooming, scrolling and timeframe selection.
- Display orderbook and volatility metrics.
- Show market data health status.

### D. Market Analytics

- Calculate 1-minute returns.
- Calculate realized volatility.
- Calculate ATR.
- Calculate volume changes.
- Calculate orderbook imbalance.
- Analyse 1-minute, 5-minute and 15-minute market structure.
- Compare current and historical market conditions.

### E. AI Research Engine

- Analyse structured market data.
- Generate evidence-based research articles.
- Compare current market conditions with historical sessions.
- Explain liquidity and volatility events.
- Generate bullish and bearish scenarios.
- Identify invalidation conditions.
- Clearly distinguish measured facts from interpretations.

### F. Risk Management

- Calculate position size.
- Calculate planned stop-loss risk.
- Account for fees and estimated slippage.
- Apply configurable daily loss limits.
- Detect stale market data.
- Provide manual trading decision support.

The initial version must not automatically execute real trades.

---

## 3. APPROVED TECHNOLOGY STACK

Use the following technology stack unless an approved architecture decision explicitly changes it.

### Backend: Go

Purpose:
- Exchange connectivity.
- WebSocket processing.
- Orderbook management.
- Liquidity calculations.
- Market event detection.
- Real-time data distribution.

Libraries:
- Gin for HTTP APIs where needed.
- Gorilla WebSocket for exchange connectivity.
- pgx for PostgreSQL.
- go-redis for Redis.
- Standard Go concurrency primitives.

Use Goroutines and Channels carefully.

Avoid unnecessary goroutine creation and unbounded queues.

### Research Backend: Python

Framework: FastAPI

Libraries:
- NumPy
- Pandas
- Pydantic
- SQLAlchemy or SQLModel
- PostgreSQL driver
- LLM provider SDK

Purpose:
- Historical analysis.
- Statistical research.
- AI article generation.
- Research validation.

### Frontend: React

Framework:
- React
- Vite
- JavaScript

Visualization:
- HTML Canvas for liquidity heatmap.
- TradingView Lightweight Charts for candlestick charts.

Do not use TypeScript unless explicitly approved.

### Infrastructure

- PostgreSQL
- TimescaleDB
- Redis
- Docker
- Northflank

---

## 4. ARCHITECTURAL RULES

Follow a modular, layered architecture.

### Go Architecture

Preferred execution flow:

Exchange Client
    ->
Market Data Processor
    ->
Orderbook Manager
    ->
Liquidity Manager
    ->
Analytics Manager
    ->
Stream Publisher

Keep responsibilities separated.

Do not put exchange connectivity, mathematical calculations and database operations in the same file or package.

### Python Architecture

Follow:

API Router
    ->
Service
    ->
Manager
    ->
Repository
    ->
Database Model

Rules:

- Routers must not contain business logic.
- Services coordinate business workflows.
- Managers handle specialized analysis and LLM operations.
- Repositories handle persistence.
- Models represent database entities.
- Schemas validate incoming and outgoing data.

### React Architecture

Separate:

- Pages.
- Components.
- Hooks.
- Services.
- State management.
- Canvas rendering logic.

Do not put all terminal functionality inside one component.

Keep high-frequency Canvas rendering independent of unnecessary React re-renders.

---

## 5. NON-NEGOTIABLE MARKET DATA RULES

Market data accuracy is mandatory.

1. Never assume an orderbook snapshot is complete without validation.
2. Never apply incremental updates to an invalid local orderbook.
3. Validate sequence numbers wherever the exchange provides them.
4. Detect missing updates and sequence gaps.
5. Resynchronize from a fresh snapshot when required.
6. Track exchange timestamps and local receive timestamps.
7. Use UTC for all persistent timestamps.
8. Detect stale data.
9. Mark market data invalid during synchronization failures.
10. Never silently publish incomplete orderbook data as valid.

Every market-data component must expose its health status.

Possible states:

- CONNECTING
- LIVE
- DELAYED
- STALE
- RESYNCING
- DISCONNECTED
- ERROR

If the exchange does not provide a required field, do not fabricate it.

Verify the current official Delta Exchange API documentation before implementing any exchange-specific integration.

Official documentation:

https://docs.delta.exchange/

---

## 6. MATHEMATICAL ACCURACY RULES

All market calculations must be mathematically documented.

For every formula, define:

- Input variables.
- Output variables.
- Units.
- Required data.
- Calculation frequency.
- Edge cases.
- Expected numerical range.

Use floating-point arithmetic carefully.

For price and quantity comparisons, respect exchange tick size and quantity precision.

Do not use arbitrary thresholds without documenting their purpose.

Use historical baselines where appropriate.

Do not mix:

- Visible orderbook liquidity.
- Executed trading volume.
- Estimated liquidation exposure.
- Actual liquidation events.

These are different data categories.

---

## 7. HEATMAP RULES

The liquidity heatmap must use:

- X-axis: Time.
- Y-axis: Price.
- Horizontal cells: Aggregated price-level liquidity.
- Color intensity: Normalized liquidity strength.

The default analytical aggregation timeframe is one minute.

However, live market data must continue updating continuously.

Store historical one-minute liquidity aggregates.

Do not overwrite historical liquidity measurements using current orderbook data.

Display bid-side and ask-side liquidity independently.

The UI must indicate whether the heatmap represents:

- Visible orderbook liquidity.
- Historical liquidity.
- Estimated liquidation levels.

Never label estimated liquidation levels as actual liquidation data.

---

## 8. AI RESEARCH RULES

AI must use verified analytical data supplied by the backend.

Never generate market research using invented prices, volumes or events.

Never present estimated liquidation levels as actual liquidations.

Never confuse:

- Order cancellation with trade execution.
- Liquidity concentration with guaranteed support or resistance.
- Historical correlation with causation.
- Market hypotheses with confirmed events.

Every research article should contain:

- Instrument.
- Analysis timeframe.
- Start and end timestamps.
- Market snapshot.
- Liquidity analysis.
- Volatility analysis.
- Important events.
- Historical comparison.
- Interpretation.
- Risk factors.
- Data sources.

AI must explicitly mention missing or unreliable data.

AI must not guarantee market direction or trading profitability.

---

## 9. REAL-MONEY TRADING SAFETY

This is a trading decision-support system.

The initial version must not place automatic real-money orders.

Mandatory safeguards:

- Stale-data detection.
- Orderbook synchronization validation.
- Configurable risk per trade.
- Position-size calculation.
- Stop-loss risk calculation.
- Fee and slippage estimates.
- Maximum daily loss setting.
- Maximum position size.
- Emergency disable switch.

Never enable real trading API permissions automatically.

Never request or store withdrawal permissions.

Never expose exchange API credentials to frontend code.

A stop-loss does not guarantee execution at its requested price.

---

## 10. PERFORMANCE RULES

Optimize only where measurement demonstrates a bottleneck.

Mandatory requirements:

1. Avoid duplicate exchange connections.
2. Use bounded queues.
3. Implement backpressure.
4. Avoid unnecessary memory allocations in hot paths.
5. Avoid synchronous database writes inside the WebSocket receive loop.
6. Batch historical writes.
7. Keep orderbook state in memory.
8. Publish aggregated market updates.
9. Avoid unnecessary frontend re-renders.
10. Use incremental Canvas updates where practical.

Measure:

- Exchange-to-local receive delay.
- Local processing duration.
- Redis publication duration.
- Frontend delivery delay.
- Rendering duration.
- Queue depth.
- Dropped messages.

Never claim a latency target has been achieved without benchmark evidence.

---

## 11. SECURITY RULES

- Store credentials in environment variables or managed secrets.
- Never hardcode API keys.
- Never commit .env files.
- Maintain .env.example.
- Validate all external input.
- Restrict private endpoints.
- Use secure database credentials.
- Follow least-privilege permissions.
- Protect production configuration.
- Do not log API secrets.
- Do not expose internal service credentials to React.

---

## 12. TESTING RULES

Every module must have appropriate tests.

Mandatory tests:

- Unit tests.
- Integration tests.
- WebSocket reconnection tests.
- Orderbook synchronization tests.
- Liquidity formula tests.
- Volatility calculation tests.
- Historical replay tests.
- Redis failure tests.
- Database failure tests.
- AI output validation tests.
- Risk calculation tests.

Do not consider a feature complete simply because it compiles.

The feature must pass its documented acceptance criteria.

Never disable failing tests to make a build pass.

---

## 13. ERROR HANDLING

All services must implement structured error handling.

Do not silently ignore errors.

Classify errors into:

- Recoverable.
- Non-recoverable.
- External service failure.
- Invalid market data.
- Synchronization failure.
- Persistence failure.
- Configuration failure.

Implement controlled retries with exponential backoff and jitter where appropriate.

Do not retry permanent validation errors indefinitely.

Never allow a failed market-data synchronization to silently continue with an old orderbook.

---

## 14. DOCUMENTATION REQUIREMENTS

The following documentation files are mandatory:

1. docs/01_PROJECT_ARCHITECTURE.md
2. docs/02_MARKET_ENGINE_AND_MATHEMATICS.md
3. docs/03_AI_RESEARCH_AND_DATABASE.md
4. docs/04_FRONTEND_SECURITY_AND_DEPLOYMENT.md
5. docs/05_TESTING_AND_PRODUCTION_RULES.md

Read the relevant documentation before implementing a module.

If implementation conflicts with documentation:

1. Stop implementation.
2. Explain the conflict.
3. Propose a technical solution.
4. Wait for approval if the architecture or trading safety is affected.
5. Update the relevant documentation after approval.

Do not create additional documentation files without approval.

---

## 15. DEVELOPMENT WORKFLOW

Follow this sequence:

PHASE 1:
Documentation and architecture validation.

PHASE 2:
Delta Exchange connectivity.

PHASE 3:
Orderbook synchronization.

PHASE 4:
Liquidity mathematics.

PHASE 5:
Live heatmap.

PHASE 6:
Volatility and market event detection.

PHASE 7:
Historical analytics.

PHASE 8:
AI research generation.

PHASE 9:
Risk management.

PHASE 10:
Northflank deployment and production validation.

Complete one phase at a time.

Do not implement the entire application in one uncontrolled coding operation.

Before starting the next phase:

- Run tests.
- Review code.
- Validate data correctness.
- Document completed functionality.
- Identify remaining issues.

---

## 16. AGENT BEHAVIOUR

Act as a senior production software engineer.

Before implementing:

1. Read relevant project documentation.
2. Inspect the existing codebase.
3. Understand the current architecture.
4. Identify dependencies.
5. Explain the implementation plan.

While implementing:

- Follow single responsibility principles.
- Prefer simple maintainable solutions.
- Avoid unnecessary abstractions.
- Avoid unnecessary dependencies.
- Write readable production-grade code.
- Include appropriate error handling.
- Add tests.

After implementing:

- Run relevant tests.
- Check formatting.
- Check build.
- Check security-sensitive changes.
- Report files changed.
- Report tests executed.
- Report known limitations.

Do not claim that tests passed if they were not executed.

Do not claim that an integration works without verifying it.

Do not fabricate successful deployment results.

---

## 17. FINAL ACCEPTANCE PRINCIPLE

The project is considered production-ready only when:

- Market data ingestion is reliable.
- Orderbook synchronization is validated.
- Liquidity calculations pass mathematical tests.
- Heatmap data matches backend calculations.
- Historical aggregation is reproducible.
- AI articles are evidence-backed.
- Risk calculations are independently verified.
- Failure recovery works.
- Security checks pass.
- Northflank deployment is verified.

The highest priority is:

DATA CORRECTNESS > RELIABILITY > SECURITY > RISK CONTROL > LATENCY OPTIMIZATION > VISUAL FEATURES.

Never compromise data correctness or trading safety for speed.