"""Certificates — issued by SkillForge when TN marks a program complete.

The verification ID + HMAC signature make each certificate independently
checkable at GET /certs/verify/{id} (no login). TN is notified through its
audit trail; the authoritative certification *record* (pending → verified)
still lives in TN and is decided by the Talent Lead.
"""

import hashlib
import hmac
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from auth import current_user
from config import settings
from db import certificates, notifications
from services.portal import certs_for
from services.tn import tn

router = APIRouter(prefix="/certs", tags=["Certificates"])


def _sign(verify_id: str, email: str, program: str, date: str) -> str:
    msg = f"{verify_id}|{email}|{program}|{date}".encode()
    return hmac.new(settings.jwt_secret.encode(), msg, hashlib.sha256).hexdigest()[:32]


async def maybe_issue_certificate(user: dict, course: dict) -> dict | None:
    """Idempotent: issues once per (user, assignment) when TN says complete."""
    if not course["progress"]["complete"]:
        return None
    existing = await certificates.find_one({"email": user["email"], "assignment_id": course["assignment_id"]})
    if existing:
        return None
    verify_id = "SF-" + os.urandom(4).hex().upper()
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    program = course["content"]["program_name"]
    cert = {
        "verify_id": verify_id,
        "email": user["email"],
        "name": user["name"],
        "assignment_id": course["assignment_id"],
        "program": program,
        "cert_name": course["content"]["cert_name"] or program,
        "completed_at": date,
        "signature": _sign(verify_id, user["email"], program, date),
    }
    await certificates.insert_one(cert)
    await notifications.insert_one({
        "email": user["email"], "ts": datetime.now(timezone.utc), "kind": "certificate",
        "title": "Certificate issued 🎓",
        "body": f"Your certificate for {program} is ready — verification ID {verify_id}.",
        "read_by": [],
    })
    await tn.audit(
        message=f"SkillForge issued certificate {verify_id} to {user['name']} for '{program}' "
                f"(digital signature attached). TN certification record remains pending Talent Lead verification.",
        action_type="skillforge_certificate_issued",
        actor="skillforge",
        resource_id=user.get("resource_code"),
    )
    cert.pop("_id", None)
    return cert


@router.get("/mine")
async def my_certs(user: dict = Depends(current_user)):
    return await certs_for(user["email"])


@router.get("/verify/{verify_id}")
async def verify(verify_id: str):
    """Public verification — no auth, like a real credential check page."""
    cert = await certificates.find_one({"verify_id": verify_id.upper()})
    if not cert:
        raise HTTPException(status_code=404, detail="No certificate with that verification ID")
    expected = _sign(cert["verify_id"], cert["email"], cert["program"], cert["completed_at"])
    return {
        "valid": hmac.compare_digest(expected, cert["signature"]),
        "verify_id": cert["verify_id"], "name": cert["name"], "program": cert["program"],
        "cert_name": cert["cert_name"], "completed_at": cert["completed_at"],
        "signature": cert["signature"],
    }
