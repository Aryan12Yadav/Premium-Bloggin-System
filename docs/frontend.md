
# 04 — Frontend, Security and Deployment

**Project:** BTCUSD Liquidity Intelligence & AI Research Platform  
**Frontend:** React + Vite + JavaScript  
**Backend:** Go Market Engine + Python FastAPI  
**Infrastructure:** Docker, Northflank, PostgreSQL, Redis  
**Status:** Technical Implementation Specification  
**Document Priority:** High

---

# 1. Purpose

This document defines the frontend architecture, real-time data delivery, application security and production deployment requirements.

The platform is a personal BTCUSD market research terminal.

Its primary purpose is to provide accurate and understandable market intelligence for manual trading decisions.

The frontend must display:

1. BTCUSD live market price.
2. Live candlestick chart.
3. Real-time orderbook.
4. Bid and ask liquidity.
5. Liquidity heatmap.
6. Liquidity imbalance.
7. Liquidity persistence.
8. Sweep and absorption observations.
9. Volatility metrics.
10. AI research reports.
11. Historical market analysis.
12. Market data health and freshness.

The frontend must never calculate critical exchange-side financial metrics independently when the authoritative calculation belongs to the Go Market Engine.

---

# 2. Frontend Technology

Approved stack:

| Technology | Responsibility |
|---|---|
| React | UI components |
| Vite | Development and build |
| JavaScript | Application logic |
| Tailwind CSS | Styling |
| HTML Canvas | Liquidity heatmap |
| TradingView Lightweight Charts | Candlestick chart |
| WebSocket | Real-time backend updates |
| REST API | Historical data and research |
| Zustand | Shared application state, if required |

Do not introduce TypeScript unless explicitly approved.

Do not introduce unnecessary UI libraries.

Keep the dashboard lightweight and responsive.

---

# 3. Frontend Architecture

The frontend must follow a component-oriented architecture.

```text
React Application
       |
       v
     Pages
       |
       v
   Components
       |
       v
      Hooks
       |
       v
    Services
       |
       +------------------+
       |                  |
       v                  v
    REST API           WebSocket
       |                  |
       +--------+---------+
                |
                v
           Backend
```

## 3.1 Suggested directory structure

```text
frontend/
│
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   │
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── LiquidityPage.jsx
│   │   ├── ResearchPage.jsx
│   │   ├── HistoryPage.jsx
│   │   └── SettingsPage.jsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   └── StatusBar.jsx
│   │   │
│   │   ├── market/
│   │   │   ├── PriceHeader.jsx
│   │   │   ├── MarketStats.jsx
│   │   │   ├── CandleChart.jsx
│   │   │   ├── OrderbookPanel.jsx
│   │   │   └── SpreadIndicator.jsx
│   │   │
│   │   ├── liquidity/
│   │   │   ├── LiquidityHeatmap.jsx
│   │   │   ├── LiquidityLegend.jsx
│   │   │   ├── LiquidityMetrics.jsx
│   │   │   └── LiquidityEvents.jsx
│   │   │
│   │   ├── volatility/
│   │   │   ├── VolatilityPanel.jsx
│   │   │   └── ATRPanel.jsx
│   │   │
│   │   └── research/
│   │       ├── ResearchReport.jsx
│   │       ├── ResearchFinding.jsx
│   │       ├── ScenarioPanel.jsx
│   │       └── EvidencePanel.jsx
│   │
│   ├── hooks/
│   │   ├── useMarketStream.js
│   │   ├── useMarketSnapshot.js
│   │   ├── useLiquidity.js
│   │   └── useResearch.js
│   │
│   ├── services/
│   │   ├── apiClient.js
│   │   ├── marketService.js
│   │   ├── researchService.js
│   │   └── websocketService.js
│   │
│   ├── store/
│   │   ├── marketStore.js
│   │   └── uiStore.js
│   │
│   ├── utils/
│   │   ├── formatPrice.js
│   │   ├── formatVolume.js
│   │   ├── time.js
│   │   └── validation.js
│   │
│   └── styles/
│       └── index.css
│
├── public/
├── .env.example
├── package.json
└── Dockerfile
```

This structure is a starting point. Keep each module focused and avoid unnecessary files.

---

# 4. Dashboard Layout

The primary dashboard should provide a clear overview of current market conditions.

Suggested logical layout:

```text
+-------------------------------------------------------+
| Header: BTCUSD | Price | Change | Connection Status   |
+------------------+------------------------------------+
|                  |                                    |
| Sidebar          |        Candlestick Chart            |
|                  |                                    |
| Dashboard        +------------------------------------+
| Liquidity        |                                    |
| Research         |        Liquidity Heatmap             |
| History          |                                    |
| Settings         +------------------+-----------------+
|                  | Orderbook        | Market Metrics  |
|                  |                  |                 |
+------------------+------------------+-----------------+
| Events and Liquidity Alerts                           |
+-------------------------------------------------------+
```

The exact visual design can evolve, but the information hierarchy must remain clear.

## 4.1 Dashboard sections

### Market header

Display:

- BTCUSD symbol.
- Latest validated price.
- Price change.
- Last update time.
- Exchange connection state.
- Data freshness.

### Candlestick chart

Display:

- 1-minute candles.
- 5-minute candles.
- 15-minute candles.
- Volume.
- Current price.
- Relevant event markers.

Use TradingView Lightweight Charts.

### Liquidity heatmap

Display:

- Price levels.
- Bid liquidity.
- Ask liquidity.
- Liquidity intensity.
- Liquidity persistence.
- Historical liquidity changes.

### Orderbook panel

Display:

- Best bid.
- Best ask.
- Spread.
- Bid depth.
- Ask depth.
- Selected depth levels.

### Analytics panel

Display:

- Liquidity imbalance.
- Relative volume.
- Realized volatility.
- ATR.
- Liquidity additions and reductions.
- Market event summaries.

### Research panel

Display AI-generated research reports and supporting evidence.

---

# 5. Real-Time Communication

The browser must receive market data from the platform backend, not directly from Delta Exchange for the main application data flow.

```text
Delta Exchange
      |
      v
Go Market Engine
      |
      v
Redis
      |
      v
Backend Gateway
      |
      v
Browser WebSocket
      |
      v
React State
      |
      v
UI Components
```

This design keeps exchange ingestion centralized and avoids opening unnecessary exchange connections from every browser session.

## 5.1 WebSocket responsibilities

Use WebSocket for:

- Latest market price.
- Orderbook updates.
- Liquidity snapshots and updates.
- Heatmap changes.
- Market events.
- Data health notifications.

Use REST for:

- Historical candles.
- Historical heatmap data.
- Research reports.
- Historical event queries.
- Application settings.

## 5.2 WebSocket message envelope

All frontend messages should use a consistent envelope.

Example:

```json
{
  "type": "market.heatmap.update",
  "symbol": "BTCUSD",
  "timestamp": "UTC timestamp",
  "sequence": 12345,
  "data": {},
  "quality": {
    "status": "LIVE",
    "flags": []
  }
}
```

Values are illustrative.

The backend must define the actual message schema and version it.

## 5.3 Message types

```text
market.price.snapshot
market.price.update

market.orderbook.snapshot
market.orderbook.update

market.liquidity.snapshot
market.liquidity.update

market.heatmap.snapshot
market.heatmap.update

market.volatility.update
market.event.created

market.health.update
```

The frontend must not assume that an incremental update can initialize its state.

It must first receive a valid snapshot.

## 5.4 Reconnection workflow

When the browser loses its WebSocket connection:

1. Show a disconnected status.
2. Stop presenting the last received data as current.
3. Attempt reconnection using bounded exponential backoff.
4. Reauthenticate if necessary.
5. Request a fresh snapshot.
6. Validate the snapshot.
7. Resume incremental updates only after synchronization.

If the frontend detects a sequence gap, request a new snapshot instead of applying uncertain updates.

---

# 6. Frontend State Management

Keep shared market state separate from UI state.

Suggested state:

```javascript
const initialMarketState = {
  symbol: "BTCUSD",
  price: null,
  orderbook: null,
  liquidity: null,
  heatmap: null,
  volatility: null,
  events: [],
  health: {
    status: "CONNECTING",
    lastUpdatedAt: null,
    latencyMs: null,
    qualityFlags: []
  }
};
```

This is an initial state example, not a final store implementation.

## 6.1 State rules

- Avoid duplicating the same market data in multiple stores.
- Keep state updates predictable.
- Normalize high-frequency updates before updating React state.
- Avoid triggering a full dashboard rerender for every market message.
- Keep Canvas rendering independent from unrelated React components.
- Clean up WebSocket connections when the relevant application lifecycle ends.
- Avoid creating duplicate connections through multiple hooks.

## 6.2 Rendering frequency

Market data may arrive more frequently than the browser should redraw.

Use a controlled rendering strategy:

- Process incoming messages immediately.
- Maintain the latest validated state.
- Batch visual updates.
- Use `requestAnimationFrame` for Canvas drawing.
- Avoid expensive calculations inside React render functions.
- Preserve the latest data even when visual updates are coalesced.

Do not discard important analytical events just to reduce visual rendering frequency.

---

# 7. Liquidity Heatmap Rendering

The heatmap is a primary feature of the platform.

Use HTML Canvas for efficient rendering.

Do not render thousands of liquidity cells as individual React DOM elements.

## 7.1 Heatmap dimensions

The heatmap should support:

- X-axis: time.
- Y-axis: price.
- Cell intensity: visible liquidity.
- Side distinction: bid versus ask.
- Configurable price range.
- Configurable historical window.
- Zoom and pan.
- Hover inspection.

## 7.2 Liquidity intensity

A configurable normalization method should map liquidity values to visual intensity.

One possible method is:

\[
I =
\frac{\log(1+L)-\log(1+L_{min})}
{\log(1+L_{max})-\log(1+L_{min})}
\]

Where:

- \(L\) is liquidity.
- \(L_{min}\) and \(L_{max}\) define the normalization range.
- \(I\) is the normalized intensity.

Handle invalid ranges and equal minimum/maximum values explicitly.

Do not let one unusually large liquidity level make every other level visually invisible.

Consider configurable percentile-based normalization, while preserving the underlying numeric values.

## 7.3 Heatmap data

The frontend should receive aggregated heatmap data from the backend.

Each cell should contain:

- Bucket timestamp.
- Price bin.
- Bid liquidity.
- Ask liquidity.
- Time-weighted liquidity.
- Maximum observed liquidity.
- Coverage.
- Data-quality status.

## 7.4 Hover inspection

When the user moves the cursor over a cell, show:

- Exact price bin.
- Time bucket.
- Bid liquidity.
- Ask liquidity.
- Combined liquidity.
- Persistence.
- Additions and reductions.
- Coverage and quality flags.

Do not display unavailable values as zero.

## 7.5 Rendering safeguards

- Handle empty data.
- Handle missing buckets.
- Handle partial coverage.
- Handle resize events.
- Handle high-DPI screens.
- Avoid blocking the main thread.
- Avoid unbounded historical data in browser memory.
- Use appropriate visible-window loading.

---

# 8. Candlestick Chart

Use TradingView Lightweight Charts.

Requirements:

- BTCUSD price candles.
- 1m, 5m and 15m intervals.
- Volume series.
- Current price line.
- Event markers.
- Historical data loading.
- Live candle updates.

The frontend should consume normalized candle data from the backend.

Do not mix incomplete and finalized candles without identifying their status.

The chart must handle:

- Missing candles.
- Duplicate updates.
- Out-of-order updates.
- Reconnection.
- Historical backfill.

---

# 9. Frontend API Integration

Use a centralized API client.

Suggested environment variables:

```env
VITE_API_BASE_URL=
VITE_WS_BASE_URL=
```

These values are public frontend configuration, not secrets.

Never place private API keys in `VITE_` variables.

## 9.1 API service responsibilities

`apiClient.js`:

- Base URL configuration.
- Request timeout.
- Authentication header management.
- Standard error handling.
- Response parsing.

`marketService.js`:

- Historical candles.
- Historical liquidity.
- Market events.
- Market snapshots.

`researchService.js`:

- Create research job.
- Get research job status.
- Retrieve research reports.

`websocketService.js`:

- Connect.
- Authenticate.
- Subscribe.
- Unsubscribe.
- Reconnect.
- Handle snapshots.
- Handle incremental updates.
- Detect sequence gaps.

## 9.2 API error format

Use a consistent response:

```json
{
  "error": {
    "code": "DATA_NOT_AVAILABLE",
    "message": "Requested market data is unavailable.",
    "request_id": "request-id"
  }
}
```

Do not expose stack traces, database errors or secret configuration in API responses.

---

# 10. Authentication and Authorization

The application must use secure authentication even if initially operated by one person.

Recommended approach:

- Secure login.
- Short-lived access token.
- Refresh mechanism.
- Server-side authorization.
- Secure logout.
- Session invalidation.

If using browser cookies:

- Set `HttpOnly`.
- Set `Secure` in production.
- Use an appropriate `SameSite` policy.
- Implement CSRF protection where required.
- Restrict allowed origins.

If using bearer tokens:

- Do not store sensitive long-lived credentials in localStorage.
- Define token expiration and refresh behaviour.
- Protect all private API and WebSocket operations.

Do not assume that hiding a frontend route provides authorization.

Authorization must be enforced by the backend.

---

# 11. Application Security

## 11.1 Secret management

Never commit:

- Exchange API keys.
- Exchange API secrets.
- Database credentials.
- Redis credentials.
- AI provider keys.
- JWT signing secrets.

Use environment variables or the hosting provider's secret-management facility.

Maintain `.env.example` with placeholder values only.

## 11.2 Exchange API permissions

For the initial platform:

- Use public market-data endpoints without private credentials wherever possible.
- If private account data is later added, use the minimum required permissions.
- Do not enable withdrawal permissions.
- Do not expose exchange credentials to React.
- Keep private exchange integrations isolated in backend services.

Real-money automatic order execution is outside the initial scope.

## 11.3 API protection

Implement:

- Authentication.
- Authorization.
- Rate limiting.
- Request size limits.
- Input validation.
- Timeouts.
- CORS allowlists.
- Secure error responses.
- Audit logging for sensitive operations.

## 11.4 WebSocket protection

- Authenticate private WebSocket sessions.
- Validate subscription permissions.
- Limit connections per user.
- Limit subscription count.
- Apply message size limits.
- Detect idle connections.
- Disconnect abusive clients.
- Prevent unauthorized channel subscriptions.

## 11.5 Frontend security

- Never trust user-provided input.
- Avoid unsafe HTML rendering.
- Sanitize untrusted text where necessary.
- Do not expose backend stack traces.
- Do not embed API secrets in build output.
- Use HTTPS in production.
- Configure an appropriate Content Security Policy.

---

# 12. Docker Strategy

Each independently deployed service must have its own Dockerfile.

Required services:

```text
backend-go/
    Dockerfile

research-python/
    Dockerfile

frontend/
    Dockerfile
```

PostgreSQL and Redis should use managed services or separately maintained containers.

Do not combine all application processes into one container.

## 12.1 Go Dockerfile requirements

- Multi-stage build.
- Build binary in a Go build image.
- Use a minimal runtime image.
- Run as a non-root user.
- Include health checks where supported.
- Handle SIGTERM gracefully.
- Do not include source-control credentials.

## 12.2 Python Dockerfile requirements

- Use a pinned dependency file.
- Install only required production dependencies.
- Run as a non-root user.
- Configure worker count based on resource limits.
- Handle shutdown signals.
- Do not run database migrations automatically from every worker instance.

## 12.3 Frontend Dockerfile requirements

- Build React assets in a Node build stage.
- Serve static assets through a production web server.
- Configure SPA route fallback.
- Use correct cache headers.
- Do not include `.env` secrets in the build.

---

# 13. Northflank Deployment Architecture

Deploy the application as independent services.

```text
                  Users
                    |
                    v
              Frontend Service
                    |
                    v
              Backend Gateway
                 /       \
                v         v
        Go Market Engine  Python API
                |         |
                v         v
               Redis   PostgreSQL
                          |
                          v
                      TimescaleDB
```

The diagram represents logical communication. Actual Northflank networking must use supported private service connections and configured endpoints.

## 13.1 Required services

| Service | Deployment type |
|---|---|
| Frontend | Docker service |
| Go Market Engine | Always-on Docker service |
| Python Research API | Docker service |
| PostgreSQL + TimescaleDB | Managed or persistent database |
| Redis | Managed or persistent service |

## 13.2 Go Market Engine deployment

Requirements:

- Keep the service continuously running.
- Disable scale-to-zero for the live ingestion process.
- Configure restart behaviour.
- Configure health checks.
- Use private Redis connectivity.
- Load exchange configuration from secrets.
- Handle graceful shutdown.
- Reconnect safely after network failures.

A successful container health check must not be treated as proof that the exchange orderbook is synchronized.

## 13.3 Python API deployment

Requirements:

- Expose only required API routes.
- Use private database connectivity.
- Use private Redis connectivity.
- Configure request timeouts.
- Configure worker limits.
- Protect expensive research endpoints.
- Monitor AI provider failures.

## 13.4 Frontend deployment

Requirements:

- Serve over HTTPS.
- Configure API and WebSocket base URLs.
- Restrict CORS on backend services.
- Configure SPA fallback.
- Avoid exposing internal service addresses.
- Do not include secrets in build variables.

## 13.5 Database deployment

Requirements:

- Persistent storage.
- Automated backups.
- Restore testing.
- Connection limits.
- Migration process.
- Storage monitoring.
- Retention strategy.

Do not assume that container-local storage is persistent.

---

# 14. Environment Configuration

Each service must have its own configuration.

## 14.1 Go Market Engine

```env
APP_ENV=production
MARKET_SYMBOL=BTCUSD

DELTA_API_BASE_URL=
DELTA_WS_URL=

REDIS_URL=
DATABASE_URL=

LOG_LEVEL=info
```

## 14.2 Python Research API

```env
APP_ENV=production

DATABASE_URL=
REDIS_URL=

AI_PROVIDER=
AI_MODEL=
AI_API_KEY=

JWT_SECRET=
LOG_LEVEL=info
```

## 14.3 Frontend

```env
VITE_API_BASE_URL=
VITE_WS_BASE_URL=
```

All values are placeholders.

Antigravity must verify current official Delta Exchange URLs and API documentation before implementation.

Do not invent endpoints or WebSocket channel names.

---

# 15. Graceful Shutdown and Recovery

All backend services must support graceful shutdown.

## Go Market Engine

On termination:

1. Stop accepting new work.
2. Stop or close exchange subscriptions safely.
3. Complete or explicitly abandon pending processing.
4. Flush safe buffered writes.
5. Close Redis and database connections.
6. Exit within the configured shutdown deadline.

On restart:

1. Reconnect to Delta.
2. Revalidate instrument metadata if required.
3. Rebuild the local orderbook from a valid snapshot.
4. Resume trusted analytics only after synchronization.

## Python Research API

On termination:

1. Stop accepting new requests.
2. Finish or cancel in-flight work safely.
3. Leave recoverable jobs in a known state.
4. Close database and Redis connections.

Research workers must support retry and idempotency.

---

# 16. Monitoring and Alerts

Monitor:

### Application

- Service uptime.
- CPU usage.
- Memory usage.
- Restart count.
- Request errors.
- Request latency.

### Market Engine

- Exchange connection state.
- Orderbook synchronization state.
- Market data freshness.
- Sequence gaps.
- Queue depth.
- Dropped-message count.
- Processing latency.

### Database and Redis

- Database connections.
- Query latency.
- Storage usage.
- Redis memory.
- Stream lag.
- Failed jobs.

### Frontend

- WebSocket connection state.
- Reconnection count.
- Snapshot recovery count.
- Rendering performance.
- JavaScript errors.

Alerts should be generated for critical failures such as stale market data, persistent sequence gaps, database unavailability and Redis processing backlog.

---

# 17. Deployment Workflow

Recommended deployment sequence:

1. Create PostgreSQL/TimescaleDB service.
2. Create Redis service.
3. Configure private networking.
4. Deploy Go Market Engine.
5. Verify Delta connectivity and orderbook synchronization.
6. Deploy Python Research API.
7. Run controlled database migrations.
8. Deploy frontend.
9. Configure HTTPS and allowed origins.
10. Validate end-to-end data delivery.
11. Run historical replay and integration tests.
12. Enable live dashboard access.

Do not expose the frontend as production-ready before backend data-quality checks pass.

---

# 18. Backup and Recovery

The database must have an explicit backup policy.

Requirements:

- Automated backups.
- Defined recovery point objective (RPO).
- Defined recovery time objective (RTO).
- Restore tests.
- Migration rollback strategy.
- Retention configuration.
- Backup access restrictions.

Redis persistence should be configured according to the role of each Redis dataset.

Historical data stored permanently in PostgreSQL must not depend exclusively on Redis persistence.

---

# 19. Production Acceptance Criteria

### Frontend

- [ ] React dashboard loads successfully.
- [ ] Candlestick chart supports 1m, 5m and 15m.
- [ ] Heatmap renders large datasets efficiently.
- [ ] Bid and ask liquidity are visually distinguishable.
- [ ] Hover inspection displays correct data.
- [ ] Data-quality states are visible.
- [ ] WebSocket reconnects safely.
- [ ] Snapshot recovery works after missed updates.
- [ ] Historical data loads without blocking live updates.

### Security

- [ ] HTTPS is enabled.
- [ ] Secrets are not included in frontend builds.
- [ ] Backend authentication works.
- [ ] Authorization is enforced server-side.
- [ ] WebSocket subscriptions are protected.
- [ ] CORS is restricted.
- [ ] API rate limiting is configured.
- [ ] No withdrawal permission is required for initial market-data functionality.

### Deployment

- [ ] All services build from Dockerfiles.
- [ ] Go Market Engine stays continuously running.
- [ ] Health checks are configured.
- [ ] Graceful shutdown is tested.
- [ ] Database backups are configured.
- [ ] Recovery is tested.
- [ ] Private service communication works.
- [ ] Production logs and metrics are available.

---

# 20. Final Engineering Rules

1. React displays market data; Go calculates authoritative live metrics.
2. The browser must not connect directly to Delta for the main market-data pipeline.
3. A WebSocket connection does not guarantee data freshness.
4. A fresh snapshot is required before applying incremental updates after recovery.
5. Canvas should render heatmap cells efficiently.
6. Rendering updates may be batched, but important market events must not be silently discarded.
7. No private secrets may enter frontend builds.
8. Backend authorization is mandatory.
9. The Go Market Engine must not scale to zero.
10. Database persistence and backup must be verified.
11. Graceful shutdown and restart recovery must be tested.
12. Production deployment must not be treated as proof of market-data correctness.

**The frontend should make market intelligence understandable without hiding uncertainty, while the deployment architecture must preserve the reliability of the live data pipeline.**