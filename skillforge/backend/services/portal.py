"""Shared portal logic: user seeding from TN, readiness math, streaks, hours."""

from datetime import datetime, timedelta, timezone

from auth import hash_password
from config import settings
from db import activity, certificates, users
from services.tn import tn

DEMO_STAFF = [
    {"email": "admin@skillforge.dev", "name": "Platform Admin", "role": "admin"},
    {"email": "manager@skillforge.dev", "name": "Training Manager", "role": "manager"},
    {"email": "lead@skillforge.dev", "name": "Talent Lead", "role": "lead"},
]


async def seed_users():
    """Employees mirror TN resources (same identity); plus staff accounts."""
    default_hash = hash_password(settings.default_password)
    for s in DEMO_STAFF:
        await users.update_one(
            {"email": s["email"]},
            {"$setOnInsert": {**s, "pw_hash": default_hash,
                              "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
    try:
        learners = await tn.learners()
    except Exception as e:
        print(f"[SKILLFORGE] TN not reachable during seed — employees not synced: {e}")
        return 0
    n = 0
    for l in learners:
        email = f"{l['resource_code'].lower()}@skillforge.dev"
        await users.update_one(
            {"email": email},
            {"$set": {"name": l["full_name"], "resource_id": l["id"],
                      "resource_code": l["resource_code"], "department": l.get("role") or "General"},
             "$setOnInsert": {"email": email, "role": "employee", "pw_hash": default_hash,
                              "created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        n += 1
    print(f"[SKILLFORGE] seeded {n} employee accounts from TN")
    return n


async def log_activity(email: str, type_: str, message: str, meta: dict | None = None):
    await activity.insert_one({
        "email": email, "ts": datetime.now(timezone.utc),
        "type": type_, "message": message, "meta": meta or {},
    })


async def streak_days(email: str) -> int:
    """Consecutive days (ending today or yesterday) with any activity."""
    rows = await activity.find({"email": email}).sort("ts", -1).to_list(400)
    days = sorted({r["ts"].date() for r in rows}, reverse=True)
    if not days:
        return 0
    today = datetime.now(timezone.utc).date()
    if days[0] not in (today, today - timedelta(days=1)):
        return 0
    streak = 1
    for prev, cur in zip(days, days[1:]):
        if (prev - cur).days == 1:
            streak += 1
        else:
            break
    return streak


def course_hours(course: dict) -> tuple[float, float]:
    """(hours_done, hours_total) from module completion."""
    mods = course["content"]["modules"]
    done = set(course["progress"]["modules_done"])
    total = sum(float(m.get("hours") or 2) for m in mods)
    got = sum(float(m.get("hours") or 2) for i, m in enumerate(mods) if i in done)
    return got, total


def readiness(courses: list[dict], certs_earned: int) -> int:
    """0-100. Explainable: 60% progress, 25% assessments, 15% certifications.
    Display-only — deployment eligibility is decided in TN by the Talent Lead."""
    if not courses:
        return 0
    avg_prog = sum(c["progress"]["overall_pct"] for c in courses) / len(courses)
    testable = [c for c in courses if c["progress"]["test_available"]]
    test_pct = (100 * sum(1 for c in testable if c["progress"]["test_passed"]) / len(testable)) if testable else avg_prog
    cert_pct = min(100, certs_earned * 50)
    return round(0.60 * avg_prog + 0.25 * test_pct + 0.15 * cert_pct)


async def certs_for(email: str) -> list[dict]:
    rows = await certificates.find({"email": email}).sort("completed_at", -1).to_list(50)
    for r in rows:
        r["_id"] = str(r["_id"])
    return rows
