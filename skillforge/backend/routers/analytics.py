"""Org-wide learning analytics — computed live from TN data + portal activity.
Readable by manager, lead (read-only role) and admin; employees see the
leaderboard too."""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import current_user, require_roles
from db import activity, certificates, users
from services.portal import course_hours
from services.tn import tn

router = APIRouter(prefix="/analytics", tags=["Analytics"])


async def _employee_courses():
    """[(user, courses)] for every linked employee."""
    out = []
    async for u in users.find({"role": "employee"}):
        if not u.get("resource_id"):
            continue
        try:
            out.append((u, await tn.courses(u["resource_id"])))
        except HTTPException:
            continue
    return out


@router.get("/overview")
async def overview(user: dict = Depends(require_roles("manager", "lead", "admin"))):
    data = await _employee_courses()
    today = date.today()

    per_employee, dept, skill_gap, completion = [], defaultdict(lambda: {"sum": 0, "n": 0}), defaultdict(int), {"complete": 0, "active": 0, "overdue": 0}
    quiz_scores, hours_all = [], 0.0
    for u, courses in data:
        if not courses:
            continue
        avg = round(sum(c["progress"]["overall_pct"] for c in courses) / len(courses))
        hrs = round(sum(course_hours(c)[0] for c in courses), 1)
        hours_all += hrs
        per_employee.append({"name": u["name"], "department": u.get("department"), "avg_pct": avg,
                             "hours": hrs, "programs": len(courses)})
        d = dept[u.get("department") or "General"]
        d["sum"] += avg; d["n"] += 1
        for c in courses:
            cat = c["content"]["program_name"]
            skill_gap[cat] += 0 if c["progress"]["complete"] else 1
            if c["progress"]["complete"]:
                completion["complete"] += 1
            elif date.fromisoformat(c["deadline"]) < today:
                completion["overdue"] += 1
            else:
                completion["active"] += 1
            if c["progress"]["test_score"] is not None:
                quiz_scores.append(float(c["progress"]["test_score"]))

    projects_total = sum(1 for _, cs in data for c in cs if c["progress"]["case_submitted"])
    certs_n = await certificates.count_documents({})

    # learning velocity + heatmap from portal activity (last 8 weeks)
    since = datetime.now(timezone.utc) - timedelta(weeks=8)
    acts = await activity.find({"ts": {"$gte": since}, "type": {"$ne": "login"}}).to_list(4000)
    weekly = defaultdict(int)
    heatmap = defaultdict(int)  # (weekday, hour-bucket)
    for a in acts:
        weekly[a["ts"].strftime("%G-W%V")] += 1
        heatmap[f"{a['ts'].weekday()}-{a['ts'].hour // 4}"] += 1

    try:
        tn_metrics = await tn.metrics()
    except HTTPException:
        tn_metrics = {}

    return {
        "employee_progress": sorted(per_employee, key=lambda r: -r["avg_pct"]),
        "department_progress": [{"department": k, "avg_pct": round(v["sum"] / v["n"])}
                                for k, v in sorted(dept.items())],
        "completion": completion,
        "quiz_performance": {
            "avg": round(sum(quiz_scores) / len(quiz_scores), 1) if quiz_scores else None,
            "scores": sorted(quiz_scores),
        },
        "project_success": projects_total,
        "avg_hours": round(hours_all / max(len(per_employee), 1), 1),
        "most_requested_skills": sorted(
            ({"skill": k, "open": v} for k, v in skill_gap.items()), key=lambda r: -r["open"])[:8],
        "certificates_issued": certs_n,
        "learning_velocity": [{"week": k, "events": v} for k, v in sorted(weekly.items())],
        "heatmap": dict(heatmap),
        "tn_metrics": tn_metrics,
    }


@router.get("/leaderboard")
async def leaderboard(user: dict = Depends(current_user)):
    data = await _employee_courses()
    rows = []
    for u, courses in data:
        if not courses:
            continue
        pts = sum(c["progress"]["overall_pct"] for c in courses)
        pts += sum(120 for c in courses if c["progress"]["complete"])
        pts += sum(40 for c in courses if c["progress"]["test_passed"])
        certs_n = await certificates.count_documents({"email": u["email"]})
        rows.append({"name": u["name"], "department": u.get("department"),
                     "points": int(pts), "certs": certs_n,
                     "me": u["email"] == user["email"]})
    rows.sort(key=lambda r: -r["points"])
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows[:15]
