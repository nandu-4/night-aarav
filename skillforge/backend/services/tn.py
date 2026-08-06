"""
Talent Nurturing Agent client — SkillForge's single integration point.

Design rule: TN is the SOURCE OF TRUTH. SkillForge never grades a quiz,
never flips a completion, never touches deployment. Every learning action is
forwarded to TN's own endpoints (the same ones its internal UI uses), so TN
keeps computing scores, rolling up completion (BR-005), creating
certification records, and enforcing the HIL gate. SkillForge reads results
back and layers portal features (streaks, notes, certificates, analytics
views) on top.
"""

import httpx
from fastapi import HTTPException

from config import settings


class TNClient:
    def __init__(self):
        self.base = settings.tn_base_url.rstrip("/")

    async def _get(self, path: str):
        try:
            async with httpx.AsyncClient(timeout=25) as c:
                r = await c.get(self.base + path)
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Talent Nurturing Agent unreachable: {e}")
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"TN {path} → {r.status_code}: {r.text[:200]}")
        return r.json()

    async def _post(self, path: str, body: dict):
        try:
            async with httpx.AsyncClient(timeout=25) as c:
                r = await c.post(self.base + path, json=body)
        except httpx.HTTPError as e:
            raise HTTPException(status_code=503, detail=f"Talent Nurturing Agent unreachable: {e}")
        if r.status_code >= 400:
            detail = r.json().get("detail", r.text[:200]) if r.headers.get("content-type", "").startswith("application/json") else r.text[:200]
            raise HTTPException(status_code=r.status_code, detail=detail)
        return r.json()

    # ── reads (TN → SkillForge) ──────────────────────────
    async def learners(self):
        return await self._get("/learning/resources")

    async def courses(self, resource_id: str):
        return await self._get(f"/learning/{resource_id}/courses")

    async def catalogue(self):
        return await self._get("/programs/catalogue")

    async def certifications(self):
        return await self._get("/certifications")

    async def assignments(self):
        return await self._get("/assignments")

    async def metrics(self):
        return await self._get("/analytics/metrics")

    # ── writes (SkillForge → TN, same endpoints TN's own UI uses) ──
    async def module_complete(self, assignment_id: str, module_index: int, done: bool = True):
        return await self._post(f"/learning/assignments/{assignment_id}/module-complete",
                                {"module_index": module_index, "done": done})

    async def test_submit(self, assignment_id: str, answers: list[int], resource_id: str | None = None):
        return await self._post(f"/learning/assignments/{assignment_id}/test-submit",
                                {"answers": answers, "resource_id": resource_id})

    async def case_submit(self, assignment_id: str, text: str, resource_id: str | None = None):
        return await self._post(f"/learning/assignments/{assignment_id}/case-submit",
                                {"submission_text": text, "resource_id": resource_id})

    async def audit(self, message: str, action_type: str, actor: str, resource_id: str | None = None):
        """Push a SkillForge event into TN's audit trail (best-effort)."""
        try:
            return await self._post("/audit-logs", {
                "message": message, "action_type": action_type,
                "actor": actor, "resource_id": resource_id, "level": "info",
            })
        except HTTPException:
            return None  # audit echo must never break a learning action


tn = TNClient()
