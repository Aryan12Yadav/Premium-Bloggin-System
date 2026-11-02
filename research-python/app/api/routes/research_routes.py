from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.research_schema import ResearchReportResponse, GenerateReportRequest
from app.services.research_service import ResearchService
from app.managers.ai_manager import AIManager

router = APIRouter(prefix="/api/v1/research", tags=["Research"])

@router.get("/categories", response_model=List[str])
def get_categories():
    return AIManager.CATEGORIES

@router.get("/reports", response_model=List[ResearchReportResponse])
def list_reports(
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = ResearchService(db)
    return service.list_reports(limit=limit, category=category)

@router.get("/reports/{report_id}", response_model=ResearchReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)):
    service = ResearchService(db)
    report = service.get_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Research report not found")
    return report

@router.post("/generate", response_model=ResearchReportResponse)
async def generate_report(
    req: GenerateReportRequest,
    db: Session = Depends(get_db)
):
    service = ResearchService(db)
    return await service.generate_and_save_report(category=req.category)
