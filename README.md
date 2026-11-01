# TASK: CREATE COMPLETE PROJECT ENGINEERING DOCUMENTATION

You are the Principal Software Architect responsible for designing a production-grade BTCUSD Liquidity Intelligence and AI Market Research Platform.

## Project Objective

Build a personal trading intelligence platform using Delta Exchange market data.

The platform must provide:

1. Real-time BTCUSD market data ingestion.
2. A Go-based orderbook processing engine.
3. A one-minute live liquidity heatmap.
4. Bid and ask liquidity analysis.
5. Liquidity concentration and persistence detection.
6. Liquidity sweep, absorption and withdrawal event detection.
7. One-minute, five-minute and fifteen-minute market analysis.
8. Historical volatility analysis.
9. AI-generated evidence-backed research blogs.
10. React-based trading terminal.
11. Risk-management calculations.
12. Northflank deployment.

## Technology Stack

- Go for market data ingestion and analytics.
- Gin for HTTP APIs where needed.
- Gorilla WebSocket for exchange connectivity.
- React + Vite for frontend.
- HTML Canvas for heatmap rendering.
- TradingView Lightweight Charts for candlestick visualization.
- Python + FastAPI for AI research.
- NumPy and Pandas for historical analysis.
- Redis for event streaming and caching.
- PostgreSQL + TimescaleDB for persistent storage.
- Docker for containerization.
- Northflank for deployment.

## Documentation-First Requirement

DO NOT start implementing application code.

First, inspect the complete project requirements and create all required Markdown documentation.

Create:

1. Project vision.
2. Product requirements.
3. System architecture.
4. Technology decisions.
5. Data flow.
6. Delta Exchange API specification.
7. Orderbook synchronization specification.
8. Liquidity mathematical specification.
9. Heatmap rendering specification.
10. Volatility calculations.
11. Market event detection.
12. Multi-timeframe analysis.
13. AI research architecture.
14. Research content rules.
15. Database schema.
16. Redis architecture.
17. API contracts.
18. Frontend specification.
19. Security and threat model.
20. Risk management.
21. Testing strategy.
22. Observability.
23. Northflank deployment.
24. Failure recovery.
25. Development roadmap.
26. Definition of Done.
27. Data dictionary.
28. Architecture decision records.
29. Historical replay and backtesting.
30. Production runbook.

Also create:

- AGENTS.md
- .agents/rules/
- .agents/skills/

## Technical Accuracy Requirements

1. Verify all Delta Exchange API details using official documentation.
2. Never invent WebSocket channels, payload fields or API endpoints.
3. Distinguish actual market data from calculated estimates.
4. Document every mathematical formula with variable definitions and units.
5. Document orderbook snapshot and incremental update synchronization.
6. Document sequence-gap detection and recovery.
7. Document timestamp handling and data freshness.
8. Define bounded queues and backpressure.
9. Define database persistence and historical replay.
10. Define API contracts before implementing communication between services.
11. Define security and risk controls before enabling live trading.
12. Include testing and acceptance criteria for every module.

## Agent Development Rules

- Follow layered architecture.
- Keep business logic outside HTTP handlers.
- Keep Go packages focused on single responsibilities.
- Do not mix exchange connectivity with analytics calculations.
- Do not expose API credentials to frontend.
- Do not introduce unnecessary microservices.
- Do not add unnecessary dependencies.
- Do not modify approved architecture without documenting the reason.
- Never use fabricated market data in production calculations.
- Never automatically place real orders.
- Never claim that a system is profitable without verified testing.

## Final Deliverables

Create the complete documentation directory and all Markdown files.

Cross-reference related documentation.

Identify contradictions, missing requirements and unresolved technical decisions.

Create a documentation completeness checklist.

Do not start application implementation until documentation is reviewed and approved by the project owner.

At the end, provide:
1. List of created files.
2. Architecture summary.
3. Unresolved technical decisions.
4. Potential failure points.
5. Recommended implementation sequence.