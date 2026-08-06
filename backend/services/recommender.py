"""
AI program recommendation — Groq Cloud (LLaMA).

Reads an uploaded skill-gap document and proposes a personalised training
program per learner. Everything it produces is a *recommendation* — it is
written to the Coordinator's draft queue and never activates an assignment
on its own.

Guardrails enforced here (not left to the prompt):
  * Approved content only — every recommended program must resolve to a real
    row in `training_programs`. Anything else is rejected as a hallucination.
  * No deadline authority — deadlines are computed in Python from the RFP
    engagement date, never taken from the model.
  * English output, UTC timestamps.
"""

import json
from typing import Literal

from groq import Groq, APIError as GroqAPIError
from pydantic import BaseModel, Field

from config import settings

MODEL = settings.groq_model          # default "llama-3.3-70b-versatile"; override via GROQ_MODEL in .env


class RecommenderUnavailable(Exception):
    """Raised when credentials are missing, invalid, out of quota, or the model is unknown."""


class InvalidRecommendation(Exception):
    """Raised when the model proposes content outside the approved catalogue."""


# ──────────────────────────────────────────────────────────────
# Output schema — constrains the response, and doubles as the
# versioned contract for whatever we persist to proposed_program.
# ──────────────────────────────────────────────────────────────

class Module(BaseModel):
    title: str
    hours: int
    objective: str = Field(description="One sentence on what the learner can do after this module.")


class ProgramOption(BaseModel):
    catalogue_program_id: str = Field(
        description="The id of the approved training program from the catalogue. "
                    "Must be copied verbatim from the catalogue — never invented."
    )
    program_name: str
    cert_name: str
    modules: list[Module]
    test_question_count: int = Field(description="Questions to draw from the approved question bank.")
    case_study_title: str
    case_study_brief: str = Field(description="What the learner must produce, in 1-2 sentences.")
    total_duration_h: int
    rationale: str = Field(description="Plain English: why this program fits this learner's gap.")
    confidence: int = Field(description="0-100 confidence that this is the right program.")


class Learner(BaseModel):
    full_name: str
    role: str = ""
    department: str = ""
    email: str = ""
    resource_code: str = Field(
        default="",
        description="Existing resource code such as R-1042 if the document states one; otherwise empty.",
    )
    current_skills: list[str]
    gap_skills: list[str] = Field(description="Skills the learner is missing and must acquire.")
    proficiency_target: str
    cert_authority: str = Field(default="", description="Required certifying body, if the document names one.")


class Candidate(BaseModel):
    learner: Learner
    gap_explanation: str = Field(
        description="Plain English explanation of the gap this addresses and the outcome it targets."
    )
    recommended: ProgramOption
    alternatives: list[ProgramOption] = Field(
        description="Other viable approved programs, so the Talent Lead can choose. May be empty."
    )


class IntakeResult(BaseModel):
    document_summary: str
    document_kind: Literal["skill_gap_record", "resume", "assessment_report", "roster", "other"]
    candidates: list[Candidate]


# ──────────────────────────────────────────────────────────────
# Prompt
# ──────────────────────────────────────────────────────────────

SYSTEM_RULES = """\
You are the Talent Nurturing recommendation engine for Centific AI.

You read an uploaded document describing one or more people with skill gaps, and \
propose a personalised training program for each person.

RULES — these are absolute:

1. APPROVED CONTENT ONLY. Every program you recommend MUST be one of the programs \
   in the approved catalogue below. Copy `catalogue_program_id` verbatim from the \
   catalogue. Never invent a program, a certification, or a certifying body. If no \
   catalogue program fits a person's gap, pick the closest one and say so plainly in \
   the rationale with a low confidence score.

2. YOU RECOMMEND, YOU DO NOT ASSIGN. Everything you produce goes to a human \
   Training Coordinator and then a Talent Lead for review. Write for those readers.

3. NO DATES. Do not propose deadlines, start dates, or completion dates. Those are \
   calculated from the engagement timeline outside of your control.

4. PERSONALISE. Tailor the module selection and case study to the specific gap, \
   current skill level, and role of each individual — not to a generic template. \
   Two people with different backgrounds needing the same certification should get \
   different module emphases.

5. PLAIN ENGLISH. `gap_explanation` and `rationale` are read by a busy human. State \
   what the gap is and what the training makes possible. No jargon, no filler.

6. BE HONEST ABOUT UNCERTAINTY. `confidence` should reflect how well the document \
   actually supports your recommendation. A vague one-line gap description does not \
   justify 95.

7. ONE ENTRY PER PERSON. If the document lists several people, return one candidate \
   per person. If it describes one person, return exactly one candidate.

All output is in English.

IMPORTANT: Your response must be a valid JSON object matching the IntakeResult schema.\
"""


def _catalogue_prompt(programs: list[dict], question_bank_size: int) -> str:
    lines = ["APPROVED TRAINING CATALOGUE", ""]
    for p in programs:
        modules = p.get("content_modules") or []
        if isinstance(modules, str):
            try:
                modules = json.loads(modules)
            except Exception:
                modules = [modules]
        lines.append(
            f"- catalogue_program_id: {p['id']}\n"
            f"  program_name: {p['program_name']}\n"
            f"  cert_name: {p.get('cert_name') or '—'}\n"
            f"  skill_category: {p.get('skill_category') or '—'}\n"
            f"  typical_duration_h: {p.get('total_duration_h') or '—'}\n"
            f"  reference_modules: {', '.join(str(m) for m in modules) if modules else '—'}"
        )
    lines.append("")
    lines.append(
        f"APPROVED QUESTION BANK: {question_bank_size} questions available across the "
        "categories above. Choose a question count appropriate to the program depth."
    )
    return "\n".join(lines)


def _client() -> Groq:
    key = settings.groq_api_key
    if not key:
        raise RecommenderUnavailable(
            "GROQ_API_KEY is not set. Add it to backend/.env to enable AI recommendations."
        )
    return Groq(api_key=key)


def _document_to_text(block: dict) -> str:
    """
    services.extractor produces Anthropic-style content blocks; convert them
    to plain text for Groq (text-only LLM, no native PDF support).
      document (base64 PDF) -> note that PDF was uploaded (content in text)
      text                  -> plain text
    """
    if block.get("type") == "document":
        # PDF content — Groq/LLaMA can't read binary PDFs, so we note it.
        # The text-based extraction path in extractor.py is preferred for Groq.
        return f"[Uploaded PDF document: {block.get('title', 'document.pdf')}]\n(PDF binary content cannot be processed directly — use text/Excel/CSV upload for best results.)"
    return block.get("text", "")


# ──────────────────────────────────────────────────────────────
# JSON schema for Groq structured output
# ──────────────────────────────────────────────────────────────

def _build_json_schema() -> dict:
    """Build a JSON schema from the IntakeResult Pydantic model for Groq."""
    return IntakeResult.model_json_schema()


# ──────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────

def recommend(document_block: dict, catalogue: list[dict], question_bank_size: int = 240) -> IntakeResult:
    """
    Run the recommendation. `document_block` is a content block from
    services.extractor. Returns a validated IntakeResult.
    """
    client = _client()
    document_text = _document_to_text(document_block)
    system_prompt = SYSTEM_RULES + "\n\n" + _catalogue_prompt(catalogue, question_bank_size)

    user_message = (
        document_text + "\n\n"
        "Read this document. Identify every person with a skill gap, and "
        "propose a personalised training program for each, drawn only from "
        "the approved catalogue.\n\n"
        "Respond with a JSON object matching the IntakeResult schema."
    )

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=8000,
        )
    except GroqAPIError as e:
        status = getattr(e, "status_code", None)
        if status in (401, 403):
            raise RecommenderUnavailable(
                "Groq rejected the API key. Check GROQ_API_KEY in backend/.env."
            )
        if status == 429:
            raise RecommenderUnavailable(
                "Groq free-tier rate limit hit — wait a minute and try again."
            )
        if status == 404:
            raise RecommenderUnavailable(
                f"Groq does not recognise the model '{MODEL}'. "
                "Set GROQ_MODEL in backend/.env to a model your key can access "
                "(e.g. llama-3.3-70b-versatile or llama-3.1-8b-instant)."
            )
        raise RecommenderUnavailable(f"Groq request failed: {e}")

    raw_text = response.choices[0].message.content or ""

    try:
        result = IntakeResult.model_validate_json(raw_text)
    except Exception:
        # Try to parse as dict first in case the model wrapped it
        try:
            data = json.loads(raw_text)
            result = IntakeResult.model_validate(data)
        except Exception:
            raise InvalidRecommendation("The model did not return a parseable recommendation.")

    return result


def validate_against_catalogue(result: IntakeResult, approved_ids: set[str]) -> list[str]:
    """
    Guardrail: strip any option whose program is not in the approved catalogue.

    Returns a list of human-readable warnings. Mutates `result` in place,
    dropping bad alternatives. Raises if a *recommended* program is invalid,
    since there is nothing safe to fall back to.
    """
    warnings: list[str] = []

    for candidate in result.candidates:
        name = candidate.learner.full_name

        if candidate.recommended.catalogue_program_id not in approved_ids:
            raise InvalidRecommendation(
                f"Recommended program for {name} "
                f"({candidate.recommended.program_name!r}, id="
                f"{candidate.recommended.catalogue_program_id}) is not in the approved catalogue. "
                "Rejected — nothing was written to the draft queue."
            )

        kept = []
        for alt in candidate.alternatives:
            if alt.catalogue_program_id in approved_ids:
                kept.append(alt)
            else:
                warnings.append(
                    f"Dropped unapproved alternative {alt.program_name!r} for {name}."
                )
        candidate.alternatives = kept

    return warnings
