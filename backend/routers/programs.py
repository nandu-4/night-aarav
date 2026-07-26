"""
Program Studio — the Training Coordinator's workspace.

The Coordinator (the BRD's "Training and Certification Coordinator" role) sees
the list of people with skill gaps, builds or refines each training program —
content modules, the online test, and the case-study / sandbox task — and then
sends it to the Talent Lead for HIL approval.

Lifecycle owned by this router:

    draft  ──(coordinator edits content/test/sandbox)──►  draft
    draft  ──(send to HIL)──────────────────────────────►  pending
                                                             │
                       Talent Lead approves via /hil-queue ──┴──► assignment active

Guardrail: nothing in this router can activate an assignment. Drafts and
submissions always leave the assignment in `pending`; only the Talent Lead's
HIL decision flips it.
"""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified
from typing import Optional
from uuid import UUID

from database import get_db
from models import (
    Assignment,
    AssignmentStatus,
    AuditLog,
    HilQueue,
    HilStatus,
    LogLevel,
    RFP,
    Resource,
    TrainingProgram,
)

router = APIRouter(prefix="/programs", tags=["Program Studio"])

DEFAULT_DEADLINE_DAYS = 30
FALLBACK_RFP_REFERENCE = "RFP-INTAKE-UNASSIGNED"


# ──────────────────────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────────────────────

class TestQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=2, max_length=6)
    correct_index: int = 0


class ModuleSpec(BaseModel):
    title: str
    hours: int = 2
    objective: str = ""


class ProgramContent(BaseModel):
    """Everything the Coordinator authors for one learner."""
    program_name: str
    cert_name: str = ""
    modules: list[ModuleSpec] = []
    test_pass_pct: int = 70
    test_questions: list[TestQuestion] = []
    case_study_title: str = ""
    case_study_brief: str = ""
    est_hours: int = 0
    rationale: str = ""


class DraftCreate(BaseModel):
    # learner — either an existing resource_code or enough info to create one
    resource_code: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    email: Optional[str] = None
    gap_description: str = ""
    rfp_reference: Optional[str] = None
    catalogue_program_id: str
    content: ProgramContent
    created_by: str = "coordinator_01"


class DraftUpdate(BaseModel):
    content: ProgramContent
    updated_by: str = "coordinator_01"


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _load():
    return select(HilQueue).options(
        selectinload(HilQueue.assignment).selectinload(Assignment.resource),
        selectinload(HilQueue.assignment).selectinload(Assignment.rfp),
        selectinload(HilQueue.assignment).selectinload(Assignment.program),
    ).order_by(desc(HilQueue.created_at))


def _fmt_draft(h: HilQueue) -> dict:
    a = h.assignment
    return {
        "hil_id": str(h.id),
        "assignment_id": str(a.id),
        "status": h.status.value,
        "recommended_by": h.recommended_by,
        "created_at": str(h.created_at),
        "proposed_program": h.proposed_program,
        "resource": {
            "id": str(a.resource.id),
            "resource_code": a.resource.resource_code,
            "full_name": a.resource.full_name,
            "role": a.resource.role,
        } if a.resource else None,
        "rfp_reference": a.rfp.rfp_reference if a.rfp else None,
        "deadline": str(a.deadline),
        "gap_description": a.notes,
        "catalogue_program": {
            "id": str(a.program.id),
            "program_name": a.program.program_name,
            "cert_name": a.program.cert_name,
        } if a.program else None,
    }


# ──────────────────────────────────────────────────────────────
# Catalogue (for the Studio program picker)
# ──────────────────────────────────────────────────────────────

@router.get("/catalogue")
async def list_catalogue(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(TrainingProgram).order_by(TrainingProgram.program_name))
    return [
        {
            "id": str(p.id),
            "program_name": p.program_name,
            "cert_name": p.cert_name,
            "skill_category": p.skill_category,
            "content_modules": p.content_modules,
            "total_duration_h": p.total_duration_h,
        }
        for p in rows.scalars().all()
    ]


# ──────────────────────────────────────────────────────────────
# Drafts — the Coordinator's gap list
# ──────────────────────────────────────────────────────────────

@router.get("/drafts")
async def list_drafts(db: AsyncSession = Depends(get_db)):
    """All draft programs — people with skill gaps awaiting a finished program."""
    rows = await db.execute(_load().where(HilQueue.status == HilStatus.draft))
    return [_fmt_draft(h) for h in rows.scalars().all()]


@router.post("/drafts")
async def create_draft(payload: DraftCreate, db: AsyncSession = Depends(get_db)):
    """Coordinator manually creates a program draft for a person with a gap."""
    # resolve the catalogue program (approved content only)
    prog_row = await db.execute(
        select(TrainingProgram).where(TrainingProgram.id == payload.catalogue_program_id)
    )
    program = prog_row.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=400, detail="Unknown catalogue program — approved content only.")

    # resolve or create the learner
    resource = None
    if payload.resource_code:
        row = await db.execute(select(Resource).where(Resource.resource_code == payload.resource_code.strip()))
        resource = row.scalar_one_or_none()
    if resource is None and payload.full_name:
        row = await db.execute(select(Resource).where(Resource.full_name == payload.full_name.strip()))
        resource = row.scalar_one_or_none()
    if resource is None:
        if not payload.full_name:
            raise HTTPException(status_code=400, detail="Provide resource_code or full_name.")
        resource = Resource(
            resource_code=(payload.resource_code or f"R-{uuid.uuid4().hex[:6].upper()}").strip(),
            full_name=payload.full_name.strip(),
            role=(payload.role or "").strip() or None,
            department=(payload.department or "").strip() or None,
            email=(payload.email or "").strip() or None,
        )
        db.add(resource)
        await db.flush()

    # resolve or create the RFP; deadline is rule-based, never authored
    reference = (payload.rfp_reference or "").strip() or FALLBACK_RFP_REFERENCE
    rfp_row = await db.execute(select(RFP).where(RFP.rfp_reference == reference))
    rfp = rfp_row.scalar_one_or_none()
    if rfp is None:
        rfp = RFP(rfp_reference=reference, client_name="Created from Program Studio", deployment_buffer=7)
        db.add(rfp)
        await db.flush()

    if rfp.engagement_start and rfp.engagement_start - timedelta(days=rfp.deployment_buffer or 7) > date.today():
        deadline = rfp.engagement_start - timedelta(days=rfp.deployment_buffer or 7)
    else:
        deadline = date.today() + timedelta(days=DEFAULT_DEADLINE_DAYS)

    assignment = Assignment(
        resource_id=resource.id,
        rfp_id=rfp.id,
        program_id=program.id,
        deadline=deadline,
        status=AssignmentStatus.pending,      # guardrail: Studio never activates
        overall_progress=0,
        notes=payload.gap_description,
    )
    db.add(assignment)
    await db.flush()

    hil = HilQueue(
        assignment_id=assignment.id,
        recommended_by=payload.created_by,
        status=HilStatus.draft,
        proposed_program=_content_to_json(payload.content, source="coordinator"),
    )
    db.add(hil)
    await db.flush()

    db.add(AuditLog(
        rfp_ref=rfp.rfp_reference,
        resource_id=str(resource.id),
        action_type="program_draft_created",
        entity_type="hil_queue",
        entity_id=hil.id,
        actor=payload.created_by,
        level=LogLevel.info,
        message=f"Program draft created for {resource.full_name}: {payload.content.program_name}",
    ))
    await db.commit()

    row = await db.execute(_load().where(HilQueue.id == hil.id))
    return _fmt_draft(row.scalar_one())


@router.patch("/drafts/{hil_id}")
async def update_draft(hil_id: UUID, payload: DraftUpdate, db: AsyncSession = Depends(get_db)):
    """Coordinator edits the program content / test / sandbox of a draft."""
    row = await db.execute(_load().where(HilQueue.id == hil_id))
    hil = row.scalar_one_or_none()
    if not hil:
        raise HTTPException(status_code=404, detail="Draft not found")
    if hil.status != HilStatus.draft:
        raise HTTPException(status_code=409, detail=f"Entry is '{hil.status.value}', not editable. Only drafts can be edited.")

    existing = dict(hil.proposed_program or {})
    updated = _content_to_json(payload.content, source=existing.get("source", "coordinator"))
    # preserve intake provenance (AI learner profile, source document, …)
    for key in ("learner", "source_document", "document_kind", "gap_explanation", "generated_by", "alternatives"):
        if key in existing:
            updated[key] = existing[key]
    hil.proposed_program = updated
    flag_modified(hil, "proposed_program")

    db.add(AuditLog(
        resource_id=str(hil.assignment.resource_id),
        action_type="program_draft_updated",
        entity_type="hil_queue",
        entity_id=hil.id,
        original_val=existing.get("program"),
        new_val=payload.content.program_name,
        actor=payload.updated_by,
        level=LogLevel.info,
        message=f"Program draft updated: {payload.content.program_name}",
    ))
    await db.commit()

    row = await db.execute(_load().where(HilQueue.id == hil_id))
    return _fmt_draft(row.scalar_one())


@router.post("/drafts/{hil_id}/submit")
async def submit_draft(hil_id: UUID, submitted_by: str = "coordinator_01", db: AsyncSession = Depends(get_db)):
    """Send a finished draft to the Talent Lead for HIL approval."""
    row = await db.execute(_load().where(HilQueue.id == hil_id))
    hil = row.scalar_one_or_none()
    if not hil:
        raise HTTPException(status_code=404, detail="Draft not found")
    if hil.status != HilStatus.draft:
        raise HTTPException(status_code=409, detail=f"Entry is already '{hil.status.value}'.")

    prog = hil.proposed_program or {}
    if not prog.get("modules"):
        raise HTTPException(status_code=422, detail="Add at least one content module before sending to HIL.")

    hil.status = HilStatus.pending
    # assignment must still be pending — approval is the Talent Lead's decision
    assert hil.assignment.status == AssignmentStatus.pending

    db.add(AuditLog(
        resource_id=str(hil.assignment.resource_id),
        action_type="program_sent_to_hil",
        entity_type="hil_queue",
        entity_id=hil.id,
        actor=submitted_by,
        level=LogLevel.action,
        message=(
            f"Program '{prog.get('program', '?')}' for "
            f"{hil.assignment.resource.full_name} sent to Talent Lead for HIL approval"
        ),
    ))
    await db.commit()
    return {"hil_id": str(hil.id), "status": "pending", "note": "Awaiting Talent Lead approval."}


# ──────────────────────────────────────────────────────────────
# Shared JSON shape
# ──────────────────────────────────────────────────────────────

def _content_to_json(c: ProgramContent, source: str) -> dict:
    est = c.est_hours or sum(m.hours for m in c.modules)
    return {
        "schema_version": "2.0",
        "source": source,
        # summary fields the HIL table reads
        "program": c.program_name,
        "modules": len(c.modules),
        "est_hours": est,
        # full authored content
        "program_name": c.program_name,
        "cert_name": c.cert_name,
        "module_list": [m.model_dump() for m in c.modules],
        "test": {
            "pass_pct": c.test_pass_pct,
            "questions": [q.model_dump() for q in c.test_questions],
        },
        "case_study": {
            "title": c.case_study_title,
            "brief": c.case_study_brief,
        },
        "rationale": c.rationale,
    }
