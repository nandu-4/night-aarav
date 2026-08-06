"""Training Manager + Administrator endpoints. Talent Lead is read-only and
uses /analytics; final authority stays in the Talent Nurturing Agent's HIL."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import hash_password, require_roles
from config import settings
from db import notifications, submissions, users
from services.portal import course_hours, readiness, seed_users
from services.tn import tn

router = APIRouter(prefix="/manage", tags=["Manage"])


# ─────────────── Training Manager ───────────────

@router.get("/employees")
async def employees_overview(user: dict = Depends(require_roles("manager", "lead", "admin"))):
    """Every employee with live progress pulled from TN."""
    out = []
    async for u in users.find({"role": "employee"}).sort("name", 1):
        row = {"email": u["email"], "name": u["name"], "department": u.get("department"),
               "resource_code": u.get("resource_code"), "programs": [], "readiness": 0,
               "hours": 0, "overdue": 0}
        try:
            courses = await tn.courses(u["resource_id"]) if u.get("resource_id") else []
        except HTTPException:
            courses = []
        from datetime import date
        for c in courses:
            row["programs"].append({
                "program": c["content"]["program_name"], "pct": c["progress"]["overall_pct"],
                "status": c["status"], "deadline": c["deadline"],
                "test_passed": c["progress"]["test_passed"],
                "case_submitted": c["progress"]["case_submitted"],
            })
            row["hours"] += course_hours(c)[0]
            if date.fromisoformat(c["deadline"]) < date.today() and not c["progress"]["complete"]:
                row["overdue"] += 1
        row["hours"] = round(row["hours"], 1)
        row["readiness"] = readiness(courses, 0)
        out.append(row)
    return out


@router.get("/submissions")
async def list_submissions(user: dict = Depends(require_roles("manager", "lead", "admin"))):
    rows = await submissions.find().sort("ts", -1).to_list(100)
    for r in rows:
        r["_id"] = str(r["_id"]); r["ts"] = r["ts"].isoformat()
    return rows


class ReviewBody(BaseModel):
    submission_id: str
    verdict: str  # "approved" | "needs_work"
    comment: str = ""


@router.post("/submissions/review")
async def review_submission(payload: ReviewBody, user: dict = Depends(require_roles("manager", "admin"))):
    from bson import ObjectId
    sub = await submissions.find_one({"_id": ObjectId(payload.submission_id)})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    review = {"by": user["name"], "verdict": payload.verdict,
              "comment": payload.comment, "ts": datetime.now(timezone.utc).isoformat()}
    await submissions.update_one({"_id": sub["_id"]}, {"$set": {"mentor_review": review}})
    await notifications.insert_one({
        "email": sub["email"], "ts": datetime.now(timezone.utc), "kind": "project",
        "title": f"Mentor review: {payload.verdict.replace('_', ' ')}",
        "body": f"{sub['program']} — {user['name']}: {payload.comment or 'reviewed your project submission.'}",
        "read_by": [],
    })
    await tn.audit(
        message=f"Mentor review by {user['name']} on {sub['name']}'s project for '{sub['program']}': "
                f"{payload.verdict}. {payload.comment}",
        action_type="skillforge_mentor_review", actor=user["email"],
    )
    return {"ok": True, "mentor_review": review}


# ─────────────── Administrator ───────────────

@router.get("/users")
async def list_users(user: dict = Depends(require_roles("admin"))):
    rows = await users.find().sort("role", 1).to_list(300)
    return [{"email": u["email"], "name": u["name"], "role": u["role"],
             "resource_code": u.get("resource_code"), "department": u.get("department")} for u in rows]


class ResetBody(BaseModel):
    email: str


@router.post("/users/reset-password")
async def reset_password(payload: ResetBody, user: dict = Depends(require_roles("admin"))):
    r = await users.update_one({"email": payload.email},
                               {"$set": {"pw_hash": hash_password(settings.default_password)}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True, "default_password": settings.default_password}


@router.post("/sync-employees")
async def sync_employees(user: dict = Depends(require_roles("admin", "manager"))):
    """Re-pull the roster from TN — new approved learners get accounts."""
    n = await seed_users()
    return {"synced": n}
