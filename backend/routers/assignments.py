from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from datetime import date

from database import get_db
from models import Assignment, AuditLog, LogLevel

router = APIRouter(prefix="/assignments", tags=["Assignments"])


# 🔹 Request schema (MUST be outside functions)
class AssignmentCreate(BaseModel):
    resource_id: str
    rfp_id: str
    program_id: str
    deadline: date
    assigned_date: Optional[date] = None
    notes: Optional[str] = None


# 🔹 Load query with relationships
def _load():
    return select(Assignment).options(
        selectinload(Assignment.resource),
        selectinload(Assignment.rfp),
        selectinload(Assignment.program),
    ).order_by(desc(Assignment.created_at))


# 🔹 GET assignments
@router.get("")
async def list_assignments(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = _load()

    if status:
        query = query.where(Assignment.status == status)

    result = await db.execute(query)
    rows = result.scalars().all()

    return [_fmt(a) for a in rows]


# 🔹 POST create assignment
@router.post("")
async def create_assignment(
    payload: AssignmentCreate,
    db: AsyncSession = Depends(get_db)
):
    try:
        new_assignment = Assignment(
            resource_id=payload.resource_id,
            rfp_id=payload.rfp_id,
            program_id=payload.program_id,
            deadline=payload.deadline,
            assigned_date=payload.assigned_date,
            notes=payload.notes
        )

        db.add(new_assignment)
        await db.commit()
        await db.refresh(new_assignment)

        return _fmt(new_assignment)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 🔹 PATCH update assignment
@router.patch("/{aid}")
async def update_assignment(
    aid: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        _load().where(Assignment.id == aid)
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    # update fields
    for key, value in payload.items():
        if hasattr(assignment, key):
            setattr(assignment, key, value)

    # audit log
    log = AuditLog(
        resource_id=str(assignment.resource_id),
        action_type="assignment_updated",
        entity_type="assignment",
        entity_id=aid,
        actor="talent_lead",
        level=LogLevel.action,
        message=f"Assignment updated: {payload}"
    )

    db.add(log)

    await db.commit()
    await db.refresh(assignment)

    return _fmt(assignment)


# 🔹 Format response
def _fmt(a):
    return {
        "id": str(a.id),
        "resource": {
            "resource_code": a.resource.resource_code if a.resource else None,
            "full_name": a.resource.full_name if a.resource else None,
            "role": a.resource.role if a.resource else None,
        },
        "rfp": {
            "rfp_reference": a.rfp.rfp_reference if a.rfp else None
        },
        "program": {
            "program_name": a.program.program_name if a.program else None,
            "cert_name": a.program.cert_name if a.program else None,
        },
        "assigned_date": str(a.assigned_date) if a.assigned_date else None,
        "deadline": str(a.deadline),
        "content_status": a.content_status,
        "test_status": a.test_status,
        "case_study_status": a.case_study_status,
        "overall_progress": a.overall_progress,
        "status": a.status,
        "test_score": float(a.test_score) if a.test_score else None,
        "test_attempts": a.test_attempts,
        "case_study_score": float(a.case_study_score) if a.case_study_score else None,
        "notes": a.notes,
    }