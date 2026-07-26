"""
Avathar — the conversational assistant inside the application.

Not a command set: a free-form chat (like ChatGPT/Gemini) that is *grounded*
in a live snapshot of the database. Ask it anything — "who's behind
schedule?", "summarise the pending approvals", "what should I focus on
today?" — and it answers from real data. When the conversation calls for it,
it also *acts*: opening the app's real screens or proposing a HIL decision.

    POST /avathar/command   {"transcript": "...", "history": [...]}
      → {"intent", "speech", "view", "data", "needs_confirmation", "pending_action"}

    POST /avathar/execute   — runs a confirmed decision through the same
                              hil_action() code path as the button click.

Guardrails, unchanged in spirit:
  * The model talks freely, but it only ever *plans* an action from a small
    typed vocabulary (open_screen / show_training / approve_hil / reject_hil).
    Code resolves names → rows; the model never emits an ID.
  * Approve/reject NEVER executes from chat. The read-back sentence is
    templated by code from the real row, and only "confirm" (a second
    request) triggers /avathar/execute.
  * The data snapshot the model sees is read-only text; its reply cannot
    write anything.
"""

import difflib
import re
from typing import Optional, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import settings
from database import get_db
from models import (
    Assignment,
    AssignmentStatus,
    Certification,
    Escalation,
    EscalationStatus,
    HilQueue,
    HilStatus,
    Resource,
)
from routers.hil import HILActionRequest, hil_action, _load as _hil_load, _fmt as _hil_fmt
from routers.learning import LEARNER_VISIBLE, _fmt_course, _load_assignment

router = APIRouter(prefix="/avathar", tags=["Avathar"])


# ─────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────

SCREENS = ("hil", "studio", "tracker", "analytics", "certs", "escalations", "audit", "learn")


TRACKER_FILTERS = ("all", "active", "at_risk", "overdue", "complete")


class PlannedAction(BaseModel):
    """The ONLY ways the model may touch the app — everything else is talk."""
    type: Literal["none", "open_screen", "show_training", "approve_hil", "reject_hil", "start_tour"] = "none"
    screen: Optional[Literal[SCREENS]] = None  # type: ignore[valid-type]
    person: Optional[str] = None
    filter: Optional[Literal[TRACKER_FILTERS]] = None  # type: ignore[valid-type]


class AssistantReply(BaseModel):
    reply: str
    action: PlannedAction = PlannedAction()


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class CommandRequest(BaseModel):
    transcript: str
    history: list[ChatTurn] = []


class ExecuteRequest(BaseModel):
    hil_id: UUID
    action: Literal["approve", "reject"]
    person: Optional[str] = None
    actor: Optional[str] = None


# ─────────────────────────────────────────────
# Live data snapshot — what the assistant knows
# ─────────────────────────────────────────────

async def _snapshot(db: AsyncSession) -> str:
    """Compact, read-only text picture of the whole program for grounding."""
    rows = await db.execute(
        _load_assignment().order_by(desc(Assignment.created_at)).limit(60)
    )
    assignments = rows.scalars().all()

    lines = ["ASSIGNMENTS (person | program | status | progress% | deadline):"]
    for a in assignments:
        lines.append(
            f"- {a.resource.full_name if a.resource else '?'} | "
            f"{a.program.program_name if a.program else '?'} | {a.status.value} | "
            f"{a.overall_progress or 0}% | {a.deadline}"
        )

    hil_rows = await db.execute(_hil_load().where(HilQueue.status == HilStatus.pending))
    pending = hil_rows.scalars().all()
    lines.append(f"\nPENDING HIL APPROVALS ({len(pending)}):")
    for h in pending:
        prog = (h.proposed_program or {}).get("program_name") \
            or ((h.proposed_program or {}).get("recommended") or {}).get("program_name") \
            or (h.assignment.program.program_name if h.assignment and h.assignment.program else "?")
        lines.append(f"- {h.assignment.resource.full_name if h.assignment and h.assignment.resource else '?'} | {prog}")

    drafts_n = (await db.execute(select(func.count(HilQueue.id)).where(HilQueue.status == HilStatus.draft))).scalar() or 0
    certs_n = (await db.execute(select(func.count(Certification.id)))).scalar() or 0
    certs_pending = (await db.execute(select(func.count(Certification.id)).where(Certification.status == "pending"))).scalar() or 0
    esc_open = (await db.execute(select(func.count(Escalation.id)).where(Escalation.status == EscalationStatus.open))).scalar() or 0
    lines.append(f"\nOTHER: {drafts_n} coordinator drafts in Program Studio (not yet sent to HIL); "
                 f"{certs_n} certifications ({certs_pending} pending verification); {esc_open} open escalations.")
    return "\n".join(lines)


# ─────────────────────────────────────────────
# The brain — Gemini chat with grounding + planned actions
# ─────────────────────────────────────────────

SYSTEM = """You are Aarav, the voice assistant living inside a talent-nurturing application.
You are conversational and helpful, like a sharp colleague — not a command parser.

GROUNDING: The DATA section below is the live database, refreshed on every message.
Answer questions using ONLY this data. Never invent people, programs, numbers, or statuses.
If something isn't in the data, say you don't have it. Replies are spoken aloud — keep them
short and natural (1-3 sentences), no markdown, no bullet lists unless asked.

ACTIONS: Besides talking, you can act by setting `action`:
- open_screen + screen: when the user wants to SEE something. Screens:
  hil (approval queue), studio (coordinator drafts), tracker (all assignments),
  analytics (metrics), certs, escalations, audit (audit log), learn (learning platform).
- show_training + person: opens the learning platform as that person.
- approve_hil / reject_hil + person: when the user wants to decide someone's pending
  approval. The app will read it back and require confirmation — NEVER say you already
  did it; say something brief, the app appends the read-back.
- start_tour: when the user asks for a tour / walkthrough / "show me everything" /
  "present the application". The app runs a narrated tour of every screen by itself —
  reply with a short intro sentence only.
- The tracker screen has status filters. When the user asks to see a subset of
  assignments ("show overdue ones", "filter to at risk", "only completed"), use
  open_screen with screen=tracker AND filter=one of all/active/at_risk/overdue/complete.
Use action type "none" for pure conversation. Prefer acting when the user asks to see
or do something; if you open a screen, mention it naturally in the reply.
When a spoken name is garbled, match it to the closest real person in the data.
Only decide (approve/reject) when the user clearly asks to."""


_quota_block_until = 0.0  # circuit breaker: after a 429, skip Gemini for a while


def _gemini_chat(message: str, history: list[ChatTurn], snapshot: str) -> AssistantReply | None:
    global _quota_block_until
    if not settings.gemini_api_key:
        return None
    import time
    if time.time() < _quota_block_until:
        return None  # quota known to be exhausted — fall back instantly, no 4s wait
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=settings.gemini_api_key)
    contents = []
    for turn in history[-12:]:
        contents.append(genai_types.Content(
            role="user" if turn.role == "user" else "model",
            parts=[genai_types.Part.from_text(text=turn.text)],
        ))
    contents.append(genai_types.Content(role="user", parts=[genai_types.Part.from_text(text=message)]))

    # one retry — free-tier bursts throw transient 429/5xx that shouldn't
    # drop the whole conversation into keyword-fallback mode
    for attempt in (1, 2):
        try:
            response = client.models.generate_content(
                model=settings.gemini_model,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=SYSTEM + "\n\n=== DATA ===\n" + snapshot,
                    response_mime_type="application/json",
                    response_schema=AssistantReply,
                    temperature=0.4,
                ),
            )
            parsed = getattr(response, "parsed", None)
            if isinstance(parsed, AssistantReply):
                return parsed
        except Exception as e:
            print(f"[AVATHAR] Gemini attempt {attempt} failed: {type(e).__name__}: {str(e)[:180]}")
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                _quota_block_until = time.time() + 120  # don't burn 4s per message on a dead quota
                return None
            if attempt == 1:
                time.sleep(1.5)
    return None


def _fallback(text: str) -> AssistantReply:
    """No API key / Gemini down: still navigate, tour, filter and decide via keywords."""
    t = text.lower()

    if re.search(r"\btour\b|walk ?through|show (me )?everything|present the app", t):
        return AssistantReply(reply="", action=PlannedAction(type="start_tour"))
    for f in ("overdue", "at_risk", "complete", "active"):
        if re.search(rf"\b{f.replace('_', '[ _]')}\b", t) and re.search(r"assignment|tracker|show|filter|only", t):
            return AssistantReply(reply=f"Filtering the tracker to {f.replace('_', ' ')}.",
                                  action=PlannedAction(type="open_screen", screen="tracker", filter=f))

    def person_after(*markers):
        for m in markers:
            match = re.search(m, t)
            if match:
                name = re.sub(r"\b(hil|request|requests|approval|training|program|course|please)\b", "",
                              match.group(1)).strip(" .,!?'s")
                if name:
                    return name
        return None

    if re.search(r"\b(approve|accept)\b", t):
        return AssistantReply(reply="", action=PlannedAction(type="approve_hil", person=person_after(r"(?:approve|accept)\s+(?:the\s+)?(.+)")))
    if re.search(r"\b(reject|decline|deny)\b", t):
        return AssistantReply(reply="", action=PlannedAction(type="reject_hil", person=person_after(r"(?:reject|decline|deny)\s+(?:the\s+)?(.+)")))
    if re.search(r"\btraining|course|learning\b", t):
        p = person_after(r"(?:of|for)\s+(.+)")
        if p:
            return AssistantReply(reply="", action=PlannedAction(type="show_training", person=p))
    for pat, screen in [
        (r"\bhil\b|approval", "hil"), (r"\bdraft|studio\b", "studio"),
        (r"\banalytic|metric|dashboard|stat\b", "analytics"), (r"\bescalation\b", "escalations"),
        (r"\bcert", "certs"), (r"\baudit\b", "audit"), (r"\btracker|assignment|progress\b", "tracker"),
    ]:
        if re.search(pat, t):
            return AssistantReply(reply=f"Opening that for you.", action=PlannedAction(type="open_screen", screen=screen))
    return AssistantReply(reply=(
        "My AI service is offline — likely the daily free quota. I can still open screens, "
        "run the tour, filter the tracker, and handle approvals."
    ))


# ─────────────────────────────────────────────
# Person resolution — fuzzy, but against real rows only
# ─────────────────────────────────────────────

async def _resolve_person(db: AsyncSession, spoken: str | None) -> tuple[Optional[Resource], list[str]]:
    rows = await db.execute(select(Resource).order_by(Resource.full_name))
    people = rows.scalars().all()
    names = [p.full_name for p in people]
    if not spoken:
        return None, names

    s = spoken.lower().strip()
    subs = [p for p in people if s in p.full_name.lower() or p.resource_code.lower() == s]
    if len(subs) == 1:
        return subs[0], names
    tok = [p for p in people if s.split()[0] in p.full_name.lower().split()]
    if len(tok) == 1:
        return tok[0], names
    close = difflib.get_close_matches(s, [n.lower() for n in names], n=1, cutoff=0.55)
    if close:
        for p in people:
            if p.full_name.lower() == close[0]:
                return p, names
    return None, names


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

def _reply(intent, speech, view=None, data=None, needs_confirmation=False, pending_action=None):
    return {
        "intent": intent, "speech": speech, "view": view, "data": data,
        "needs_confirmation": needs_confirmation, "pending_action": pending_action,
    }


@router.post("/command")
async def command(payload: CommandRequest, db: AsyncSession = Depends(get_db)):
    text = payload.transcript.strip()
    if not text:
        return _reply("none", "I didn't catch that — try again.")

    snapshot = await _snapshot(db)
    ar = _gemini_chat(text, payload.history, snapshot) or _fallback(text)
    action = ar.action or PlannedAction()

    # ── decisions: deterministic read-back + mandatory confirm ──
    if action.type in ("approve_hil", "reject_hil"):
        verb = "approve" if action.type == "approve_hil" else "reject"
        person, names = await _resolve_person(db, action.person)
        if not person:
            hint = f"I couldn't match “{action.person}” to anyone. " if action.person else f"Whose request should I {verb}? "
            return _reply(action.type, hint + f"People I know: {', '.join(names[:8])}.")

        rows = await db.execute(
            _hil_load()
            .join(Assignment, HilQueue.assignment_id == Assignment.id)
            .where(HilQueue.status == HilStatus.pending, Assignment.resource_id == person.id)
        )
        pending = rows.scalars().all()
        if not pending:
            return _reply(action.type, f"{person.full_name} has no pending HIL request right now.",
                          view="open_screen", data={"screen": "hil"})

        hil = pending[0]
        prog = (hil.proposed_program or {}).get("program_name") \
            or ((hil.proposed_program or {}).get("recommended") or {}).get("program_name") \
            or (hil.assignment.program.program_name if hil.assignment and hil.assignment.program else "the proposed program")
        extra = f" They have {len(pending)} pending — I took the most recent." if len(pending) > 1 else ""
        return _reply(
            action.type,
            f"You're about to {verb} {person.full_name}'s request for {prog}.{extra} Say confirm to proceed, or cancel.",
            needs_confirmation=True,
            pending_action={"hil_id": str(hil.id), "action": verb, "person": person.full_name, "program": prog},
        )

    # ── open the learning platform as a person ──
    if action.type == "show_training":
        person, names = await _resolve_person(db, action.person)
        if not person:
            hint = f"I couldn't find “{action.person}”. " if action.person else "Whose training? "
            return _reply("none", hint + f"People I know: {', '.join(names[:8])}.")
        rows = await db.execute(
            _load_assignment()
            .where(Assignment.resource_id == person.id, Assignment.status.in_(LEARNER_VISIBLE))
            .order_by(desc(Assignment.created_at))
        )
        courses = [_fmt_course(a) for a in rows.scalars().all()]
        speech = ar.reply or (
            f"Here's {person.full_name}'s learning platform — "
            + (f"{len(courses)} active program{'s' if len(courses) != 1 else ''}." if courses else "nothing approved yet.")
        )
        return _reply(
            "show_training", speech, view="learn",
            data={"person": {"id": str(person.id), "full_name": person.full_name,
                             "resource_code": person.resource_code, "role": person.role},
                  "courses": courses},
        )

    # ── narrated tour of every screen (frontend drives the sequence) ──
    if action.type == "start_tour":
        return _reply("start_tour", ar.reply or "Let me walk you through the whole application.",
                      view="start_tour")

    # ── open a screen (optionally filtered) ──
    if action.type == "open_screen" and action.screen:
        data = {"screen": action.screen}
        if action.filter and action.screen == "tracker":
            data["filter"] = action.filter
        return _reply("open_screen", ar.reply or "Here you go.", view="open_screen", data=data)

    # ── pure conversation ──
    return _reply("none", ar.reply or "Tell me more?")


@router.post("/execute")
async def execute(payload: ExecuteRequest, db: AsyncSession = Depends(get_db)):
    # Same code path as the HIL screen's button — same status flips, same audit log.
    result = await hil_action(
        payload.hil_id,
        HILActionRequest(
            action=payload.action,
            reviewer_id=payload.actor or "talent_lead (voice)",
            reviewer_notes=f"{payload.action.title()}d via Avathar voice command after spoken confirmation.",
        ),
        db,
    )
    who = payload.person or "the request"
    if payload.action == "approve":
        speech = f"Done — {who}'s program is approved and now active on their learning platform."
    else:
        speech = f"Done — {who}'s request is rejected and the assignment is cancelled."
    return _reply("executed", speech, view="open_screen", data={"screen": "hil", "result": result})
