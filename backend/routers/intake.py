"""
Document intake — upload a skill-gap document, get AI-generated program
recommendations queued for Human-in-the-Loop review.

The critical invariant of this module: an upload NEVER produces an active
assignment. Every path here creates the assignment in `pending` and a matching
`hil_queue` row in `pending`. Only a Talent Lead approving via
POST /hil-queue/{id}/action flips the assignment to `active`.
"""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
from services import extractor, recommender

router = APIRouter(prefix="/intake", tags=["Intake"])

DEFAULT_DEADLINE_DAYS = 30
FALLBACK_RFP_REFERENCE = "RFP-INTAKE-UNASSIGNED"


# ──────────────────────────────────────────────────────────────
# Deterministic helpers — deliberately NOT the model's job
# ──────────────────────────────────────────────────────────────

def _compute_deadline(rfp: RFP | None) -> date:
    """
    BR-003: deadline = engagement start − deployment buffer.
    Rule-based on purpose; the model is explicitly forbidden from proposing dates.
    """
    if rfp and rfp.engagement_start:
        buffer = rfp.deployment_buffer or 7
        deadline = rfp.engagement_start - timedelta(days=buffer)
        if deadline > date.today():
            return deadline
    return date.today() + timedelta(days=DEFAULT_DEADLINE_DAYS)


async def _resolve_resource(db: AsyncSession, learner) -> tuple[Resource, bool]:
    """Find an existing resource by code, then email, then exact name. Otherwise create one."""
    if learner.resource_code:
        row = await db.execute(
            select(Resource).where(Resource.resource_code == learner.resource_code.strip())
        )
        found = row.scalar_one_or_none()
        if found:
            return found, False

    if learner.email:
        row = await db.execute(select(Resource).where(Resource.email == learner.email.strip()))
        found = row.scalar_one_or_none()
        if found:
            return found, False

    row = await db.execute(select(Resource).where(Resource.full_name == learner.full_name.strip()))
    found = row.scalar_one_or_none()
    if found:
        return found, False

    code = learner.resource_code.strip() or f"R-{uuid.uuid4().hex[:6].upper()}"
    created = Resource(
        resource_code=code,
        full_name=learner.full_name.strip(),
        role=(learner.role or "").strip() or None,
        department=(learner.department or "").strip() or None,
        email=(learner.email or "").strip() or None,
    )
    db.add(created)
    await db.flush()
    return created, True


async def _resolve_rfp(db: AsyncSession, rfp_reference: str | None) -> RFP:
    reference = (rfp_reference or "").strip() or FALLBACK_RFP_REFERENCE

    row = await db.execute(select(RFP).where(RFP.rfp_reference == reference))
    found = row.scalar_one_or_none()
    if found:
        return found

    created = RFP(
        rfp_reference=reference,
        client_name="Unassigned — created from document intake",
        deployment_buffer=7,
    )
    db.add(created)
    await db.flush()
    return created


# ──────────────────────────────────────────────────────────────
# Endpoint
# ──────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_gap_document(
    file: UploadFile = File(...),
    rfp_reference: str | None = Form(None),
    uploaded_by: str = Form("talent_lead_01"),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a PDF / Excel / CSV describing people with skill gaps.

    Returns the HIL queue entries created. Nothing is assigned — every entry
    waits for a Talent Lead decision.
    """
    raw = await file.read()

    # 1 — turn the upload into something the model can read
    try:
        document_block = extractor.to_content_block(file.filename, file.content_type, raw)
    except extractor.UnsupportedDocument as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2 — load the approved catalogue (guardrail: approved content only)
    rows = await db.execute(select(TrainingProgram))
    programs = rows.scalars().all()
    if not programs:
        raise HTTPException(
            status_code=409,
            detail="The training catalogue is empty. Seed training_programs before running intake.",
        )

    catalogue = [
        {
            "id": str(p.id),
            "program_name": p.program_name,
            "cert_name": p.cert_name,
            "skill_category": p.skill_category,
            "content_modules": p.content_modules,
            "total_duration_h": p.total_duration_h,
        }
        for p in programs
    ]
    approved_ids = {c["id"] for c in catalogue}
    programs_by_id = {str(p.id): p for p in programs}

    # 3 — ask the model
    try:
        result = recommender.recommend(document_block, catalogue)
        warnings = recommender.validate_against_catalogue(result, approved_ids)
    except recommender.RecommenderUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except recommender.InvalidRecommendation as e:
        # Rejected content is itself an auditable event
        db.add(AuditLog(
            action_type="intake_rejected",
            entity_type="intake",
            actor=uploaded_by,
            level=LogLevel.error,
            message=f"Intake rejected for {file.filename}: {e}",
        ))
        await db.commit()
        raise HTTPException(status_code=422, detail=str(e))

    if not result.candidates:
        raise HTTPException(
            status_code=422,
            detail="No people with skill gaps could be identified in this document.",
        )

    # 4 — persist: pending assignment + pending HIL entry, per candidate
    rfp = await _resolve_rfp(db, rfp_reference)
    deadline = _compute_deadline(rfp)
    created_entries = []

    for candidate in result.candidates:
        resource, is_new = await _resolve_resource(db, candidate.learner)
        program = programs_by_id[candidate.recommended.catalogue_program_id]

        assignment = Assignment(
            resource_id=resource.id,
            rfp_id=rfp.id,
            program_id=program.id,
            assigned_date=None,                  # set on approval, not now
            deadline=deadline,
            status=AssignmentStatus.pending,     # ← GUARDRAIL: never active from intake
            overall_progress=0,
            notes=candidate.gap_explanation,
        )
        db.add(assignment)
        await db.flush()

        # Belt and braces: if anyone ever changes the default above, fail loudly.
        assert assignment.status == AssignmentStatus.pending, (
            "Intake must never create an active assignment"
        )

        rec = candidate.recommended
        proposed = {
            "schema_version": "2.0",
            "source": "ai_intake",
            # v2 authored-content shape (what Studio and the learner platform read)
            "program_name": rec.program_name,
            "cert_name": rec.cert_name,
            "module_list": [m.model_dump() for m in rec.modules],
            "test": {"pass_pct": 70, "questions": []},   # Coordinator authors questions in Studio
            "case_study": {"title": rec.case_study_title, "brief": rec.case_study_brief},
            "rationale": rec.rationale,
            "generated_by": recommender.MODEL,
            "source_document": file.filename,
            "document_kind": result.document_kind,
            "gap_explanation": candidate.gap_explanation,
            "learner": candidate.learner.model_dump(),
            "recommended": candidate.recommended.model_dump(),
            "alternatives": [a.model_dump() for a in candidate.alternatives],
            # Fields the existing HIL table reads
            "program": candidate.recommended.program_name,
            "modules": len(candidate.recommended.modules),
            "est_hours": candidate.recommended.total_duration_h,
        }

        hil = HilQueue(
            assignment_id=assignment.id,
            recommended_by=f"ai:{recommender.MODEL}",
            # AI drafts land in the Coordinator's Program Studio first; the
            # Coordinator refines content/test/sandbox and sends to HIL.
            status=HilStatus.draft,              # ← GUARDRAIL: human pipeline ahead
            proposed_program=proposed,
        )
        db.add(hil)
        await db.flush()

        # BR-007 — full traceability of what the AI proposed, before any human edit
        db.add(AuditLog(
            rfp_ref=rfp.rfp_reference,
            resource_id=str(resource.id),
            action_type="ai_recommendation_created",
            entity_type="hil_queue",
            entity_id=hil.id,
            new_val=candidate.recommended.program_name,
            actor=f"ai:{recommender.MODEL}",
            level=LogLevel.info,
            message=(
                f"AI recommended '{candidate.recommended.program_name}' for "
                f"{resource.full_name} ({candidate.recommended.confidence}% confidence) "
                f"from {file.filename} — draft in Program Studio"
            ),
        ))

        created_entries.append({
            "hil_id": str(hil.id),
            "assignment_id": str(assignment.id),
            "resource": {
                "id": str(resource.id),
                "resource_code": resource.resource_code,
                "full_name": resource.full_name,
                "newly_created": is_new,
            },
            "recommended_program": candidate.recommended.program_name,
            "confidence": candidate.recommended.confidence,
            "alternatives": [a.program_name for a in candidate.alternatives],
            "status": "draft",
        })

    db.add(AuditLog(
        rfp_ref=rfp.rfp_reference,
        action_type="intake_processed",
        entity_type="intake",
        actor=uploaded_by,
        level=LogLevel.action,
        message=(
            f"Processed '{file.filename}' ({result.document_kind}): "
            f"{len(created_entries)} draft program(s) created in Program Studio"
        ),
    ))

    await db.commit()

    return {
        "source_document": file.filename,
        "document_kind": result.document_kind,
        "document_summary": result.document_summary,
        "rfp_reference": rfp.rfp_reference,
        "deadline": str(deadline),
        "entries": created_entries,
        "warnings": warnings,
        "note": (
            "Nothing has been assigned. Drafts are in the Program Studio — refine them and "
            "send to HIL; only the Talent Lead's approval activates an assignment."
        ),
    }
