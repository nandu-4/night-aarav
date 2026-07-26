"""
AI program recommendation — Google Gemini (AI Studio).

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

import base64
import json
from typing import Literal

from google import genai
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel, Field

from config import settings

MODEL = settings.gemini_model          # default "gemini-2.5-flash"; override via GEMINI_MODEL in .env


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

All output is in English.\
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


def _client() -> genai.Client:
    key = settings.gemini_api_key
    if not key:
        raise RecommenderUnavailable(
            "GEMINI_API_KEY is not set. Add it to backend/.env to enable AI recommendations."
        )
    return genai.Client(api_key=key)


def _to_gemini_part(block: dict):
    """
    services.extractor produces Anthropic-style content blocks; translate them
    to Gemini parts.
      document (base64 PDF) -> Part.from_bytes (Gemini reads PDFs natively)
      text                  -> plain text part
    """
    if block.get("type") == "document":
        src = block.get("source", {})
        return genai_types.Part.from_bytes(
            data=base64.standard_b64decode(src.get("data", "")),
            mime_type=src.get("media_type", "application/pdf"),
        )
    return genai_types.Part.from_text(text=block.get("text", ""))


# ──────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────

def recommend(document_block: dict, catalogue: list[dict], question_bank_size: int = 240) -> IntakeResult:
    """
    Run the recommendation. `document_block` is a content block from
    services.extractor. Returns a validated IntakeResult.
    """
    client = _client()

    try:
        response = client.models.generate_content(
            model=MODEL,
            contents=[
                _to_gemini_part(document_block),
                (
                    "Read this document. Identify every person with a skill gap, and "
                    "propose a personalised training program for each, drawn only from "
                    "the approved catalogue."
                ),
            ],
            config=genai_types.GenerateContentConfig(
                system_instruction=SYSTEM_RULES + "\n\n" + _catalogue_prompt(catalogue, question_bank_size),
                response_mime_type="application/json",
                response_schema=IntakeResult,
            ),
        )
    except genai_errors.APIError as e:
        code = getattr(e, "code", None)
        if code in (401, 403):
            raise RecommenderUnavailable(
                "Google AI Studio rejected the API key. Check GEMINI_API_KEY in backend/.env."
            )
        if code == 429:
            raise RecommenderUnavailable(
                "Gemini free-tier rate limit hit — wait a minute and try again."
            )
        if code == 404:
            raise RecommenderUnavailable(
                f"Gemini does not recognise the model '{MODEL}'. "
                "Set GEMINI_MODEL in backend/.env to a model your key can access "
                "(e.g. gemini-2.5-flash or gemini-2.5-pro)."
            )
        raise RecommenderUnavailable(f"Gemini request failed: {e}")

    result = getattr(response, "parsed", None)
    if result is None:
        # fall back to parsing the JSON text if the SDK didn't hydrate the schema
        try:
            result = IntakeResult.model_validate_json(response.text)
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
