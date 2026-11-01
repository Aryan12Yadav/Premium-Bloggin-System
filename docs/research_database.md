# 03 — AI Research and Database Architecture

**Project:** BTCUSD Liquidity Intelligence & AI Research Platform  
**Primary Services:** Python Research API, PostgreSQL, TimescaleDB, Redis  
**Status:** Technical Implementation Specification  
**Document Priority:** Critical

---

# 1. Purpose

This document defines how the platform stores market data, processes historical information, generates analytical insights and produces AI-powered BTCUSD research reports.

The system must support:

1. Historical market data storage.
2. Liquidity and heatmap history.
3. Volatility and market-event history.
4. Historical comparisons.
5. AI-assisted market research.
6. Structured research reports.
7. Evidence-based market interpretation.
8. Reliable data retrieval for frontend dashboards.

The AI Research service must never replace the Go Market Engine.

The Go Market Engine calculates real-time market metrics. Python consumes validated data and performs historical analysis, research orchestration and AI interpretation.

---

# 2. Architecture

```text
             GO MARKET ENGINE
                    |
                    v
                  REDIS
                    |
          +---------+----------+
          |                    |
          v                    v
    Live Market Data     Historical Events
          |                    |
          +---------+----------+
                    |
                    v
             PYTHON RESEARCH API
                    |
          +---------+----------+
          |                    |
          v                    v
    Research Services     Historical Queries
          |                    |
          v                    v
    Analysis Manager      Repository Layer
          |                    |
          +---------+----------+
                    |
                    v
                PostgreSQL
                TimescaleDB
                    |
                    v
             Research Dataset
                    |
                    v
               AI Manager
                    |
                    v
             Research Report
                    |
                    v
              Frontend API
```

## 2.1 Service responsibilities

| Service | Responsibility |
|---|---|
| Go Market Engine | Live ingestion and calculations |
| Redis | Real-time state, event distribution and jobs |
| PostgreSQL | Persistent application and research data |
| TimescaleDB | Time-series storage and querying |
| Python Research API | Historical analysis and orchestration |
| AI Manager | Evidence-based research generation |
| React Frontend | Display and user interaction |

Python must not independently reconstruct the live orderbook from incomplete frontend messages.

---

# 3. Python Research Architecture

Use FastAPI with a layered architecture.

Required request flow:

```text
API Router
    |
    v
Research Service
    |
    v
Research Manager
    |
    v
Analysis / AI Manager
    |
    v
Repository
    |
    v
Database
```

## 3.1 Suggested directory structure

```text
research-python/
│
├── app/
│   ├── main.py
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── research_routes.py
│   │   │   ├── market_routes.py
│   │   │   ├── history_routes.py
│   │   │   └── health_routes.py
│   │   │
│   │   └── dependencies.py
│   │
│   ├── services/
│   │   ├── research_service.py
│   │   ├── historical_service.py
│   │   └── market_context_service.py
│   │
│   ├── managers/
│   │   ├── research_manager.py
│   │   ├── analysis_manager.py
│   │   ├── ai_manager.py
│   │   └── report_manager.py
│   │
│   ├── analysis/
│   │   ├── liquidity_analysis.py
│   │   ├── volatility_analysis.py
│   │   ├── volume_analysis.py
│   │   ├── market_structure.py
│   │   ├── sweep_analysis.py
│   │   └── historical_comparison.py
│   │
│   ├── repositories/
│   │   ├── market_repository.py
│   │   ├── liquidity_repository.py
│   │   ├── event_repository.py
│   │   └── research_repository.py
│   │
│   ├── models/
│   │   ├── market.py
│   │   ├── liquidity.py
│   │   ├── event.py
│   │   └── research.py
│   │
│   ├── schemas/
│   │   ├── research_schema.py
│   │   ├── market_schema.py
│   │   └── report_schema.py
│   │
│   ├── integrations/
│   │   ├── redis_client.py
│   │   └── llm_client.py
│   │
│   └── core/
│       ├── config.py
│       ├── database.py
│       ├── logging.py
│       └── exceptions.py
│
├── tests/
├── requirements.txt
└── Dockerfile
```

## 3.2 Architecture rules

- Routers only handle HTTP requests and responses.
- Services coordinate application workflows.
- Managers own analysis and orchestration logic.
- Repositories handle database operations.
- Models define persistent database structures.
- Schemas validate API input and output.
- AI prompts must remain separate from database logic.
- No business logic inside API routes.

Use dependency injection for database sessions, Redis clients and external AI providers.

---

# 4. PostgreSQL and TimescaleDB

PostgreSQL is the primary persistent database.

TimescaleDB should be used for high-volume time-series tables where time-based querying and retention are important.

Do not convert every relational table into a hypertable.

Use regular PostgreSQL tables for users, settings, research metadata and other relational entities.

## 4.1 Database design principles

- Store timestamps in UTC.
- Preserve exchange timestamps separately from receive timestamps.
- Use appropriate decimal or integer-based precision for financial values.
- Avoid floating-point types for persisted exchange prices and quantities when exact decimal representation is required.
- Store contract metadata or metadata version references with relevant calculations.
- Index common query filters.
- Partition or hypertable only where justified by workload.
- Use migrations for schema changes.
- Define retention policies only after storage requirements are understood.

---

# 5. Database Tables

The following are logical schema specifications. Antigravity must create actual SQLAlchemy models and migrations.

## 5.1 instruments

Stores verified exchange instrument metadata.

| Column | Type |
|---|---|
| id | UUID / BIGINT |
| exchange | VARCHAR |
| symbol | VARCHAR |
| instrument_id | VARCHAR |
| contract_type | VARCHAR |
| contract_size | NUMERIC |
| tick_size | NUMERIC |
| quantity_step | NUMERIC |
| settlement_asset | VARCHAR |
| metadata_version | VARCHAR |
| effective_from | TIMESTAMPTZ |
| effective_until | TIMESTAMPTZ nullable |
| created_at | TIMESTAMPTZ |

Requirements:

- Preserve historical metadata changes.
- Do not overwrite old contract specifications without traceability.
- Reference the applicable metadata version when calculating notional values.

## 5.2 market_trades

Stores normalized trades.

| Column | Type |
|---|---|
| id | BIGINT |
| exchange | VARCHAR |
| symbol | VARCHAR |
| trade_id | VARCHAR |
| price | NUMERIC |
| quantity | NUMERIC |
| notional | NUMERIC nullable |
| side | VARCHAR nullable |
| exchange_timestamp | TIMESTAMPTZ |
| received_timestamp | TIMESTAMPTZ |
| metadata_version | VARCHAR nullable |
| quality_flags | JSONB |

Requirements:

- Use exchange trade identity for deduplication when available.
- Preserve raw exchange timestamps.
- Add a suitable time-based index or hypertable.
- Avoid assuming trade-side information exists for every trade.

## 5.3 market_candles

Stores 1m, 5m and 15m candles.

| Column | Type |
|---|---|
| id | BIGINT |
| exchange | VARCHAR |
| symbol | VARCHAR |
| interval | VARCHAR |
| open | NUMERIC |
| high | NUMERIC |
| low | NUMERIC |
| close | NUMERIC |
| volume | NUMERIC |
| trade_count | BIGINT |
| start_timestamp | TIMESTAMPTZ |
| end_timestamp | TIMESTAMPTZ |
| is_complete | BOOLEAN |
| quality_flags | JSONB |

Unique logical key:

```text
exchange + symbol + interval + start_timestamp
```

Incomplete candles must be distinguishable from finalized candles.

## 5.4 orderbook_snapshots

Stores selected orderbook snapshots.

| Column | Type |
|---|---|
| id | BIGINT |
| exchange | VARCHAR |
| symbol | VARCHAR |
| exchange_timestamp | TIMESTAMPTZ |
| received_timestamp | TIMESTAMPTZ |
| sequence | BIGINT nullable |
| bids | JSONB |
| asks | JSONB |
| synchronized | BOOLEAN |
| quality_flags | JSONB |

Do not persist every high-frequency incremental update to PostgreSQL by default.

The ingestion and database workload must be benchmarked first.

If full raw event replay is required, use an explicitly designed archival mechanism with storage and retention limits.

## 5.5 liquidity_metrics

Stores aggregated liquidity analytics.

| Column | Type |
|---|---|
| id | BIGINT |
| exchange | VARCHAR |
| symbol | VARCHAR |
| timestamp | TIMESTAMPTZ |
| price_bin | NUMERIC |
| bid_liquidity | NUMERIC |
| ask_liquidity | NUMERIC |
| total_bid_liquidity | NUMERIC |
| total_ask_liquidity | NUMERIC |
| imbalance | NUMERIC nullable |
| bid_time_weighted | NUMERIC nullable |
| ask_time_weighted | NUMERIC nullable |
| metadata_version | VARCHAR |
| quality_flags | JSONB |

## 5.6 heatmap_buckets

Stores one-minute heatmap aggregation.

| Column | Type |
|---|---|
| id | BIGINT |
| exchange | VARCHAR |
| symbol | VARCHAR |
| bucket_start | TIMESTAMPTZ |
| price_bin | NUMERIC |
| bid_open | NUMERIC |
| bid_high | NUMERIC |
| bid_low | NUMERIC |
| bid_close | NUMERIC |
| ask_open | NUMERIC |
| ask_high | NUMERIC |
| ask_low | NUMERIC |
| ask_close | NUMERIC |
| bid_time_weighted | NUMERIC |
| ask_time_weighted | NUMERIC |
| bid_added | NUMERIC |
| ask_added | NUMERIC |
| bid_removed | NUMERIC |
| ask_removed | NUMERIC |
| coverage_ms | BIGINT |
| is_complete | BOOLEAN |
| quality_flags | JSONB |

Unique logical key:

```text
exchange + symbol + bucket_start + price_bin
```

## 5.7 market_events

Stores detected market events.

| Column | Type |
|---|---|
| id | UUID |
| event_id | VARCHAR |
| exchange | VARCHAR |
| symbol | VARCHAR |
| event_type | VARCHAR |
| direction | VARCHAR nullable |
| start_timestamp | TIMESTAMPTZ |
| end_timestamp | TIMESTAMPTZ nullable |
| start_price | NUMERIC nullable |
| end_price | NUMERIC nullable |
| metrics | JSONB |
| evidence | JSONB |
| confidence | NUMERIC nullable |
| quality_flags | JSONB |
| detector_version | VARCHAR |
| created_at | TIMESTAMPTZ |

The detector version is important for comparing results generated by different algorithms.

## 5.8 research_reports

Stores AI-generated research reports.

| Column | Type |
|---|---|
| id | UUID |
| symbol | VARCHAR |
| title | VARCHAR |
| analysis_window_start | TIMESTAMPTZ |
| analysis_window_end | TIMESTAMPTZ |
| market_snapshot | JSONB |
| findings | JSONB |
| scenarios | JSONB |
| risks | JSONB |
| missing_data | JSONB |
| model_provider | VARCHAR nullable |
| model_name | VARCHAR nullable |
| prompt_version | VARCHAR |
| created_at | TIMESTAMPTZ |

Store the structured report, not just a long text response.

## 5.9 research_jobs

Tracks asynchronous research tasks.

| Column | Type |
|---|---|
| id | UUID |
| job_type | VARCHAR |
| symbol | VARCHAR |
| status | VARCHAR |
| input_parameters | JSONB |
| result_report_id | UUID nullable |
| error_message | TEXT nullable |
| started_at | TIMESTAMPTZ nullable |
| completed_at | TIMESTAMPTZ nullable |
| created_at | TIMESTAMPTZ |

Possible states:

```text
PENDING
RUNNING
COMPLETED
FAILED
CANCELLED
```

---

# 6. Indexing and Time-Series Strategy

Create indexes based on actual query patterns.

Recommended logical indexes:

```text
market_trades:
    (symbol, exchange_timestamp)

market_candles:
    UNIQUE (symbol, interval, start_timestamp)

liquidity_metrics:
    (symbol, timestamp)
    (symbol, price_bin, timestamp)

heatmap_buckets:
    UNIQUE (symbol, bucket_start, price_bin)

market_events:
    (symbol, start_timestamp)
    (symbol, event_type, start_timestamp)

research_reports:
    (symbol, created_at)
```

Use TimescaleDB hypertables for suitable high-volume tables such as trades, candles and heatmap history.

Before enabling compression, retention or continuous aggregates, verify:

- Query requirements.
- Data correction requirements.
- Storage costs.
- Required historical depth.
- Whether the table needs updates after initial insertion.

Use database migrations to create and modify hypertables and indexes.

---

# 7. Redis Architecture

Redis provides fast access to live data and supports event distribution.

It is not the permanent source of truth for historical research.

## 7.1 Redis responsibilities

1. Latest market state.
2. Latest orderbook state.
3. Current liquidity snapshot.
4. Current volatility metrics.
5. Real-time event notifications.
6. Recoverable research jobs.
7. Short-lived caching.

## 7.2 Redis data layout

Suggested internal key names:

```text
market:BTCUSD:latest
orderbook:BTCUSD:latest
liquidity:BTCUSD:latest
volatility:BTCUSD:latest
heatmap:BTCUSD:active
health:BTCUSD

research:job:{job_id}
research:queue
```

Use Redis Streams for durable processing where message recovery and consumer acknowledgement are required.

Use Pub/Sub for transient notifications only.

## 7.3 Data consistency

Every published snapshot should include:

- Symbol.
- Timestamp.
- Version or sequence where applicable.
- Data status.
- Source information.
- Quality flags.

A frontend reconnecting after missed messages must be able to fetch a complete snapshot before applying subsequent incremental updates.

---

# 8. Research Data Preparation

The AI must not receive unfiltered raw WebSocket traffic.

Python should construct a structured research dataset.

## 8.1 Research context

A research request should contain:

```json
{
  "symbol": "BTCUSD",
  "analysis_window": {
    "start": "UTC timestamp",
    "end": "UTC timestamp"
  },
  "market_snapshot": {},
  "liquidity_metrics": {},
  "volatility_metrics": {},
  "volume_metrics": {},
  "market_events": [],
  "historical_comparison": {},
  "data_quality": {},
  "missing_data": []
}
```

All values shown here are schema placeholders.

## 8.2 Context validation

Before AI processing:

- Validate the requested time range.
- Confirm that the requested instrument exists.
- Check market-data freshness.
- Check orderbook synchronization history.
- Identify missing candles.
- Check heatmap coverage.
- Validate units.
- Remove duplicate events.
- Ensure that historical comparison uses equivalent intervals.

If required data is unavailable, return a partial analysis with explicit limitations or reject the request if the analysis cannot be performed safely.

---

# 9. Historical Research Engine

The research engine should compare current conditions with historical market behaviour.

Supported research dimensions:

1. Liquidity concentration.
2. Bid/ask imbalance.
3. Liquidity persistence.
4. Liquidity withdrawal.
5. Sweep patterns.
6. Absorption patterns.
7. Volatility expansion.
8. Volume expansion.
9. Spread expansion.
10. Price reaction around significant liquidity levels.

## 9.1 Historical comparison

Compare the current observation with historical windows using consistent definitions.

Example:

```text
Current:
BTCUSD liquidity imbalance over the last 15 minutes

Historical:
Comparable 15-minute windows from the selected historical period
```

Potential metrics:

- Historical mean.
- Median.
- Standard deviation.
- Percentile.
- Minimum.
- Maximum.
- Sample count.

Do not claim an event is statistically unusual without an adequate historical sample and a defined statistical method.

## 9.2 Percentile calculation

For observation \(x\) in historical sample \(X\):

\[
Percentile(x) =
100 \times
\frac{\#\{X_i \leq x\}}{n}
\]

The implementation must document the percentile convention and sample selection.

If the sample size is insufficient, mark the percentile unavailable.

---

# 10. AI Research Manager

The AI Manager converts validated research context into a structured report.

The AI must not directly query or modify the exchange orderbook.

Recommended workflow:

```text
Research Request
       |
       v
Request Validation
       |
       v
Historical Data Retrieval
       |
       v
Market Context Preparation
       |
       v
Data Quality Validation
       |
       v
Feature and Event Analysis
       |
       v
AI Research Generation
       |
       v
Structured Output Validation
       |
       v
Report Persistence
       |
       v
Frontend Response
```

The AI provider must be configurable.

Do not hardcode API credentials or model names.

## 10.1 AI responsibilities

The AI may:

- Explain liquidity concentration.
- Summarize bid/ask imbalance.
- Describe observed sweep patterns.
- Explain possible absorption.
- Compare current and historical volatility.
- Identify changes in visible liquidity.
- Summarize relevant market events.
- Present bullish, bearish and neutral scenarios.
- Explain risks and uncertainty.
- Identify missing data.

The AI must not:

- Invent orderbook levels.
- Invent trades or market events.
- Claim that a liquidation occurred without verified evidence.
- Claim that an exchange participant is an institution or market maker without evidence.
- Guarantee future price direction.
- Present a hypothesis as an observed fact.
- Generate unsupported numerical probabilities.
- Execute real-money trades.

---

# 11. Evidence-Based AI Output

Every research finding must distinguish between three categories.

### A. Observed facts

Directly calculated or received measurements.

Example:

```text
Visible bid liquidity increased in the selected price range.
```

### B. Analytical interpretation

A conclusion based on multiple observations.

Example:

```text
Bid liquidity persistence increased while aggressive selling activity remained elevated.
This may indicate a possible absorption pattern.
```

### C. Hypothesis

A possible explanation that cannot be confirmed from available data.

Example:

```text
The observed behaviour may indicate demand near this price region.
However, visible orderbook data cannot establish participant identity or intent.
```

These categories must be represented explicitly in the structured report.

---

# 12. Research Report Schema

Use a consistent output structure.

```json
{
  "report_id": "uuid",
  "symbol": "BTCUSD",
  "generated_at": "UTC timestamp",
  "analysis_window": {
    "start": "UTC timestamp",
    "end": "UTC timestamp"
  },
  "market_summary": {
    "current_price": null,
    "price_change_percent": null,
    "volatility_state": "UNKNOWN",
    "data_status": "UNKNOWN"
  },
  "observations": [],
  "interpretations": [],
  "hypotheses": [],
  "liquidity_analysis": {},
  "volatility_analysis": {},
  "volume_analysis": {},
  "market_events": [],
  "scenarios": [],
  "risk_factors": [],
  "missing_data": [],
  "limitations": []
}
```

Use null for unavailable values. Do not replace missing information with zero.

## 12.1 Finding structure

Each finding should follow:

```json
{
  "finding_id": "finding-id",
  "category": "LIQUIDITY",
  "classification": "OBSERVATION",
  "title": "Bid liquidity increased",
  "description": "Description based on measured data.",
  "metrics": {},
  "time_range": {
    "start": "UTC timestamp",
    "end": "UTC timestamp"
  },
  "evidence_ids": [],
  "quality_flags": [],
  "limitations": []
}
```

Every numerical claim must be traceable to source metrics or stored event IDs.

---

# 13. Market Scenarios

The research engine may present multiple scenarios.

Required scenario categories:

- Bullish scenario.
- Bearish scenario.
- Neutral scenario.

Each scenario should contain:

1. Supporting evidence.
2. Contradictory evidence.
3. Relevant price levels, if supported by data.
4. Conditions that would strengthen the scenario.
5. Conditions that would invalidate the scenario.
6. Risk factors.
7. Data-quality limitations.

Example:

```json
{
  "scenario": "BULLISH",
  "supporting_evidence": [],
  "contradictory_evidence": [],
  "conditions_to_watch": [],
  "invalidation_conditions": [],
  "risk_factors": []
}
```

Do not force the AI to select one winning direction.

A neutral or inconclusive result is valid.

Do not invent entry prices, stop losses or take-profit levels unless a separate, validated strategy module explicitly calculates them.

---

# 14. Liquidation Research

Liquidation analysis requires special care.

The system must distinguish:

- Exchange-reported liquidation events.
- User/account-specific liquidation notifications.
- Estimated liquidation zones.
- Price and leverage-based hypothetical liquidation calculations.

These are not interchangeable.

If exchange-wide liquidation data is unavailable:

1. Do not claim actual liquidation volume.
2. Do not fabricate liquidation events.
3. Label calculated zones as estimates.
4. Explain the assumptions used.
5. Identify missing position and leverage information.

A public orderbook or price movement alone cannot establish that a liquidation occurred.

---

# 15. AI Prompt Management

Maintain versioned prompts.

Suggested logical prompt files:

```text
research-python/
└── app/
    └── prompts/
        ├── market_research.md
        ├── liquidity_analysis.md
        ├── volatility_analysis.md
        └── historical_comparison.md
```

Prompt requirements:

- Define the AI's role.
- Define allowed input fields.
- Define observation versus interpretation versus hypothesis.
- Require evidence references.
- Require missing-data disclosure.
- Prohibit invented market facts.
- Require structured JSON output.
- Require explicit uncertainty.
- Prohibit guaranteed trading predictions.

Every report must record the prompt version and model provider/model name when available.

Do not include secrets, private credentials or unnecessary user account information in prompts.

---

# 16. AI Output Validation

The AI response must be validated before persistence or frontend delivery.

Validation should check:

- Required fields.
- Correct data types.
- Valid event references.
- Valid timestamps.
- Valid classifications.
- Numerical values are finite.
- Missing values use null.
- No unsupported source IDs.
- No contradictory data-quality claims.
- No unsupported liquidation claims.
- No guaranteed future market predictions.

Use Pydantic schemas for validation.

If validation fails:

1. Reject the invalid response.
2. Record a sanitized error.
3. Optionally retry using a bounded retry policy.
4. Do not display malformed output as a completed report.

A retry must not cause uncontrolled AI API spending.

---

# 17. Research Job Processing

Long-running research must not block HTTP request handling.

Use an asynchronous job workflow.

```text
Frontend
   |
   v
POST /api/v1/research
   |
   v
Validate Request
   |
   v
Create Research Job
   |
   v
Redis Stream / Worker Queue
   |
   v
Research Worker
   |
   v
Generate Report
   |
   v
Save Report
   |
   v
Update Job Status
   |
   v
Frontend Retrieves Result
```

The queue implementation must support retry limits, failure handling and idempotency.

Do not rely on Redis Pub/Sub as the only durable job queue.

## 17.1 Job status response

```json
{
  "job_id": "uuid",
  "status": "RUNNING",
  "created_at": "UTC timestamp",
  "completed_at": null,
  "report_id": null,
  "error": null
}
```

---

# 18. Python API Contracts

All endpoints must use versioned routes.

## 18.1 Create research report

```http
POST /api/v1/research
```

Request:

```json
{
  "symbol": "BTCUSD",
  "start_time": "UTC timestamp",
  "end_time": "UTC timestamp",
  "analysis_type": "FULL_RESEARCH"
}
```

Response:

```json
{
  "job_id": "uuid",
  "status": "PENDING"
}
```

## 18.2 Get research job

```http
GET /api/v1/research/jobs/{job_id}
```

Returns job status and the report identifier when completed.

## 18.3 Get report

```http
GET /api/v1/research/reports/{report_id}
```

Returns the validated structured research report.

## 18.4 Historical market data

```http
GET /api/v1/market/history
```

Suggested query parameters:

```text
symbol
start_time
end_time
interval
```

## 18.5 Market events

```http
GET /api/v1/market/events
```

Suggested query parameters:

```text
symbol
event_type
start_time
end_time
limit
cursor
```

## 18.6 API rules

- Validate all inputs.
- Enforce maximum time ranges.
- Use pagination for large historical queries.
- Return UTC timestamps.
- Use consistent error responses.
- Apply authentication and authorization.
- Do not expose database internals.
- Do not expose internal Redis keys.

---

# 19. Research Report Presentation

The frontend should present reports in readable sections.

Suggested report structure:

1. Market Overview.
2. Liquidity Analysis.
3. Orderbook Imbalance.
4. Liquidity Persistence.
5. Sweep and Absorption Observations.
6. Volatility Analysis.
7. Volume Analysis.
8. Historical Comparison.
9. Bullish Scenario.
10. Bearish Scenario.
11. Neutral Scenario.
12. Risk Factors.
13. Missing Data and Limitations.

Each report must show:

- Symbol.
- Analysis period.
- Generation timestamp.
- Data freshness.
- Data-quality status.
- AI model information where available.
- Prompt version.
- Historical data coverage.

The UI must visually distinguish observed facts from interpretations and hypotheses.

---

# 20. Security and Cost Controls

AI research endpoints must have:

- Authentication.
- Authorization.
- Request validation.
- Rate limiting.
- Maximum analysis window.
- Maximum output size.
- Provider timeout.
- Retry limit.
- Usage logging.
- Cost tracking where provider usage data is available.

Secrets must be stored in environment variables or a dedicated secret-management system.

Never expose LLM API keys to the browser.

Never send private exchange API credentials to the AI provider.

The initial platform must remain read-only with respect to real-money exchange execution.

---

# 21. Testing Requirements

## 21.1 Database tests

- Instrument metadata versioning.
- Trade deduplication.
- Candle uniqueness.
- Heatmap bucket uniqueness.
- Event persistence.
- Research report persistence.
- Timezone correctness.
- Historical query boundaries.
- Database migration tests.

## 21.2 Research tests

- Missing market data.
- Stale market data.
- Incomplete orderbook history.
- Insufficient historical samples.
- Invalid event references.
- Historical comparison.
- Partial research results.
- Null and unavailable values.
- Contradictory evidence.
- Report generation failure.

## 21.3 AI tests

- Valid structured JSON.
- Invalid JSON.
- Missing required fields.
- Unsupported numerical claims.
- Fabricated event IDs.
- Unsupported liquidation claims.
- Unsupported confidence values.
- Conflicting observations.
- Prompt version tracking.
- Provider timeout.
- Retry limit enforcement.

Use fixed test datasets and mock AI responses for deterministic tests.

Do not depend on live AI output for core unit tests.

---

# 22. Observability

Track the following:

### Database

- Query latency.
- Connection pool usage.
- Storage growth.
- Failed transactions.
- Migration failures.

### Redis

- Memory usage.
- Stream lag.
- Consumer pending entries.
- Queue depth.
- Failed job count.
- Reconnection count.

### Research API

- Request latency.
- Research job duration.
- Failed reports.
- AI provider latency.
- Token usage where available.
- Estimated provider cost where available.

### Data quality

- Historical coverage.
- Missing candles.
- Incomplete heatmap buckets.
- Invalid orderbook intervals.
- Stale data duration.
- Event quality flags.

Logs must be structured and must not expose secrets or private account data.

---

# 23. Production Acceptance Criteria

The Research and Database layer is ready when:

### Database

- [ ] Required SQLAlchemy models are implemented.
- [ ] Database migrations are version-controlled.
- [ ] Time-series tables are designed for expected query volume.
- [ ] Historical instrument metadata is preserved.
- [ ] UTC timestamp handling is consistent.
- [ ] Duplicate market records are handled safely.

### Redis

- [ ] Latest-state keys work.
- [ ] Durable jobs use recoverable processing.
- [ ] Transient notifications use appropriate delivery semantics.
- [ ] Frontend can recover using complete snapshots.

### Research

- [ ] Research context is built from validated market data.
- [ ] Historical comparisons use consistent intervals.
- [ ] Missing data is explicitly reported.
- [ ] AI receives structured context rather than raw WebSocket traffic.
- [ ] Every finding has evidence references.
- [ ] Facts, interpretations and hypotheses are separated.
- [ ] AI output passes schema validation.
- [ ] Reports are persisted with model and prompt versions.

### Reliability and security

- [ ] Long-running jobs do not block HTTP requests.
- [ ] Job retries are bounded.
- [ ] AI provider failures are handled.
- [ ] API authentication and rate limiting are implemented.
- [ ] Secrets are not exposed to the frontend.
- [ ] Real-money exchange execution is not enabled.

---

# 24. Final Engineering Rules

1. PostgreSQL is the persistent source for historical research records.
2. Redis is not the permanent historical database.
3. Go remains the owner of real-time market calculations.
4. Python consumes validated market data.
5. AI never invents missing market measurements.
6. Every numerical research claim must be traceable.
7. Observations, interpretations and hypotheses must remain separate.
8. Estimated liquidation zones must never be represented as actual liquidations.
9. Research jobs must be recoverable and idempotent.
10. Every report must disclose data-quality limitations.
11. All AI output must pass schema validation.
12. Research generation must never block market-data ingestion.

**The objective is not to make AI predict the market. The objective is to give AI accurate, structured market evidence so it can explain what is happening, what may be happening and what remains unknown.**