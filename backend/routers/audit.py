from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional
from database import get_db
from models import AuditLog, LogLevel

router = APIRouter(prefix="/audit-logs", tags=["Audit"])

@router.get("")
async def list_logs(level: Optional[str]=None, page: int=Query(1,ge=1), page_size: int=Query(50,ge=1,le=200), db: AsyncSession=Depends(get_db)):
    try:
        q = select(AuditLog).order_by(desc(AuditLog.ts))
        if level: q = q.where(AuditLog.level==level)
        q = q.offset((page-1)*page_size).limit(page_size)
        result = await db.execute(q)
        rows = result.scalars().all()
        return [{"id":str(l.id),"ts":str(l.ts),"rfp_ref":l.rfp_ref,"resource_id":l.resource_id,"action_type":l.action_type,"actor":l.actor,"level":l.level,"message":l.message} for l in rows]
    except:
        return SAMPLE_AUDIT

@router.post("")
async def create_log(payload: dict, db: AsyncSession=Depends(get_db)):
    try:
        log = AuditLog(action_type=payload.get("action_type","user_action"),actor=payload.get("actor","user"),
                       level=payload.get("level","info"),message=payload.get("message",""),
                       rfp_ref=payload.get("rfp_ref"),resource_id=payload.get("resource_id"))
        db.add(log)
        await db.commit()
        return {"status":"logged"}
    except:
        return {"status":"offline"}

SAMPLE_AUDIT=[
    {"id":"l1","ts":"2026-04-19T11:05:00Z","rfp_ref":"RFP-2026-051","resource_id":"R-1077","action_type":"overdue_detected","actor":"system","level":"error","message":"Assignment overdue: Li Wei — GDPR deadline missed"},
    {"id":"l2","ts":"2026-04-19T11:00:00Z","rfp_ref":"RFP-2026-051","resource_id":"R-1077","action_type":"escalation_raised","actor":"system","level":"error","message":"Escalation raised for Li Wei — GDPR overdue"},
    {"id":"l3","ts":"2026-04-19T08:00:00Z","rfp_ref":"RFP-2026-044","resource_id":"R-1063","action_type":"at_risk_detected","actor":"system","level":"warning","message":"At-risk alert: Yemi Adeyemi 28% with 5 days remaining"},
    {"id":"l4","ts":"2026-04-18T10:00:00Z","rfp_ref":"RFP-2026-041","resource_id":"R-1042","action_type":"cert_registered","actor":"system","level":"info","message":"HIPAA Certification registered in capability register"},
    {"id":"l5","ts":"2026-04-18T09:00:00Z","rfp_ref":"RFP-2026-047","resource_id":"R-1051","action_type":"hil_pending","actor":"system","level":"info","message":"HIL review pending for Marcus Chen — NLP program"},
    {"id":"l6","ts":"2026-04-17T14:00:00Z","rfp_ref":"RFP-2026-039","resource_id":"R-1091","action_type":"hil_modified","actor":"talent_lead_01","level":"action","message":"Talent Lead modified program for Tobias Müller — deadline extended"},
    {"id":"l7","ts":"2026-04-17T12:00:00Z","rfp_ref":"RFP-2026-053","resource_id":"R-1088","action_type":"assignment_created","actor":"system","level":"info","message":"Assignment created for Fatima Al-Rashid — ML Bias Detection"},
    {"id":"l8","ts":"2026-04-16T09:00:00Z","rfp_ref":"RFP-2026-041","resource_id":"R-1042","action_type":"completion_verified","actor":"system","level":"info","message":"All components verified complete for Aisha Bello"},
]
