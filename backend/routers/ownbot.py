"""
Own-bot meeting mode — self-hosted replacement for the AgentCall integration.

POST /ownbot/start {meet_url} launches a Playwright Chrome on THIS machine that
joins the call as "Aarav": animated avatar as its camera, free Edge neural TTS
as its voice, Groq Whisper ears, and the same Aarav brain (trigger word →
command → HIL read-back → "confirm") that powers the in-app assistant and the
old AgentCall bridge. The app screenshare is the /?present=1 tab.

No API keys beyond the Groq one already in .env. No tunnel needed — everything
runs locally.
"""

import asyncio
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from models import Meeting
from routers.avathar import CommandRequest, ExecuteRequest, command, execute
from routers.meetings import (
    AARAV_RE, CANCEL_RE, CONFIRM_RE, MEETING_TOUR, TOUR_RE, _present_set,
)
from services.meetbot import MeetBot

router = APIRouter(prefix="/ownbot", tags=["Own Bot"])

_bot: MeetBot | None = None
_pending_action: dict | None = None
_tour_task: asyncio.Task | None = None


class StartRequest(BaseModel):
    meet_url: str
    bot_name: str = "Aarav"
    started_by: str = "talent_lead"


async def _run_tour():
    for screen, narration in MEETING_TOUR:
        if _bot is None:
            return
        _present_set(screen=screen)
        await _bot.speak(narration)
        await asyncio.sleep(1.0)
    _present_set(screen="analytics")
    if _bot:
        await _bot.speak("That's the whole application. Ask me to open anything, or ask about anyone's progress.")


async def _on_transcript(text: str):
    """Same decision logic as the AgentCall bridge, driving our own bot."""
    global _pending_action, _tour_task
    if _bot is None:
        return

    # pending approval? confirm / cancel wins over everything
    if _pending_action:
        if CONFIRM_RE.search(text):
            action, _pending_action = _pending_action, None
            async with AsyncSessionLocal() as db:
                result = await execute(ExecuteRequest(
                    hil_id=UUID(action["hil_id"]), action=action["action"],
                    person=action["person"], actor="meeting voice (own bot)",
                ), db)
            _present_set(screen="hil")
            await _bot.speak(result["speech"])
            return
        if CANCEL_RE.search(text):
            _pending_action = None
            await _bot.speak("Cancelled — nothing was changed.")
            return

    # only act when Aarav is addressed
    if not AARAV_RE.search(text):
        return

    if TOUR_RE.search(text):
        if not (_tour_task and not _tour_task.done()):
            _tour_task = asyncio.create_task(_run_tour())
        return

    async with AsyncSessionLocal() as db:
        res = await command(CommandRequest(transcript=text), db)

    if res.get("needs_confirmation") and res.get("pending_action"):
        _pending_action = res["pending_action"]
        _present_set(screen="hil")
        await _bot.speak(res["speech"])
    elif res.get("view") == "open_screen" and res.get("data", {}).get("screen"):
        _present_set(screen=res["data"]["screen"], filter=res["data"].get("filter"))
        await _bot.speak(res["speech"] or "Here you go.")
    elif res.get("view") == "learn" and res.get("data", {}).get("person"):
        _present_set(screen="learn", learner=res["data"]["person"])
        await _bot.speak(res["speech"])
    elif res.get("view") == "start_tour":
        if not (_tour_task and not _tour_task.done()):
            _tour_task = asyncio.create_task(_run_tour())
    elif res.get("speech"):
        # grounded conversation — the own bot answers it itself
        await _bot.speak(res["speech"])


@router.post("/start")
async def start_bot(payload: StartRequest, db: AsyncSession = Depends(get_db)):
    global _bot, _pending_action, _tour_task
    # Auto-replace: clicking 📹 again should never dead-end on "already running" —
    # stop the old bot (its Chrome window closes) and join the new call fresh.
    if _bot is not None:
        old, _bot = _bot, None
        try:
            await old.stop()
        except Exception:
            pass

    _pending_action = None
    _tour_task = None
    bot = MeetBot(payload.meet_url, payload.bot_name, _on_transcript)
    try:
        await bot.start()
    except Exception as e:
        await bot.stop()
        raise HTTPException(
            status_code=502,
            detail=f"Could not launch the bot browser: {str(e)[:200]}",
        )
    _bot = bot

    meeting = Meeting(
        call_id=f"ownbot-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        context_type="own_bot_presentation",
        meet_url=payload.meet_url,
        bot_name=payload.bot_name,
        status="bot_joining",
        started_by=payload.started_by,
    )
    db.add(meeting)
    await db.commit()
    await db.refresh(meeting)

    _present_set(screen="home")
    return {
        "id": str(meeting.id),
        "bot_name": payload.bot_name,
        "status": bot.status,
        "note": (
            "A Chrome window opened on this machine and is joining the call as Aarav. "
            "ADMIT it from the meeting lobby. Say 'Aarav, give us a tour' once it's in. "
            "If the join screen changed, finish joining by hand in that window."
        ),
    }


@router.get("/status")
async def bot_status():
    if _bot is None:
        return {"running": False}
    return {
        "running": True,
        "status": _bot.status,
        "js_status": _bot.js_status,
        "meet_url": _bot.meet_url,
        "recent_transcript": _bot.transcript[-10:],
        "pending_action": _pending_action,
    }


@router.post("/share")
async def bot_share():
    """Ask the bot to start presenting the app tab."""
    if _bot is None:
        raise HTTPException(status_code=409, detail="No bot is running.")
    ok = await _bot.try_screenshare()
    return {"clicked": ok, "note": None if ok else (
        "Couldn't find the share button automatically — click Share in the bot's "
        "Chrome window and pick the 'Aarav Presents' tab."
    )}


@router.post("/say")
async def bot_say(payload: dict):
    """Make the bot say something (useful for testing the voice pipeline)."""
    if _bot is None:
        raise HTTPException(status_code=409, detail="No bot is running.")
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Provide 'text'.")
    await _bot.speak(text)
    return {"spoken": text}


@router.delete("")
async def stop_bot(db: AsyncSession = Depends(get_db)):
    global _bot
    if _bot is None:
        raise HTTPException(status_code=409, detail="No bot is running.")
    bot, _bot = _bot, None
    await bot.stop()

    row = await db.execute(
        select(Meeting).where(Meeting.context_type == "own_bot_presentation")
        .order_by(Meeting.created_at.desc()).limit(1)
    )
    m = row.scalars().first()
    if m and m.status != "ended":
        m.status = "ended"
        m.ended_at = datetime.now(timezone.utc)
        await db.commit()
    return {"status": "stopped"}
