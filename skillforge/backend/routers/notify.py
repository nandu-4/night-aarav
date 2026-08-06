from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from auth import current_user, require_roles
from db import announcements, notifications

router = APIRouter(tags=["Notifications"])


@router.get("/notifications")
async def list_notifications(user: dict = Depends(current_user)):
    """Personal + broadcast, newest first, with read flags for this user."""
    rows = await notifications.find(
        {"$or": [{"email": user["email"]}, {"email": None}]}
    ).sort("ts", -1).to_list(30)
    return [{
        "id": str(r["_id"]), "ts": r["ts"].isoformat(), "kind": r["kind"],
        "title": r["title"], "body": r["body"],
        "read": user["email"] in r.get("read_by", []),
    } for r in rows]


@router.post("/notifications/read-all")
async def read_all(user: dict = Depends(current_user)):
    await notifications.update_many(
        {"$or": [{"email": user["email"]}, {"email": None}]},
        {"$addToSet": {"read_by": user["email"]}},
    )
    return {"ok": True}


class AnnouncementBody(BaseModel):
    title: str
    body: str


@router.get("/announcements")
async def list_announcements(user: dict = Depends(current_user)):
    rows = await announcements.find().sort("ts", -1).to_list(20)
    for r in rows:
        r["_id"] = str(r["_id"]); r["ts"] = r["ts"].isoformat()
    return rows


@router.post("/announcements")
async def create_announcement(payload: AnnouncementBody,
                              user: dict = Depends(require_roles("manager", "admin"))):
    now = datetime.now(timezone.utc)
    await announcements.insert_one({"ts": now, "author": user["name"],
                                    "title": payload.title, "body": payload.body})
    await notifications.insert_one({  # broadcast
        "email": None, "ts": now, "kind": "announcement",
        "title": payload.title, "body": payload.body, "read_by": [],
    })
    return {"ok": True}
