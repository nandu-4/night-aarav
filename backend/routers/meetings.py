"""
Meeting mode — Avathar joins a Microsoft Teams / Google Meet / Zoom call
via agentcall.dev and showcases the application.

Thin adapter over AgentCall's REST API using `webpage-av-screenshare` mode:
  * camera feed      = /avathar-cam  (the 3D Avaturn avatar, fullscreen)
  * screenshare feed = /             (the actual application desktop)
So participants see the avatar as a person in the grid AND the app being
presented — while AgentCall's voice loop lets it talk.

Requires two things in backend/.env before it can run:
    AGENTCALL_API_KEY=ak_ac_...     (from agentcall.dev — paid credits)
    AVATHAR_PUBLIC_URL=https://...  (public tunnel to http://localhost:5180,
                                     e.g. `ngrok http 5180` — base URL only,
                                     the /avathar-cam and / paths are derived)

Without a key every endpoint returns a clear 503 — the rest of the app is
unaffected. Same pattern as the Gemini key for /intake/upload.
"""

import asyncio
import json
import re
from datetime import datetime, timezone
from uuid import UUID

import httpx
import websockets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import AsyncSessionLocal, get_db
from models import Meeting
from routers.avathar import CommandRequest, ExecuteRequest, _snapshot, command, execute

router = APIRouter(prefix="/meetings", tags=["Meetings"])

AGENTCALL_BASE = "https://api.agentcall.dev/v1"


# ─────────────────────────────────────────────
# Present-state — what the shared app screen should show.
# The presentation page (/?present=1, the bot's screenshare) polls this and
# navigates the real app accordingly. The voice bridge writes to it.
# ─────────────────────────────────────────────

_present = {"seq": 0, "screen": None, "filter": None, "learner": None}


def _present_set(screen=None, filter=None, learner=None):
    _present["seq"] += 1
    _present["screen"] = screen
    _present["filter"] = filter
    _present["learner"] = learner


@router.get("/present-state")
async def present_state():
    return _present


class PresentSetRequest(BaseModel):
    screen: str | None = None
    filter: str | None = None


@router.post("/present-state")
async def present_state_set(payload: PresentSetRequest):
    """Manual override — drive the shared screen by hand (also used in tests)."""
    _present_set(screen=payload.screen, filter=payload.filter)
    return _present


# ─────────────────────────────────────────────
# The in-meeting guided tour (spoken via the bot, screens via present-state)
# ─────────────────────────────────────────────

MEETING_TOUR = [
    ("analytics", "This is the Analytics Dashboard — live metrics for the whole talent program, straight from the database."),
    ("tracker", "The Assignment Tracker — every resource in training, their progress and deadlines. I can filter it by status on request."),
    ("escalations", "The Escalation Panel — when someone falls behind, it lands here for the Talent Lead to resolve."),
    ("hil", "The HIL Approval Queue — the human-in-the-loop gate. Nothing the AI recommends is assigned until a human approves it here."),
    ("certs", "The Certification Registry — completed programs produce certifications pending verification."),
    ("audit", "The Audit Log — every action, human or AI, is recorded."),
    ("studio", "The Program Studio — where skill-gap documents are uploaded and AI drafts personalised programs with modules, tests and sandbox tasks."),
    ("learn", "And the learning platform — approved programs appear as courses with modules, a graded test and a case study."),
]


class StartMeetingRequest(BaseModel):
    meet_url: str  # Teams, Google Meet, or Zoom link — AgentCall handles all three
    bot_name: str = "Aarav"
    started_by: str = "talent_lead"


def _require_key() -> dict:
    if not settings.agentcall_api_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Meet mode needs an AgentCall API key. Add AGENTCALL_API_KEY=ak_ac_... "
                "to backend/.env (get one at agentcall.dev), plus AVATHAR_PUBLIC_URL "
                "pointing at a public tunnel to the /avathar page, then restart."
            ),
        )
    return {"Authorization": f"Bearer {settings.agentcall_api_key}"}


def _fmt(m: Meeting) -> dict:
    return {
        "id": str(m.id),
        "call_id": m.call_id,
        "meet_url": m.meet_url,
        "bot_name": m.bot_name,
        "status": m.status,
        "started_by": m.started_by,
        "created_at": str(m.created_at),
        "ended_at": str(m.ended_at) if m.ended_at else None,
    }


@router.get("")
async def list_meetings(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(select(Meeting).order_by(desc(Meeting.created_at)))
    return [_fmt(m) for m in rows.scalars().all()]


@router.post("/start")
async def start_meeting(payload: StartMeetingRequest, db: AsyncSession = Depends(get_db)):
    headers = _require_key()
    if not settings.avathar_public_url:
        raise HTTPException(
            status_code=503,
            detail=(
                "AVATHAR_PUBLIC_URL is not set. Expose the app publicly "
                "(e.g. `ngrok http 5180`, then set AVATHAR_PUBLIC_URL=https://xxx.ngrok.app) "
                "so the meeting bot can render the avatar camera and share the app."
            ),
        )

    base = settings.avathar_public_url.rstrip("/")

    # Pre-flight: the bot can only render the avatar cam / screenshare if the
    # tunnel is actually up. Quick-tunnel URLs die on every restart — catch
    # that here with a clear message instead of a confusing provider error.
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            probe = await client.get(base)
        if probe.status_code >= 500:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"The public tunnel {base} answered with HTTP {probe.status_code}. "
                    "Restart your tunnel (e.g. `cloudflared tunnel --url http://localhost:5180`) "
                    "and update AVATHAR_PUBLIC_URL in backend/.env, then restart the backend."
                ),
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=503,
            detail=(
                f"The public tunnel {base} is unreachable — it has probably expired. "
                "Start a fresh one (e.g. `cloudflared tunnel --url http://localhost:5180`), "
                "put the new URL in AVATHAR_PUBLIC_URL in backend/.env, and restart the backend."
            ),
        )

    snapshot = await _snapshot(db)
    context = (
        f"You are {payload.bot_name}, the AI assistant inside the 'Talent Nurturing' application, "
        "presenting it in this meeting. You can SHOW screens: when someone asks to see something "
        "or for a tour, briefly confirm — the app on your screenshare navigates automatically. "
        "Approvals always need the human to say 'confirm' before anything is executed. "
        "Answer questions ONLY from this live data:\n" + snapshot
    )[:3900]

    body = {
        "meet_url": payload.meet_url,             # Teams / Meet / Zoom
        "bot_name": payload.bot_name,
        "mode": "webpage-av-screenshare",         # avatar page = camera, app = screenshare
        "webpage_url": f"{base}/aarav-cam",
        "screenshare_url": f"{base}/?present=1",
        "transcription": True,
        "voice_strategy": "collaborative",        # GetSun voice AI answers when addressed
        "collaborative": {
            "trigger_words": [payload.bot_name.lower(), "aarav", "arav", "aarov"],
            "barge_in_prevention": True,
            "interruption_use_full_text": True,
            "context": context,
        },
        "disclosure": {"enabled": True, "message": f"{payload.bot_name} (AI assistant) has joined and is transcribing."},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{AGENTCALL_BASE}/calls", json=body, headers=headers)
    if resp.status_code == 402:
        raise HTTPException(
            status_code=502,
            detail=(
                "Your AgentCall account is out of credits, so the bot cannot join calls. "
                "Top up at app.agentcall.dev/add-credits. Free alternative: join the meeting "
                "yourself, share your screen with computer sound, and ask Aarav for a tour."
            ),
        )
    if resp.status_code in (401, 403):
        raise HTTPException(
            status_code=502,
            detail="AgentCall rejected the API key — check AGENTCALL_API_KEY in backend/.env.",
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"AgentCall refused the call ({resp.status_code}): {resp.text[:300]}")
    data = resp.json()

    meeting = Meeting(
        call_id=data.get("call_id"),
        context_type="avathar_presentation",
        meet_url=payload.meet_url,
        bot_name=payload.bot_name,
        status=data.get("status", "bot_joining"),
        started_by=payload.started_by,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)

    # reset the shared screen and launch the voice/action bridge
    _present_set(screen="home")
    if data.get("ws_url"):
        asyncio.create_task(_bridge(data["call_id"], data["ws_url"]))

    return {**_fmt(meeting), "ws_url": data.get("ws_url"), "tunnel_url": data.get("tunnel_url")}


# ─────────────────────────────────────────────
# The voice/action bridge.
#
# GetSun (AgentCall's collaborative voice AI) handles the *conversation* in
# the meeting using the context we supplied. This bridge handles *actions*:
# it listens to the meeting transcript, and when someone addresses Aarav with
# an app command (tour / open a screen / filter / approve), it runs the same
# brain as the in-app assistant, drives the shared screen via present-state,
# and injects short confirmations into the bot's voice.
#
# HIL guardrail carries into meetings: approve/reject is read back aloud and
# only executes after someone says "confirm".
# ─────────────────────────────────────────────

AARAV_RE = re.compile(r"\b(a+ra+v\w*|avatar|avathar)\b", re.IGNORECASE)
CONFIRM_RE = re.compile(r"\b(confirm|yes|go ahead|proceed)\b", re.IGNORECASE)
CANCEL_RE = re.compile(r"\b(cancel|no|stop|never mind)\b", re.IGNORECASE)
TOUR_RE = re.compile(r"\btour\b|walk ?through|show (us|me|everyone)? ?everything|present the app", re.IGNORECASE)


async def _bridge(call_id: str, ws_url: str):
    uri = f"{ws_url}?api_key={settings.agentcall_api_key}" if "?" not in ws_url else f"{ws_url}&api_key={settings.agentcall_api_key}"
    pending_action: dict | None = None
    tour_task: asyncio.Task | None = None
    print(f"[MEETING] bridge connecting for {call_id}")

    async def say(ws, text, verbatim=False, priority="normal"):
        await ws.send(json.dumps({
            "type": "inject.verbatim" if verbatim else "inject.natural",
            "text": text, "priority": priority,
        }))

    async def run_tour(ws):
        for screen, narration in MEETING_TOUR:
            _present_set(screen=screen)
            await say(ws, narration, verbatim=True)
            # rough pacing: reading time + a beat on each screen
            await asyncio.sleep(3 + len(narration) * 0.055)
        _present_set(screen="analytics")
        await say(ws, "That's the whole application. Ask me to open anything, or ask about anyone's progress.", verbatim=True)

    try:
        async with websockets.connect(uri, ping_interval=20, ping_timeout=20) as ws:
            print(f"[MEETING] bridge connected for {call_id}")
            async for raw in ws:
                try:
                    msg = json.loads(raw)
                except (TypeError, ValueError):
                    continue
                event = msg.get("event") or msg.get("type")

                if event == "call.ended":
                    print(f"[MEETING] call ended: {msg.get('reason')}")
                    async with AsyncSessionLocal() as db:
                        row = await db.execute(select(Meeting).where(Meeting.call_id == call_id))
                        m = row.scalar_one_or_none()
                        if m:
                            m.status = "ended"
                            m.ended_at = datetime.now(timezone.utc)
                            m.duration_minutes = msg.get("duration_minutes")
                            await db.commit()
                    break

                if event != "transcript.final":
                    continue
                text = (msg.get("text") or "").strip()
                speaker = (msg.get("speaker") or {}).get("name", "someone")
                if not text:
                    continue

                # pending approval? confirm / cancel wins over everything
                if pending_action:
                    if CONFIRM_RE.search(text):
                        action = pending_action
                        pending_action = None
                        async with AsyncSessionLocal() as db:
                            result = await execute(ExecuteRequest(
                                hil_id=UUID(action["hil_id"]), action=action["action"],
                                person=action["person"], actor=f"{speaker} (meeting voice)",
                            ), db)
                        _present_set(screen="hil")
                        await say(ws, result["speech"], verbatim=True, priority="high")
                        continue
                    if CANCEL_RE.search(text):
                        pending_action = None
                        await say(ws, "Cancelled — nothing was changed.", verbatim=True)
                        continue

                # only act when Aarav is addressed (GetSun handles pure chat)
                if not AARAV_RE.search(text):
                    continue

                if TOUR_RE.search(text):
                    if not (tour_task and not tour_task.done()):
                        tour_task = asyncio.create_task(run_tour(ws))
                    continue

                # same brain as the in-app assistant
                async with AsyncSessionLocal() as db:
                    res = await command(CommandRequest(transcript=text), db)

                if res.get("needs_confirmation") and res.get("pending_action"):
                    pending_action = res["pending_action"]
                    _present_set(screen="hil")
                    await say(ws, res["speech"], verbatim=True, priority="high")
                elif res.get("view") == "open_screen" and res.get("data", {}).get("screen"):
                    _present_set(screen=res["data"]["screen"], filter=res["data"].get("filter"))
                    await say(ws, res["speech"] or "Here you go.")
                elif res.get("view") == "learn" and res.get("data", {}).get("person"):
                    _present_set(screen="learn", learner=res["data"]["person"])
                    await say(ws, res["speech"])
                elif res.get("view") == "start_tour":
                    if not (tour_task and not tour_task.done()):
                        tour_task = asyncio.create_task(run_tour(ws))
                # pure conversation → leave it to GetSun (it heard the same words)
    except Exception as e:
        print(f"[MEETING] bridge closed for {call_id}: {type(e).__name__}: {str(e)[:200]}")
    finally:
        if tour_task and not tour_task.done():
            tour_task.cancel()


@router.delete("/{meeting_id}")
async def end_meeting(meeting_id: UUID, db: AsyncSession = Depends(get_db)):
    headers = _require_key()
    row = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = row.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if meeting.call_id:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.delete(f"{AGENTCALL_BASE}/calls/{meeting.call_id}", headers=headers)
        if resp.status_code not in (200, 409):  # 409 = already ended
            raise HTTPException(status_code=502, detail=f"AgentCall error ({resp.status_code}): {resp.text[:300]}")

    meeting.status = "ended"
    meeting.ended_at = datetime.now(timezone.utc)
    await db.commit()
    return _fmt(meeting)
