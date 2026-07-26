"""
Learning platform — the Resource (learner) side.

Once the Talent Lead approves an assignment, the learner sees it here as a
course: content modules to work through, an online test that is graded
server-side, and a case-study / sandbox task to submit. Progress rolls up to
the assignment the rest of the system already tracks.

Completion rule (BR-005): only when all three components are complete does the
assignment flip to `complete` — and a certification record is created, pending
verification.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from database import get_db
from models import (
    Assignment,
    AssignmentStatus,
    AuditLog,
    CertStatus,
    Certification,
    ComponentStatus,
    HilQueue,
    HilStatus,
    LogLevel,
    Resource,
)

router = APIRouter(prefix="/learning", tags=["Learning"])


class TestSubmission(BaseModel):
    answers: list[int]                 # chosen option index per question
    resource_id: Optional[str] = None  # who is submitting (no login — trusted UI)


class CaseSubmission(BaseModel):
    submission_text: str
    resource_id: Optional[str] = None


# ──────────────────────────────────────────────────────────────
# Course-content normalisation
#
# proposed_program has three historical shapes:
#   v2  — Program Studio  (module_list / test.questions / case_study)
#   v1  — AI intake       (recommended.modules / test_question_count / case_study_*)
#   seed— demo SQL        ({program, modules: 3, est_hours})
# Everything is normalised here so the learner UI sees one shape.
# ──────────────────────────────────────────────────────────────

def _course_content(hil_prog: dict | None, catalogue_program) -> dict:
    p = hil_prog or {}

    modules = []
    if p.get("module_list"):                                  # v2
        modules = [
            {"title": m.get("title", "Module"), "hours": m.get("hours", 2), "objective": m.get("objective", "")}
            for m in p["module_list"]
        ]
    elif isinstance(p.get("recommended"), dict) and p["recommended"].get("modules"):   # v1
        modules = [
            {"title": m.get("title", "Module"), "hours": m.get("hours", 2), "objective": m.get("objective", "")}
            for m in p["recommended"]["modules"]
        ]
    elif catalogue_program is not None and catalogue_program.content_modules:          # seed fallback
        raw = catalogue_program.content_modules
        if isinstance(raw, list):
            modules = [{"title": str(m), "hours": 2, "objective": ""} for m in raw]

    test = {"pass_pct": 70, "questions": []}
    if isinstance(p.get("test"), dict):                       # v2
        test["pass_pct"] = p["test"].get("pass_pct", 70)
        test["questions"] = p["test"].get("questions", [])

    case_study = {"title": "", "brief": ""}
    if isinstance(p.get("case_study"), dict):                 # v2
        case_study = {"title": p["case_study"].get("title", ""), "brief": p["case_study"].get("brief", "")}
    elif isinstance(p.get("recommended"), dict):              # v1
        case_study = {
            "title": p["recommended"].get("case_study_title", ""),
            "brief": p["recommended"].get("case_study_brief", ""),
        }
    if not case_study["title"]:
        case_study = {
            "title": "Applied case study",
            "brief": "Apply what you learned to a realistic scenario for your role and submit a written summary of your approach and results.",
        }

    program_name = (
        p.get("program_name") or p.get("program")
        or (catalogue_program.program_name if catalogue_program else "Training Program")
    )
    cert_name = (
        p.get("cert_name")
        or (isinstance(p.get("recommended"), dict) and p["recommended"].get("cert_name"))
        or (catalogue_program.cert_name if catalogue_program else "")
        or ""
    )
    rationale = (
        p.get("rationale") or p.get("gap_explanation")
        or (isinstance(p.get("recommended"), dict) and p["recommended"].get("rationale"))
        or ""
    )

    return {
        "program_name": program_name,
        "cert_name": cert_name,
        "rationale": rationale,
        "modules": modules,
        "test": test,
        "case_study": case_study,
    }


def _progress(assignment: Assignment, content: dict) -> dict:
    state = assignment.learning_state or {}
    total_modules = len(content["modules"]) or 1
    done_modules = len([i for i in state.get("modules_done", []) if i < total_modules])
    module_pct = round(done_modules / total_modules * 100)

    has_test = len(content["test"]["questions"]) > 0
    test_passed = state.get("test", {}).get("passed", False)
    test_pct = 100 if test_passed else 0

    case_done = bool(state.get("case_study", {}).get("submitted_at"))
    case_pct = 100 if case_done else 0

    # components without published content don't block completion
    parts = [module_pct]
    if has_test:
        parts.append(test_pct)
    parts.append(case_pct)
    overall = round(sum(parts) / len(parts))

    return {
        "modules_done": sorted(i for i in state.get("modules_done", []) if i < total_modules),
        "module_pct": module_pct,
        "test_attempts": assignment.test_attempts or 0,
        "test_score": float(assignment.test_score) if assignment.test_score is not None else None,
        "test_passed": test_passed,
        "test_available": has_test,
        "case_submitted": case_done,
        "case_submission": state.get("case_study", {}).get("submission_text"),
        "overall_pct": overall,
        "complete": assignment.status == AssignmentStatus.complete,
    }


def _load_assignment():
    return select(Assignment).options(
        selectinload(Assignment.resource),
        selectinload(Assignment.program),
        selectinload(Assignment.rfp),
        selectinload(Assignment.hil_entries),
    )


def _approved_hil_program(assignment: Assignment) -> dict | None:
    """The most recent approved/modified HIL entry's program for this assignment."""
    entries = [
        h for h in (assignment.hil_entries or [])
        if h.status in (HilStatus.approved, HilStatus.modified)
    ]
    if not entries:
        # fall back to any entry so seeded active assignments still render
        entries = list(assignment.hil_entries or [])
    if not entries:
        return None
    entries.sort(key=lambda h: h.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return entries[0].proposed_program


def _fmt_course(a: Assignment) -> dict:
    content = _course_content(_approved_hil_program(a), a.program)
    return {
        "assignment_id": str(a.id),
        "status": a.status.value,
        "deadline": str(a.deadline),
        "assigned_date": str(a.assigned_date) if a.assigned_date else None,
        "rfp_reference": a.rfp.rfp_reference if a.rfp else None,
        "content": content,
        "progress": _progress(a, content),
    }


# ──────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────

LEARNER_VISIBLE = (AssignmentStatus.active, AssignmentStatus.at_risk, AssignmentStatus.overdue, AssignmentStatus.complete)


@router.get("/resources")
async def learners(db: AsyncSession = Depends(get_db)):
    """People who have at least one approved (learner-visible) assignment — the identity picker."""
    rows = await db.execute(
        select(Resource)
        .join(Assignment, Assignment.resource_id == Resource.id)
        .where(Assignment.status.in_(LEARNER_VISIBLE))
        .distinct()
        .order_by(Resource.full_name)
    )
    return [
        {"id": str(r.id), "resource_code": r.resource_code, "full_name": r.full_name, "role": r.role}
        for r in rows.scalars().all()
    ]


@router.get("/{resource_id}/courses")
async def my_courses(resource_id: UUID, db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        _load_assignment()
        .where(Assignment.resource_id == resource_id, Assignment.status.in_(LEARNER_VISIBLE))
        .order_by(desc(Assignment.created_at))
    )
    return [_fmt_course(a) for a in rows.scalars().all()]


async def _get_assignment(db: AsyncSession, assignment_id: UUID) -> Assignment:
    row = await db.execute(_load_assignment().where(Assignment.id == assignment_id))
    a = row.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if a.status not in LEARNER_VISIBLE:
        raise HTTPException(status_code=409, detail="This assignment has not been approved yet.")
    return a


def _touch_state(a: Assignment) -> dict:
    state = dict(a.learning_state or {})
    a.learning_state = state
    flag_modified(a, "learning_state")
    return state


async def _roll_up(a: Assignment, content: dict, db: AsyncSession):
    """Recompute component statuses, overall progress, and completion."""
    prog = _progress(a, content)

    total = len(content["modules"])
    done = len(prog["modules_done"])
    if total and done >= total:
        a.content_status = ComponentStatus.complete
    elif done > 0:
        a.content_status = ComponentStatus.in_progress

    if prog["test_passed"]:
        a.test_status = ComponentStatus.complete
    elif (a.test_attempts or 0) > 0:
        a.test_status = ComponentStatus.failed

    if prog["case_submitted"]:
        a.case_study_status = ComponentStatus.complete

    a.overall_progress = prog["overall_pct"]

    # BR-005: all components verified complete → assignment complete + cert pending
    test_ok = a.test_status == ComponentStatus.complete or not prog["test_available"]
    if (
        a.status != AssignmentStatus.complete
        and a.content_status == ComponentStatus.complete
        and test_ok
        and a.case_study_status == ComponentStatus.complete
    ):
        a.status = AssignmentStatus.complete
        a.overall_progress = 100
        cert = Certification(
            assignment_id=a.id,
            resource_id=a.resource_id,
            program_id=a.program_id,
            cert_name=content["cert_name"] or content["program_name"],
            status=CertStatus.pending,
        )
        db.add(cert)
        db.add(AuditLog(
            rfp_ref=a.rfp.rfp_reference if a.rfp else None,
            resource_id=str(a.resource_id),
            action_type="completion_verified",
            entity_type="assignment",
            entity_id=a.id,
            actor="system",
            level=LogLevel.action,
            message=(
                f"All components complete for {a.resource.full_name} — "
                f"'{content['program_name']}' finished; certification pending verification"
            ),
        ))


@router.post("/assignments/{assignment_id}/module-complete")
async def complete_module(assignment_id: UUID, payload: dict, db: AsyncSession = Depends(get_db)):
    a = await _get_assignment(db, assignment_id)
    content = _course_content(_approved_hil_program(a), a.program)

    index = int(payload.get("module_index", -1))
    if not (0 <= index < len(content["modules"])):
        raise HTTPException(status_code=400, detail="Invalid module index")

    state = _touch_state(a)
    done = set(state.get("modules_done", []))
    if bool(payload.get("done", True)):
        done.add(index)
    else:
        done.discard(index)
    state["modules_done"] = sorted(done)

    await _roll_up(a, content, db)
    await db.commit()
    await db.refresh(a)
    return _fmt_course(a)


@router.post("/assignments/{assignment_id}/test-submit")
async def submit_test(assignment_id: UUID, payload: TestSubmission, db: AsyncSession = Depends(get_db)):
    a = await _get_assignment(db, assignment_id)
    content = _course_content(_approved_hil_program(a), a.program)

    questions = content["test"]["questions"]
    if not questions:
        raise HTTPException(status_code=409, detail="No test has been published for this program yet.")
    if len(payload.answers) != len(questions):
        raise HTTPException(status_code=400, detail=f"Expected {len(questions)} answers.")

    results = []
    correct = 0
    for i, q in enumerate(questions):
        is_right = payload.answers[i] == q.get("correct_index", 0)
        correct += is_right
        results.append({
            "question_index": i,
            "correct": is_right,
            "correct_index": q.get("correct_index", 0),
        })

    score = round(correct / len(questions) * 100, 2)
    passed = score >= content["test"]["pass_pct"]

    a.test_attempts = (a.test_attempts or 0) + 1
    a.test_score = score
    state = _touch_state(a)
    state["test"] = {
        "answers": payload.answers,
        "score": score,
        "passed": passed or state.get("test", {}).get("passed", False),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    db.add(AuditLog(
        resource_id=str(a.resource_id),
        action_type="test_submitted",
        entity_type="assignment",
        entity_id=a.id,
        actor=a.resource.resource_code if a.resource else "learner",
        level=LogLevel.info,
        message=(
            f"Online test attempt {a.test_attempts} for {a.resource.full_name}: "
            f"{score}% ({'pass' if passed else 'fail — retake available'})"
        ),
    ))

    await _roll_up(a, content, db)
    await db.commit()
    await db.refresh(a)
    return {"score": score, "passed": passed, "pass_pct": content["test"]["pass_pct"], "results": results, "course": _fmt_course(a)}


@router.post("/assignments/{assignment_id}/case-submit")
async def submit_case_study(assignment_id: UUID, payload: CaseSubmission, db: AsyncSession = Depends(get_db)):
    a = await _get_assignment(db, assignment_id)
    content = _course_content(_approved_hil_program(a), a.program)

    text = payload.submission_text.strip()
    if len(text) < 30:
        raise HTTPException(status_code=400, detail="Describe your work in at least a few sentences (30+ characters).")

    state = _touch_state(a)
    state["case_study"] = {
        "submission_text": text,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }

    db.add(AuditLog(
        resource_id=str(a.resource_id),
        action_type="case_study_submitted",
        entity_type="assignment",
        entity_id=a.id,
        actor=a.resource.resource_code if a.resource else "learner",
        level=LogLevel.info,
        message=f"Case study submitted for {a.resource.full_name} — '{content['case_study']['title']}'",
    ))

    await _roll_up(a, content, db)
    await db.commit()
    await db.refresh(a)
    return _fmt_course(a)
