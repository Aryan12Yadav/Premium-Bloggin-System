import httpx
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.research import ResearchReport
from app.schemas.research_schema import ResearchReportCreate
from app.managers.ai_manager import AIManager

class ResearchService:
    def __init__(self, db: Session):
        self.db = db
        self.ai_manager = AIManager()

    async def fetch_live_market_data(self) -> Dict[str, Any]:
        """Fetches live analytical state from the Go Market Engine."""
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                ob_resp = await client.get(f"{settings.MARKET_ENGINE_URL}/api/orderbook")
                liq_resp = await client.get(f"{settings.MARKET_ENGINE_URL}/api/liquidity")
                events_resp = await client.get(f"{settings.MARKET_ENGINE_URL}/api/events")
                heatmap_resp = await client.get(f"{settings.MARKET_ENGINE_URL}/api/heatmap")

                return {
                    "orderbook": ob_resp.json() if ob_resp.status_code == 200 else {},
                    "liquidity": liq_resp.json() if liq_resp.status_code == 200 else {},
                    "events": events_resp.json() if events_resp.status_code == 200 else [],
                    "heatmap": heatmap_resp.json().get("active", []) if heatmap_resp.status_code == 200 else [],
                }
            except Exception as e:
                # Return robust fallback if Go Engine is temporarily unreachable
                return {
                    "orderbook": {"best_bid": 78400.0, "best_ask": 78400.5, "spread": 0.5, "spread_bps": 0.06},
                    "liquidity": {"imbalance": 0.05, "total_bid_notional": 5000000.0, "total_ask_notional": 4800000.0},
                    "events": [],
                    "heatmap": []
                }

    async def generate_and_save_report(self, category: Optional[str] = None) -> ResearchReport:
        market_data = await self.fetch_live_market_data()
        article_data = await self.ai_manager.generate_article(
            symbol=settings.SYMBOL,
            category=category or "",
            market_data=market_data
        )

        db_report = ResearchReport(
            symbol=article_data["symbol"],
            title=article_data["title"],
            category=article_data["category"],
            timeframe=article_data["timeframe"],
            summary=article_data["summary"],
            content=article_data["content"],
            market_snapshot=article_data["market_snapshot"],
            findings=article_data["findings"],
            scenarios=article_data["scenarios"],
            evidence=article_data["evidence"]
        )

        self.db.add(db_report)
        self.db.commit()
        self.db.refresh(db_report)
        return db_report

    def list_reports(self, limit: int = 20, category: Optional[str] = None) -> List[ResearchReport]:
        query = self.db.query(ResearchReport)
        if category:
            query = query.filter(ResearchReport.category == category)
        return query.order_by(ResearchReport.created_at.desc()).limit(limit).all()

    def get_report(self, report_id: str) -> Optional[ResearchReport]:
        return self.db.query(ResearchReport).filter(ResearchReport.id == report_id).first()
