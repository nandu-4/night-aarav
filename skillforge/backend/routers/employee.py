"""
Employee-facing API. Every learning action is forwarded to the Talent
Nurturing Agent (grading, roll-up, certification records happen THERE);
SkillForge layers the portal experience on top and enforces the 3-stage
order: Content → Assessment → Project.
"""

import os
import re
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from auth import current_user
from db import activity, announcements, bookmarks, certificates, notes, notifications, submissions
from routers.certs import maybe_issue_certificate
from services.portal import certs_for, course_hours, log_activity, readiness, streak_days
from services.tn import tn

router = APIRouter(prefix="/employee", tags=["Employee"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


def _need_resource(user: dict) -> str:
    rid = user.get("resource_id")
    if not rid:
        raise HTTPException(status_code=400, detail="This account is not linked to an employee record")
    return rid


def _stage_status(course: dict, submission: dict | None) -> dict:
    """The 3-stage journey, derived from TN's progress + our submission record."""
    p = course["progress"]
    mods_total = len(course["content"]["modules"])
    content_done = mods_total > 0 and len(p["modules_done"]) >= mods_total
    test_available = p["test_available"]
    assessment_done = p["test_passed"] or not test_available
    project_done = p["case_submitted"]
    if not content_done:
        current = 1
    elif not assessment_done:
        current = 2
    elif not project_done:
        current = 3
    else:
        current = 4  # all stages finished
    return {
        "content_done": content_done,
        "assessment_done": assessment_done,
        "assessment_applicable": test_available,
        "project_done": project_done,
        "mentor_review": (submission or {}).get("mentor_review"),
        "current_stage": current,
        "complete": p["complete"],
    }


async def _course_of(user: dict, assignment_id: str) -> dict:
    courses = await tn.courses(_need_resource(user))
    for c in courses:
        if c["assignment_id"] == assignment_id:
            return c
    raise HTTPException(status_code=404, detail="That program is not assigned to you")


async def _decorate(user: dict, course: dict) -> dict:
    sub = await submissions.find_one({"email": user["email"], "assignment_id": course["assignment_id"]},
                                     sort=[("ts", -1)])
    if sub:
        sub["_id"] = str(sub["_id"])
    my_notes = await notes.find({"email": user["email"], "assignment_id": course["assignment_id"]}).to_list(100)
    my_marks = await bookmarks.find({"email": user["email"], "assignment_id": course["assignment_id"]}).to_list(100)
    quiz_history = await activity.find(
        {"email": user["email"], "type": "quiz", "meta.assignment_id": course["assignment_id"]}
    ).sort("ts", -1).to_list(20)
    hours_done, hours_total = course_hours(course)
    return {
        **course,
        "stages": _stage_status(course, sub),
        "submission": sub,
        "notes": {str(n["module_index"]): n["text"] for n in my_notes},
        "bookmarks": sorted(b["module_index"] for b in my_marks),
        "quiz_history": [{"ts": q["ts"].isoformat(), "score": q["meta"].get("score"),
                          "passed": q["meta"].get("passed")} for q in quiz_history],
        "hours_done": round(hours_done, 1),
        "hours_total": round(hours_total, 1),
    }


# ─────────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────────

@router.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    courses = await tn.courses(_need_resource(user))
    certs = await certs_for(user["email"])
    for c in courses:  # a completion may have happened elsewhere (TN UI) — catch up
        issued = await maybe_issue_certificate(user, c)
        if issued:
            certs.insert(0, issued)

    today = date.today()
    deadlines = sorted(
        ({"assignment_id": c["assignment_id"], "program": c["content"]["program_name"],
          "deadline": c["deadline"],
          "days_left": (date.fromisoformat(c["deadline"]) - today).days,
          "overdue": date.fromisoformat(c["deadline"]) < today and not c["progress"]["complete"]}
         for c in courses if not c["progress"]["complete"]),
        key=lambda d: d["deadline"],
    )
    hours = sum(course_hours(c)[0] for c in courses)
    recent = await activity.find({"email": user["email"]}).sort("ts", -1).to_list(8)
    anns = await announcements.find().sort("ts", -1).to_list(5)
    for r in recent:
        r["_id"] = str(r["_id"]); r["ts"] = r["ts"].isoformat()
    for a in anns:
        a["_id"] = str(a["_id"]); a["ts"] = a["ts"].isoformat()

    assigned = [{"assignment_id": c["assignment_id"], "program": c["content"]["program_name"],
                 "cert": c["content"]["cert_name"], "pct": c["progress"]["overall_pct"],
                 "status": c["status"], "deadline": c["deadline"]} for c in courses]
    assigned_names = {c["content"]["program_name"] for c in courses}
    try:
        catalogue = await tn.catalogue()
    except HTTPException:
        catalogue = []
    recommended = [{"program_name": p["program_name"], "cert_name": p.get("cert_name"),
                    "skill_category": p.get("skill_category"), "hours": p.get("total_duration_h")}
                   for p in catalogue if p["program_name"] not in assigned_names][:4]

    return {
        "welcome": {"name": user["name"], "department": user.get("department"),
                    "resource_code": user.get("resource_code")},
        "readiness": readiness(courses, len(certs)),
        "readiness_note": "Deployment eligibility is decided by the Talent Lead in the Talent Nurturing Agent.",
        "programs": assigned,
        "recommended": recommended,
        "deadlines": deadlines[:5],
        "streak": await streak_days(user["email"]),
        "hours_completed": round(hours, 1),
        "certificates_earned": len(certs),
        "recent_activity": recent,
        "announcements": anns,
    }


# ─────────────────────────────────────────────
# Courses & the 3 stages
# ─────────────────────────────────────────────

@router.get("/courses")
async def my_courses(user: dict = Depends(current_user)):
    courses = await tn.courses(_need_resource(user))
    return [await _decorate(user, c) for c in courses]


@router.get("/courses/{assignment_id}")
async def course_detail(assignment_id: str, user: dict = Depends(current_user)):
    course = await _course_of(user, assignment_id)
    return await _decorate(user, course)


class ModuleDone(BaseModel):
    module_index: int
    done: bool = True


@router.post("/courses/{assignment_id}/module-complete")
async def module_complete(assignment_id: str, payload: ModuleDone, user: dict = Depends(current_user)):
    updated = await tn.module_complete(assignment_id, payload.module_index, payload.done)
    if payload.done:
        title = updated["content"]["modules"][payload.module_index]["title"] \
            if payload.module_index < len(updated["content"]["modules"]) else "module"
        await log_activity(user["email"], "module", f"Completed module: {title}",
                           {"assignment_id": assignment_id, "module_index": payload.module_index})
    await maybe_issue_certificate(user, updated)
    return await _decorate(user, updated)


class QuizSubmission(BaseModel):
    answers: list[int]


@router.post("/courses/{assignment_id}/quiz")
async def quiz_submit(assignment_id: str, payload: QuizSubmission, user: dict = Depends(current_user)):
    course = await _course_of(user, assignment_id)
    stages = _stage_status(course, None)
    if not stages["content_done"]:
        raise HTTPException(status_code=409, detail="Finish Stage 1 (all learning modules) before the assessment.")
    result = await tn.test_submit(assignment_id, payload.answers, user.get("resource_code"))
    await log_activity(user["email"], "quiz",
                       f"Assessment attempt: {result['score']}% ({'passed' if result['passed'] else 'not passed'})",
                       {"assignment_id": assignment_id, "score": result["score"], "passed": result["passed"]})
    await notifications.insert_one({
        "email": user["email"], "ts": datetime.now(timezone.utc), "kind": "quiz",
        "title": "Assessment result",
        "body": f"{course['content']['program_name']}: {result['score']}% — "
                + ("passed 🎉" if result["passed"] else f"pass mark is {result['pass_pct']}%, you can retake it"),
        "read_by": [],
    })
    await maybe_issue_certificate(user, result["course"])
    decorated = await _decorate(user, result["course"])
    return {"score": result["score"], "passed": result["passed"], "pass_pct": result["pass_pct"],
            "results": result["results"], "course": decorated}


def _auto_review(text: str, github_url: str | None, brief: str) -> str:
    """Automated pre-review (rule-based). The human mentor review is separate."""
    points = []
    words = len(text.split())
    points.append(f"Submission length: {words} words — {'detailed' if words > 120 else 'acceptable' if words > 40 else 'brief; consider expanding'}.")
    if github_url:
        points.append("GitHub repository linked — reviewable code artifact present.")
    key_terms = [w for w in re.findall(r"[A-Za-z]{6,}", brief)][:6]
    hits = [t for t in key_terms if t.lower() in text.lower()]
    if hits:
        points.append(f"Addresses brief topics: {', '.join(hits[:4])}.")
    points.append("Queued for mentor review.")
    return " ".join(points)


@router.post("/courses/{assignment_id}/project")
async def project_submit(
    assignment_id: str,
    text: str = Form(...),
    github_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(current_user),
):
    course = await _course_of(user, assignment_id)
    stages = _stage_status(course, None)
    if not stages["content_done"]:
        raise HTTPException(status_code=409, detail="Finish Stage 1 before the project.")
    if stages["assessment_applicable"] and not stages["assessment_done"]:
        raise HTTPException(status_code=409, detail="Pass Stage 2 (the assessment) before the project.")

    file_name = None
    if file and file.filename:
        safe = re.sub(r"[^A-Za-z0-9._-]", "_", file.filename)[-80:]
        file_name = f"{assignment_id[:8]}_{user.get('resource_code', 'user')}_{safe}"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        with open(os.path.join(UPLOAD_DIR, file_name), "wb") as f:
            f.write(await file.read())

    ai_review = _auto_review(text, github_url, course["content"]["case_study"]["brief"])
    await submissions.insert_one({
        "email": user["email"], "name": user["name"], "assignment_id": assignment_id,
        "program": course["content"]["program_name"], "text": text,
        "github_url": github_url, "file_name": file_name,
        "ts": datetime.now(timezone.utc), "ai_review": ai_review, "mentor_review": None,
    })

    # TN records the case-study submission and rolls up completion (BR-005)
    body = text + (f"\n\nGitHub: {github_url}" if github_url else "") + (f"\n\nAttached file: {file_name}" if file_name else "")
    updated = await tn.case_submit(assignment_id, body, user.get("resource_code"))
    await log_activity(user["email"], "project", f"Submitted project for {course['content']['program_name']}",
                       {"assignment_id": assignment_id})
    cert = await maybe_issue_certificate(user, updated)
    return {"course": await _decorate(user, updated), "ai_review": ai_review,
            "certificate": cert}


# ─────────────────────────────────────────────
# Notes & bookmarks (Stage 1 aids)
# ─────────────────────────────────────────────

class NoteBody(BaseModel):
    module_index: int
    text: str


@router.post("/courses/{assignment_id}/notes")
async def save_note(assignment_id: str, payload: NoteBody, user: dict = Depends(current_user)):
    await notes.update_one(
        {"email": user["email"], "assignment_id": assignment_id, "module_index": payload.module_index},
        {"$set": {"text": payload.text, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return {"ok": True}


class BookmarkBody(BaseModel):
    module_index: int
    on: bool


@router.post("/courses/{assignment_id}/bookmark")
async def toggle_bookmark(assignment_id: str, payload: BookmarkBody, user: dict = Depends(current_user)):
    key = {"email": user["email"], "assignment_id": assignment_id, "module_index": payload.module_index}
    if payload.on:
        await bookmarks.update_one(key, {"$set": {"created_at": datetime.now(timezone.utc)}}, upsert=True)
    else:
        await bookmarks.delete_one(key)
    return {"ok": True}


@router.get("/activity")
async def my_activity(user: dict = Depends(current_user)):
    rows = await activity.find({"email": user["email"]}).sort("ts", -1).to_list(60)
    for r in rows:
        r["_id"] = str(r["_id"]); r["ts"] = r["ts"].isoformat()
    return rows
