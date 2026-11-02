import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, JSON
from app.core.database import Base

class ResearchReport(Base):
    __tablename__ = "research_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    symbol = Column(String(20), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False, index=True)
    timeframe = Column(String(20), default="1m")
    summary = Column(Text, nullable=False)
    content = Column(Text, nullable=False) # Full structured 15-section markdown
    market_snapshot = Column(JSON, nullable=True)
    findings = Column(JSON, nullable=True)
    scenarios = Column(JSON, nullable=True)
    evidence = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
