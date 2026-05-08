"""DAG node: LLM-based patch reviewer (Belegflow-pattern).

Validates that the deterministic patcher produced a correct result by asking
a second LLM to compare the original finding + planned operations against
the actual patched file content.

Routing: gpt-4.1-mini via AI Hub (EU-hosted, OpenAI-style API, no
Qwen thinking-mode conflicts).

Verdicts:
  APPROVED     — patch fulfils all acceptance criteria, no obvious bugs
  REJECTED     — patch does not fix the finding or introduces clear bugs
  NEEDS_HUMAN  — unclear / edge-case / breaking-change risk, human required
"""
from __future__ import annotations

from ..lib.aihub_client import AIHubClient, AIHubError
from ..lib.json_extract import extract_json
from ..lib.models import FindingFixState

_REVIEW_MODEL = "gpt-4.1-mini"
_REVIEW_TEMPERATURE = 0.5
_REVIEW_MAX_TOKENS = 1500


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

_REVIEW_SYSTEM_PROMPT = """Du bist ein erfahrener Code-Reviewer. Deine Aufgabe ist es zu beurteilen,
ob ein automatisch erzeugter Code-Patch ein gemeldetes Finding korrekt behebt.

Du erhältst:
1. Das Finding mit Akzeptanzkriterien
2. Den geplanten Patch (strukturierte Operationen)
3. Den tatsächlichen Datei-Inhalt NACH Anwendung des Patches

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt:
{
  "verdict": "APPROVED" | "REJECTED" | "NEEDS_HUMAN",
  "reasoning": "1-2 Sätze warum",
  "concerns": ["optionale Liste konkreter Bedenken"]
}

Verdickt-Definitionen:
- APPROVED:     Der Patch erfüllt ALLE Akzeptanzkriterien. Keine offensichtlichen Bugs.
- REJECTED:     Der Patch löst das Finding NICHT oder bringt offensichtliche Bugs/Regressionen.
- NEEDS_HUMAN:  Unklar, Edge-Case, breaking change risk, oder Sicherheits-Implikation.

Sei streng: Im Zweifel NEEDS_HUMAN statt APPROVED.
Antworte NUR mit JSON — kein Markdown, kein Freitext darum herum.
"""


def _build_review_user_message(state: FindingFixState) -> str:
    """Assemble the review prompt with finding, planned changes, and patched content."""
    finding = state.finding
    aks = "\n".join(f"- {ak}" for ak in finding.acceptance_criteria) if finding.acceptance_criteria else "- (keine)"

    import json as _json
    changes_repr = _json.dumps(state.planned_changes, ensure_ascii=False, indent=2)

    patched = state.patched_content or "(kein Inhalt verfügbar)"

    return (
        f"## Finding\n"
        f"ID: {finding.id}\n"
        f"Titel: {finding.title}\n"
        f"Severity: {finding.severity.value}\n"
        f"Akzeptanzkriterien:\n{aks}\n"
        f"\n"
        f"## Geplante Änderungen (strukturierte Operationen)\n"
        f"```json\n{changes_repr}\n```\n"
        f"\n"
        f"## Datei-Inhalt NACH Patch\n"
        f"```\n{patched}\n```\n"
        f"\n"
        f"Beurteile: Erfüllt der Patch ALLE Akzeptanzkriterien ohne Bugs/Regressionen?\n"
        f"Antworte mit JSON."
    )


# ---------------------------------------------------------------------------
# Internal LLM call (split out for easy mocking in tests)
# ---------------------------------------------------------------------------

def _call_review_llm(user_message: str) -> str:
    """Call the review LLM and return raw response string."""
    client = AIHubClient()
    result = client.chat(
        model=_REVIEW_MODEL,
        messages=[
            {"role": "system", "content": _REVIEW_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=_REVIEW_MAX_TOKENS,
        temperature_override=_REVIEW_TEMPERATURE,
    )
    return result["content"]


# ---------------------------------------------------------------------------
# Public DAG node
# ---------------------------------------------------------------------------

def review_patch(state: FindingFixState) -> FindingFixState:
    """Review the patch using a second LLM and set state.review_verdict.

    Pre-conditions (from upstream apply_patch node):
    - state.fix_applied is True
    - state.patched_content is set
    - state.planned_changes is non-empty

    Outputs written to state:
    - state.review_verdict: "APPROVED" | "REJECTED" | "NEEDS_HUMAN"
    - state.review_reasoning: short explanation string
    """
    if not state.fix_applied:
        # Nothing was patched; skip review but mark as needing human attention
        state.review_verdict = "NEEDS_HUMAN"
        state.review_reasoning = "apply_patch did not produce a patch (fix_applied=False)"
        return state

    user_message = _build_review_user_message(state)

    try:
        raw = _call_review_llm(user_message)
    except AIHubError as exc:
        state.review_verdict = "NEEDS_HUMAN"
        state.review_reasoning = f"AIHubError during review: {exc}"
        state.tool_call_errors += 1
        return state
    except Exception as exc:
        state.review_verdict = "NEEDS_HUMAN"
        state.review_reasoning = f"Unexpected error during review: {exc}"
        state.tool_call_errors += 1
        return state

    data = extract_json(raw)
    if data is None:
        state.review_verdict = "NEEDS_HUMAN"
        state.review_reasoning = "Could not parse LLM review response as JSON"
        state.tool_call_errors += 1
        return state

    raw_verdict = data.get("verdict", "")
    if raw_verdict not in ("APPROVED", "REJECTED", "NEEDS_HUMAN"):
        state.review_verdict = "NEEDS_HUMAN"
        state.review_reasoning = f"Unknown verdict '{raw_verdict}' from review LLM"
        return state

    state.review_verdict = raw_verdict  # type: ignore[assignment]
    state.review_reasoning = data.get("reasoning") or ""
    return state
