# 05 — Testing and Production Rules

**Project:** BTCUSD Liquidity Intelligence & AI Research Platform  
**Primary Scope:** Quality Assurance, Reliability, Data Integrity and Production Readiness  
**Status:** Technical Implementation Specification  
**Document Priority:** Critical

---

# 1. Purpose

This document defines the testing strategy and production-readiness requirements for the entire platform.

The platform processes financial market data that may influence real-money trading decisions.

Therefore, correctness, reliability, data integrity and risk visibility are more important than visual appearance or feature count.

The system must be tested across:

1. Exchange connectivity.
2. Market data normalization.
3. Orderbook synchronization.
4. Liquidity calculations.
5. Heatmap aggregation.
6. Volatility calculations.
7. Market event detection.
8. Database persistence.
9. Redis messaging.
10. AI research generation.
11. Frontend real-time updates.
12. Deployment and recovery.
13. Security and access control.

No component should be considered production-ready merely because it works with a few live market messages.

---

# 2. Testing Philosophy

Follow a layered testing strategy.

```text
              Testing Strategy
                    |
          +---------+----------+
          |         |          |
          v         v          v
         Unit   Integration   System
          |         |          |
          +---------+----------+
                    |
                    v
              Historical Replay
                    |
                    v
                Load Testing
                    |
                    v
             Failure Simulation
                    |
                    v
              Production Gates
```

Testing priorities:

1. Financial calculation correctness.
2. Orderbook synchronization.
3. Data-quality handling.
4. Recovery after failures.
5. Historical reproducibility.
6. Performance under realistic load.
7. Security.
8. User-interface correctness.

Never sacrifice data correctness to improve a benchmark result.

---

# 3. Testing Environment

Maintain separate environments.

| Environment | Purpose |
|---|---|
| Local | Development and unit testing |
| Test | Integration and automated testing |
| Staging | Production-like validation |
| Production | Live market data and research |

Production credentials must never be used in local or automated test environments.

Use mock exchange messages and recorded datasets for deterministic testing.

Where Delta provides an appropriate test environment, verify its capabilities before using it.

Do not assume a demo environment has identical market-data behaviour to production.

---

# 4. Unit Testing

Each calculation and business rule must have independent unit tests.

## 4.1 Go Market Engine

Test:

### Exchange and normalization

- Valid message decoding.
- Invalid JSON.
- Unknown message types.
- Missing required fields.
- Invalid timestamps.
- Duplicate trade IDs.
- Invalid prices.
- Invalid quantities.
- Instrument metadata validation.

### Orderbook

- Initial snapshot.
- Bid sorting.
- Ask sorting.
- Quantity updates.
- Price-level deletion.
- Duplicate updates.
- Sequence gaps.
- Out-of-order messages.
- Invalid update handling.
- Snapshot resynchronization.
- Disconnect and reconnect.

### Liquidity

- Bid notional.
- Ask notional.
- Contract multiplier.
- Zero quantity.
- Invalid contract metadata.
- Bid/ask aggregation.
- Imbalance.
- Zero-denominator handling.
- Price-bin calculation.

### Heatmap

- Minute boundary.
- Bucket aggregation.
- OHLC values.
- Time-weighted average.
- Partial coverage.
- Missing observations.
- Late events.
- Historical corrections.
- Incomplete bucket handling.

### Event detection

- Liquidity addition.
- Liquidity reduction.
- Large withdrawal.
- Sweep candidate.
- Absorption candidate.
- Insufficient evidence.
- Duplicate event suppression.

### Volatility

- Simple return.
- Log return.
- Rolling volatility.
- Realized volatility.
- ATR initialization.
- Wilder smoothing.
- Candle boundary.
- Missing candle handling.

## 4.2 Python Research API

Test:

- Request validation.
- Service orchestration.
- Repository operations.
- Historical queries.
- Research dataset construction.
- Historical comparisons.
- Event retrieval.
- AI response validation.
- Job status transitions.
- Retry limits.
- Report persistence.

## 4.3 Frontend

Test:

- Component rendering.
- Loading states.
- Empty states.
- Error states.
- WebSocket connection lifecycle.
- Reconnection.
- Snapshot initialization.
- Sequence gap recovery.
- Heatmap rendering.
- Chart updates.
- Research report rendering.
- Data-quality indicators.

---

# 5. Mathematical Reference Tests

Financial calculations must be tested against independently calculated reference values.

Do not test a calculation only by comparing two implementations that share the same underlying logic.

## 5.1 Notional calculation

Create reference cases using verified Delta BTCUSD contract specifications.

Test:

- Different prices.
- Different quantities.
- Contract multipliers.
- Settlement conventions.
- Precision and rounding.
- Invalid metadata.

Expected values must be calculated independently and reviewed.

## 5.2 Liquidity imbalance

For:

\[
BidLiquidity = 6000
\]

\[
AskLiquidity = 4000
\]

Expected:

\[
I =
\frac{6000-4000}{6000+4000}
=0.20
\]

The result should be `0.20`.

These are synthetic test values, not live BTCUSD market data.

## 5.3 Price binning

Test:

- Exact bin boundary.
- Price immediately below a boundary.
- Price immediately above a boundary.
- Negative relative offset from the bin origin.
- Tick-size alignment.
- Decimal precision.

## 5.4 Time-weighted liquidity

Example observations:

| Liquidity | Duration |
|---:|---:|
| 100 | 10 seconds |
| 200 | 20 seconds |
| 300 | 30 seconds |

Expected:

\[
TWAP =
\frac{100(10)+200(20)+300(30)}
{10+20+30}
\]

\[
TWAP = 216.67
\]

The engine must not treat these observations as equally weighted.

## 5.5 ATR

Use a fixed synthetic candle dataset.

Validate:

1. True range for every candle.
2. Initial ATR.
3. Wilder-smoothed subsequent ATR.
4. Missing candle handling.
5. Candle interval correctness.

## 5.6 Test precision

Use integer tick units or decimal-safe arithmetic where appropriate.

Floating-point calculations may be used for statistical operations, but financial values must not silently lose exchange precision.

---

# 6. Integration Testing

Integration tests verify communication between services.

## 6.1 Go and Delta Exchange

Test:

- WebSocket connection.
- Subscription.
- Message decoding.
- Snapshot processing.
- Incremental updates.
- Heartbeats.
- Reconnection.
- Resynchronization.
- Instrument metadata loading.

Use recorded messages and controlled mocks for deterministic tests.

Verify the current official Delta protocol before implementing live integration tests.

## 6.2 Go and Redis

Test:

- Connection.
- Snapshot publication.
- Incremental updates.
- Event publication.
- Redis disconnection.
- Redis recovery.
- Stream consumer recovery.
- Duplicate message handling.
- Serialization compatibility.

## 6.3 Go and PostgreSQL

Test:

- Batched writes.
- Transaction rollback.
- Duplicate records.
- Connection loss.
- Database recovery.
- Historical timestamp handling.
- Metadata version references.

Database writes must not block critical exchange ingestion.

## 6.4 Python and PostgreSQL

Test:

- Historical data retrieval.
- Time-range filtering.
- Pagination.
- Research report creation.
- Research report retrieval.
- Job persistence.
- Transaction handling.
- Migration compatibility.

## 6.5 Python and AI provider

Test:

- Valid response.
- Invalid JSON.
- Timeout.
- Rate limit.
- Provider unavailable.
- Token limit.
- Malformed structured output.
- Unsupported findings.
- Retry exhaustion.

Use mocked responses for deterministic automated tests.

---

# 7. Historical Replay Testing

Historical replay is mandatory before trusting the event-detection algorithms.

The platform must be able to process recorded market data without depending on a live exchange connection.

## 7.1 Replay requirements

- Replay trades.
- Replay orderbook snapshots.
- Replay incremental updates.
- Preserve timestamps.
- Preserve ordering.
- Reconstruct local orderbook.
- Recalculate liquidity.
- Recalculate heatmap.
- Recalculate volatility.
- Re-run event detection.
- Compare output with stored reference results.

## 7.2 Replay modes

Support:

- Normal-speed replay.
- Accelerated replay.
- Step-by-step replay.
- Selected time-window replay.

## 7.3 Deterministic results

The same:

- Input dataset.
- Instrument metadata.
- Algorithm version.
- Configuration.
- Replay ordering.

Should produce equivalent analytical results.

Any intentional algorithm change must have a new detector or calculation version.

---

# 8. Data Integrity Testing

Data integrity is more important than merely keeping a WebSocket connected.

Test the following scenarios.

## 8.1 Missing messages

Simulate missing orderbook updates.

Expected:

- Detect integrity failure where protocol metadata permits.
- Mark local book invalid.
- Stop trusted liquidity calculations.
- Trigger recovery.
- Resume only after valid synchronization.

## 8.2 Duplicate messages

Send the same trade or update multiple times.

Expected:

- Deduplicate using reliable identifiers or protocol rules.
- Avoid double-counting volume.
- Avoid generating duplicate events.

## 8.3 Out-of-order messages

Deliver updates in a different order.

Expected:

- Apply only when the exchange protocol allows safe ordering.
- Otherwise detect inconsistency.
- Recover through the documented synchronization procedure.

## 8.4 Stale feed

Stop market-data delivery while keeping the application process alive.

Expected:

- Feed health becomes STALE or DISCONNECTED as appropriate.
- Latest price is marked outdated.
- Derived metrics are not represented as current.
- Frontend displays the last update timestamp.
- Trusted event generation is suspended.

## 8.5 Clock problems

Simulate:

- Incorrect system clock.
- Large timestamp difference.
- Negative calculated latency.
- Exchange timestamp irregularity.

Expected:

- Flag clock-quality problems.
- Preserve original timestamps.
- Avoid presenting invalid latency as a reliable measurement.

---

# 9. Event Detection Validation

Event detection must be evaluated against recorded data and manually reviewed examples.

## 9.1 Sweep detection

Measure:

- True positives.
- False positives.
- False negatives.
- Detection delay.
- Event duration.
- Executed notional accuracy.

Do not evaluate only the number of detected sweeps.

## 9.2 Absorption detection

Review cases with:

- Elevated aggressive volume.
- Persistent visible liquidity.
- Liquidity replenishment.
- Limited price movement.

Also review false positives caused by:

- Low activity.
- Missing trades.
- Orderbook gaps.
- Large spread.
- Incomplete data.

Absorption remains a hypothesis based on observable evidence.

## 9.3 Withdrawal detection

Validate reductions against trade activity where available.

Measure how often the detector incorrectly labels executed liquidity as cancellation.

If the exact cause cannot be determined, retain the classification `UNCLASSIFIED_REDUCTION`.

## 9.4 Threshold calibration

Use historical replay to tune:

- Minimum notional.
- Minimum quantity.
- Observation duration.
- Price levels crossed.
- Persistence threshold.
- Reduction ratio.
- Event cooldown.

Thresholds must not be selected only because they make the dashboard look active.

Store detector configuration versions so historical comparisons remain reproducible.

---

# 10. AI Research Validation

AI-generated reports require a separate validation process.

## 10.1 Factual consistency

For every numerical claim, verify:

- Source metric exists.
- Source time range matches.
- Unit is correct.
- Symbol is correct.
- Calculation is traceable.
- Data quality supports the claim.

## 10.2 Hallucination tests

Provide test contexts where:

- Liquidity data is missing.
- Orderbook is stale.
- No sweep event exists.
- No liquidation data exists.
- Historical sample size is insufficient.
- Bullish and bearish evidence conflict.

Expected AI behaviour:

- Disclose missing information.
- Avoid invented measurements.
- Avoid unsupported event claims.
- Present uncertainty.
- Return neutral or inconclusive analysis when appropriate.

## 10.3 AI output rules

Reject output that:

- Invents price levels.
- Invents volume.
- Invents event identifiers.
- Claims actual liquidation without verified data.
- Presents estimates as observed facts.
- Guarantees price movement.
- Claims institutional activity without evidence.

## 10.4 Report reproducibility

Store:

- Input dataset reference.
- Analysis window.
- Calculation version.
- Detector version.
- Prompt version.
- AI provider.
- Model identifier.
- Report generation timestamp.

Where practical, retain a reproducible input snapshot or immutable dataset reference.

Do not assume that rerunning an LLM will produce identical prose.

---

# 11. Frontend Testing

## 11.1 Dashboard

Verify:

- Market price updates.
- Candle updates.
- Orderbook updates.
- Liquidity metrics.
- Heatmap updates.
- Volatility metrics.
- Market events.
- Connection status.

## 11.2 Heatmap

Test:

- Empty data.
- Large historical window.
- Missing buckets.
- Partial coverage.
- Zoom.
- Pan.
- Browser resizing.
- High-DPI rendering.
- Tooltip accuracy.
- Reconnection.
- Snapshot replacement.

## 11.3 WebSocket recovery

Simulate:

1. Browser connects.
2. Snapshot arrives.
3. Incremental updates arrive.
4. Network disconnects.
5. Updates are missed.
6. Browser reconnects.
7. New snapshot arrives.
8. Incremental updates resume.

Expected: the frontend must not combine an old snapshot with incompatible incremental updates.

## 11.4 Browser performance

Monitor:

- Main-thread blocking.
- Memory usage.
- Canvas draw duration.
- WebSocket message backlog.
- React rerenders.
- Browser console errors.

The frontend must remain responsive during periods of high market activity.

---

# 12. Load and Performance Testing

Performance testing must use realistic recorded market traffic.

Do not benchmark only with a small number of synthetic updates.

## 12.1 Market Engine

Measure:

- Messages received per second.
- Messages processed per second.
- Queue depth.
- Dropped messages.
- Orderbook processing latency.
- Liquidity calculation latency.
- Event detection latency.
- Redis publication latency.
- Memory usage.
- CPU usage.

## 12.2 Python Research API

Measure:

- Request throughput.
- API response latency.
- Historical query latency.
- Job queue depth.
- Research job duration.
- Database connection usage.
- AI provider latency.
- Failed job rate.

## 12.3 Frontend

Measure:

- Initial load time.
- WebSocket connection time.
- Snapshot processing time.
- Heatmap rendering duration.
- Browser memory.
- UI responsiveness.

## 12.4 Latency reporting

Report:

- p50.
- p95.
- p99.
- Maximum observed latency.

Measure latency at separate pipeline stages.

Do not claim an end-to-end latency based only on WebSocket receive time.

## 12.5 Capacity limits

Define explicit limits for:

- WebSocket message queues.
- Redis Streams backlog.
- Database connection pools.
- Historical query range.
- Browser historical data window.
- Research job concurrency.
- AI request rate.

When limits are reached, the application must degrade safely rather than consume unbounded memory.

---

# 13. Failure Simulation

The system must be tested under failure conditions.

| Failure | Expected behaviour |
|---|---|
| Delta WebSocket disconnect | Reconnect and resynchronize |
| Orderbook sequence gap | Invalidate and rebuild book |
| Redis unavailable | Mark publishing failure and recover safely |
| PostgreSQL unavailable | Isolate persistence failure from ingestion |
| Python API unavailable | Keep market engine operating |
| AI provider unavailable | Mark research job failed or retry within limits |
| Frontend disconnect | Reconnect and request snapshot |
| Container restart | Recover service state safely |
| Invalid configuration | Fail startup with clear error |
| High queue depth | Apply backpressure and alert |
| Stale market feed | Stop trusted analytics |

## 13.1 Chaos testing

Where practical, introduce controlled failures:

- Kill a service.
- Drop network packets.
- Delay WebSocket messages.
- Restart Redis.
- Restart PostgreSQL.
- Simulate slow database writes.
- Simulate AI provider timeout.
- Fill processing queues.

Record recovery time and any data loss.

---

# 14. Security Testing

Test:

- Unauthorized API access.
- Invalid authentication.
- Expired tokens.
- Unauthorized WebSocket subscription.
- Excessive WebSocket connections.
- Rate-limit enforcement.
- Invalid request payloads.
- Oversized messages.
- CORS restrictions.
- Secret leakage.
- SQL injection resistance.
- Unsafe frontend rendering.
- Dependency vulnerabilities.

Do not log:

- Exchange API secrets.
- JWT secrets.
- Database passwords.
- AI provider API keys.
- Private account credentials.

Security checks must run before production release and after significant authentication or API changes.

---

# 15. Risk Management Validation

The platform is initially a research and manual-trading terminal.

It must not automatically place real-money orders.

However, it should validate risk calculations and display relevant risk information.

## 15.1 Position size calculation

For a generic linear instrument:

\[
RiskAmount =
AccountEquity \times RiskPercentage
\]

\[
PositionSize =
\frac{RiskAmount}
{|EntryPrice-StopPrice|}
\]

This formula is valid only for the appropriate linear payoff and quantity units.

For Delta BTCUSD, the implementation must use the verified contract specification and settlement rules.

Do not use the generic formula without adapting it to the actual contract.

## 15.2 Trading cost

Estimate:

- Trading fees.
- Expected slippage.
- Spread cost.
- Funding cost where applicable.
- Contract-specific costs.

Display estimated and actual costs separately.

## 15.3 Risk controls

Display:

- Planned risk.
- Position size.
- Stop-loss distance.
- Estimated fees.
- Estimated slippage.
- Daily loss usage.
- Maximum permitted exposure.

Do not represent an estimated liquidation price or risk calculation as guaranteed.

---

# 16. Paper Trading and Manual Validation

Before relying on the platform for real-money decisions, use historical replay and paper trading.

## 16.1 Paper trading requirements

- No real exchange orders.
- Record hypothetical entry and exit.
- Record decision timestamp.
- Record the market snapshot used.
- Record the research report used.
- Include fees and slippage assumptions.
- Track maximum adverse excursion.
- Track maximum favourable excursion.
- Record the reason for the decision.
- Compare expected and observed behaviour.

## 16.2 Performance evaluation

Track:

- Number of trades.
- Win rate.
- Average win.
- Average loss.
- Profit factor.
- Maximum drawdown.
- Average holding period.
- Fees.
- Slippage.
- Net performance.

Do not judge an analytical feature solely by whether it predicts the next price movement.

Evaluate whether the underlying observation is accurate and whether the research provides useful, reproducible context.

Paper-trading results do not guarantee future profitability.

---

# 17. Production Readiness Gates

Production readiness must be approved in stages.

## Gate 1 — Data Integrity

- [ ] Delta's official data protocol verified.
- [ ] Instrument metadata validated.
- [ ] Snapshot and incremental update handling tested.
- [ ] Sequence gaps detected where applicable.
- [ ] Resynchronization tested.
- [ ] Stale data detection working.
- [ ] No trusted analytics from invalid orderbooks.

## Gate 2 — Mathematical Correctness

- [ ] Contract notional formula independently verified.
- [ ] Liquidity aggregation tested.
- [ ] Price binning tested.
- [ ] Time-weighted heatmap tested.
- [ ] ATR tested.
- [ ] Realized volatility tested.
- [ ] Spread calculations tested.
- [ ] Imbalance calculations tested.

## Gate 3 — Analytics Reliability

- [ ] Sweep detection evaluated.
- [ ] Absorption detection evaluated.
- [ ] Withdrawal classification reviewed.
- [ ] Duplicate events prevented.
- [ ] Event evidence traceable.
- [ ] Detector versions recorded.

## Gate 4 — Research Reliability

- [ ] Historical data retrieval tested.
- [ ] AI output validated.
- [ ] Missing data disclosed.
- [ ] Numerical claims traceable.
- [ ] Unsupported liquidation claims rejected.
- [ ] Research reports reproducible at the data and configuration level.

## Gate 5 — Operational Reliability

- [ ] Redis recovery tested.
- [ ] PostgreSQL recovery tested.
- [ ] Service restarts tested.
- [ ] Graceful shutdown tested.
- [ ] Queue limits configured.
- [ ] Monitoring configured.
- [ ] Backups configured.
- [ ] Restore procedure tested.

## Gate 6 — Manual Trading Readiness

- [ ] Historical replay completed.
- [ ] Paper trading completed.
- [ ] Fees and slippage included in evaluation.
- [ ] Data-quality warnings visible.
- [ ] Risk calculations independently validated.
- [ ] No automatic real-money execution enabled.
- [ ] User understands the limitations of market-data-derived signals.

Passing these gates does not establish that a trading strategy is profitable or that future losses can be avoided.

---

# 18. Release Management

Use controlled releases.

Every release should include:

- Version number.
- Change summary.
- Database migration details.
- Configuration changes.
- Test results.
- Known limitations.
- Rollback instructions.

For market calculations and event detection, record algorithm versions.

Do not silently change historical calculation semantics.

When a calculation changes, determine whether historical data needs recalculation or whether the new version should apply only to future observations.

---

# 19. Incident Management

Create an incident record for:

- Exchange disconnection.
- Persistent orderbook desynchronization.
- Market data loss.
- Incorrect notional calculation.
- Incorrect heatmap aggregation.
- Redis data loss.
- Database failure.
- AI report fabrication.
- Security incident.
- Unexpected service restart.

Each incident should contain:

1. Incident identifier.
2. Start and end time.
3. Affected service.
4. Affected market-data interval.
5. User-visible impact.
6. Root cause.
7. Recovery action.
8. Data affected.
9. Corrective action.
10. Prevention plan.

Do not silently repair historical analytical records without recording the correction.

---

# 20. Production Monitoring Dashboard

The operational dashboard should display:

### Market data

- Exchange connection status.
- Orderbook synchronization.
- Latest exchange timestamp.
- Latest receive timestamp.
- Data latency.
- Stale duration.
- Sequence-gap count.

### Processing

- Messages received.
- Messages processed.
- Queue depth.
- Dropped messages.
- Processing latency.
- Event detection latency.

### Infrastructure

- CPU.
- Memory.
- Redis health.
- PostgreSQL health.
- Storage usage.
- Service restart count.

### Research

- Pending research jobs.
- Failed research jobs.
- Average report generation time.
- AI provider errors.
- Token usage where available.

---

# 21. Definition of Done

A feature is not complete merely because its UI is visible.

A feature is complete only when:

1. Requirements are documented.
2. Data source is verified.
3. Units and calculations are defined.
4. Implementation is complete.
5. Unit tests pass.
6. Integration tests pass.
7. Error conditions are handled.
8. Data-quality states are exposed.
9. Logs and metrics are available.
10. Historical replay is validated where relevant.
11. Documentation is updated.
12. Acceptance criteria are satisfied.

---

# 22. Final Production Rules

1. Never trust an unsynchronized orderbook.
2. Never publish stale data as live.
3. Never silently drop critical market events.
4. Never use unverified contract specifications.
5. Never treat orderbook reductions as confirmed cancellations.
6. Never present estimated liquidation activity as actual exchange data.
7. Never let AI invent missing measurements.
8. Never let research generation block market-data ingestion.
9. Never deploy untested mathematical changes.
10. Never enable automatic real-money trading in the initial release.
11. Always preserve data-quality and algorithm-version information.
12. Always test failure recovery before production deployment.
13. Always validate financial calculations independently.
14. Always include realistic fees and slippage in paper-trading evaluation.

**The platform is production-ready only when its market data, calculations, recovery mechanisms and analytical outputs are demonstrably reliable—not simply when the dashboard looks complete.**