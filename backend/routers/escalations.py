from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from uuid import UUID
from datetime import datetime, timezone, date

from database import get_db
from models import Escalation, Assignment, AuditLog, LogLevel, EscalationStatus

router = APIRouter(prefix="/escalations", tags=["Escalations"])


# 🔹 Load escalations with relationships
def _load():
    return select(Escalation).options(
        selectinload(Escalation.assignment).selectinload(Assignment.resource),
        selectinload(Escalation.assignment).selectinload(Assignment.rfp),
        selectinload(Escalation.assignment).selectinload(Assignment.program),
    ).order_by(desc(Escalation.escalation_ts))


# 🔹 GET escalations
@router.get("")
async def list_escalations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(_load())
    rows = result.scalars().all()
    return [_fmt(e) for e in rows]


# 🔹 POST action (resolve escalation)
@router.post("/{eid}/action")
async def resolve_escalation(
    eid: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    try:
        result = await db.execute(
            _load().where(Escalation.id == eid)
        )
        esc = result.scalar_one_or_none()

        if not esc:
            raise HTTPException(status_code=404, detail="Escalation not found")

        action = payload.get("action")
        if not action:
            raise HTTPException(status_code=400, detail="Action is required")

        # ✅ Allowed actions
        action_map = {
            "extend_deadline": EscalationStatus.resolved_extend,
            "replace_resource": EscalationStatus.resolved_replace,
            "accept_risk": EscalationStatus.resolved_accept_risk
        }

        if action not in action_map:
            raise HTTPException(status_code=400, detail="Invalid action")

        # ✅ Update escalation
        esc.status = action_map[action]
        esc.resolved_by = payload.get("resolved_by", "talent_lead")
        esc.resolution_notes = payload.get("resolution_notes", "")
        esc.resolved_ts = datetime.now(timezone.utc)

        # ✅ Handle deadline extension
        if action == "extend_deadline":
            new_deadline = payload.get("new_deadline")
            if not new_deadline:
                raise HTTPException(status_code=400, detail="new_deadline required")

            try:
                esc.new_deadline = date.fromisoformat(new_deadline)
            except:
                raise HTTPException(status_code=400, detail="Invalid date format")

            esc.assignment.deadline = esc.new_deadline

        # ✅ Audit log
        log = AuditLog(
            resource_id=str(esc.assignment.resource_id),
            action_type=f"escalation_{action}",
            entity_type="escalation",
            entity_id=eid,
            actor=esc.resolved_by,
            level=LogLevel.action,
            message=f"Escalation resolved: {action} — {esc.resolution_notes}"
        )

        db.add(log)

        await db.commit()
        await db.refresh(esc)

        return {
            "status": "ok",
            "action": action,
            "id": str(eid)
        }

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 🔹 Format response
def _fmt(e):
    a = e.assignment
    return {
        "id": str(e.id),
        "escalation_ts": str(e.escalation_ts),
        "reason": e.reason,
        "status": e.status,
        "progress_snapshot": e.progress_snapshot,
        "resolved_by": e.resolved_by,
        "resolution_notes": e.resolution_notes,
        "new_deadline": str(e.new_deadline) if e.new_deadline else None,
        "assignment": {
            "id": str(a.id),
            "status": a.status,
            "overall_progress": a.overall_progress,
            "deadline": str(a.deadline),
            "resource": {
                "resource_code": a.resource.resource_code,
                "full_name": a.resource.full_name,
                "role": a.resource.role
            } if a.resource else {},
            "rfp": {
                "rfp_reference": a.rfp.rfp_reference
            } if a.rfp else {},
            "program": {
                "program_name": a.program.program_name
            } if a.program else {}
        }
    }