from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
from datetime import date, datetime, timezone
from pydantic import BaseModel

from database import get_db
from models import (
    HilQueue,
    Assignment,
    AuditLog,
    LogLevel,
    HilStatus,
    AssignmentStatus
)

router = APIRouter(prefix="/hil-queue", tags=["HIL"])


# =========================
# 🔹 Request Schema
# =========================
class HILActionRequest(BaseModel):
    action: str
    reviewer_id: Optional[str] = None
    reviewer_notes: Optional[str] = None


# =========================
# 🔹 Query Loader
# =========================
def _load():
    return select(HilQueue).options(
        selectinload(HilQueue.assignment).selectinload(Assignment.resource),
        selectinload(HilQueue.assignment).selectinload(Assignment.rfp),
        selectinload(HilQueue.assignment).selectinload(Assignment.program),
    ).order_by(desc(HilQueue.created_at))


# =========================
# 🔹 GET HIL Queue
# =========================
@router.get("")
async def list_hil(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = _load()

    if status:
        query = query.where(HilQueue.status == status)
    else:
        # Drafts belong to the Program Studio, not the Talent Lead's queue
        query = query.where(HilQueue.status != HilStatus.draft)

    result = await db.execute(query)
    rows = result.scalars().all()

    return [_fmt(h) for h in rows]


# =========================
# 🔹 POST Action
# =========================
@router.post("/{hil_id}/action")
async def hil_action(
    hil_id: UUID,
    payload: HILActionRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        # 🔍 Fetch HIL record
        result = await db.execute(
            _load().where(HilQueue.id == hil_id)
        )
        hil = result.scalar_one_or_none()

        if not hil:
            raise HTTPException(status_code=404, detail="HIL not found")

        action = payload.action

        # ✅ Validate action
        allowed_actions = {"approve", "reject", "modify"}
        if action not in allowed_actions:
            raise HTTPException(status_code=400, detail="Invalid action")

        actor = payload.reviewer_id or "talent_lead"

        hil.reviewer_id = actor
        hil.reviewer_notes = payload.reviewer_notes or ""
        hil.decision_ts = datetime.now(timezone.utc)

        # =========================
        # 🔥 Business Logic
        # =========================
        if hil.status == HilStatus.draft:
            raise HTTPException(
                status_code=409,
                detail="This entry is still a Coordinator draft — it must be sent to HIL before a decision.",
            )

        if action == "approve":
            hil.status = HilStatus.approved
            hil.assignment.status = AssignmentStatus.active
            hil.assignment.assigned_date = date.today()   # BR-003: formally assigned on confirmation

        elif action == "reject":
            hil.status = HilStatus.rejected
            hil.assignment.status = AssignmentStatus.cancelled

        elif action == "modify":
            hil.status = HilStatus.modified
            hil.assignment.status = AssignmentStatus.active
            hil.assignment.assigned_date = date.today()

        # =========================
        # 📝 Audit Log
        # =========================
        log = AuditLog(
            resource_id=str(hil.assignment.resource_id),
            action_type=f"hil_{action}",
            entity_type="hil_queue",
            entity_id=hil_id,
            actor=actor,
            level=LogLevel.action,
            message=f"HIL {action}: {hil.reviewer_notes}"
        )

        db.add(log)

        # =========================
        # 💾 Commit safely
        # =========================
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            raise

        await db.refresh(hil)

        return {
            "id": str(hil.id),
            "status": hil.status.value,
            "assignment_status": hil.assignment.status.value
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =========================
# 🔹 Formatter
# =========================
def _fmt(h):
    a = h.assignment

    return {
        "id": str(h.id),
        "status": h.status.value if h.status else None,
        "recommended_by": h.recommended_by,
        "reviewer_id": h.reviewer_id,
        "reviewer_notes": h.reviewer_notes,
        "decision_ts": str(h.decision_ts) if h.decision_ts else None,
        "created_at": str(h.created_at),
        "proposed_program": h.proposed_program,

        "assignment": {
            "id": str(a.id),
            "status": a.status.value if a.status else None,
            "overall_progress": a.overall_progress,
            "deadline": str(a.deadline),

            "resource": {
                "resource_code": a.resource.resource_code,
                "full_name": a.resource.full_name,
                "role": a.resource.role,
            } if a.resource else {},

            "rfp": {
                "rfp_reference": a.rfp.rfp_reference
            } if a.rfp else {},

            "program": {
                "program_name": a.program.program_name,
                "cert_name": a.program.cert_name,
            } if a.program else {}
        }
    }