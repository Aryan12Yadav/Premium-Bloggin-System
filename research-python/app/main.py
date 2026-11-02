import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.models.research import ResearchReport
from app.api.routes.research_routes import router as research_router
from app.services.research_service import ResearchService

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI Market Research Engine for BTCUSD Liquidity & Volatility Intelligence",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(research_router)

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "research-python",
        "symbol": settings.SYMBOL
    }

@app.on_event("startup")
async def seed_initial_reports():
    """Seed initial research reports on startup if database is empty."""
    db = SessionLocal()
    try:
        count = db.query(ResearchReport).count()
        if count == 0:
            service = ResearchService(db)
            # Generate two initial articles across categories
            await service.generate_and_save_report(category="Liquidity Analysis")
            await service.generate_and_save_report(category="Orderbook Imbalance")
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
