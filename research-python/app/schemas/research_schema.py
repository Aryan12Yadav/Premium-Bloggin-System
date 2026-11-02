from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ResearchReportBase(BaseModel):
    symbol: str
    title: str
    category: str
    timeframe: str = "1m"
    summary: str
    content: str
    market_snapshot: Optional[Dict[str, Any]] = None
    findings: Optional[List[str]] = None
    scenarios: Optional[Dict[str, Any]] = None
    evidence: Optional[List[str]] = None

class ResearchReportCreate(ResearchReportBase):
    pass

class ResearchReportResponse(ResearchReportBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

class GenerateReportRequest(BaseModel):
    category: Optional[str] = Field(None, description="One of the 8 research categories, or auto-selected based on events")
    timeframe: Optional[str] = "1m"
