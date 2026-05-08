"""DAG node: LLM-based patch reviewer (final stage of plan/apply/review DAG).

Validates that the deterministic patcher produced a correct result by asking
a second LLM to compare the original finding + planned operations against
the actual patched file content.

Routing: gpt-oss-120b-sovereign via AI Hub (sovereign, free, OpenAI Open-Weights
family — different family from the Qwen plan_changes node, preserving
diversity for independent error-modes between writer and reviewer).
Native JSON-Schema enforcement via response_format=REVIEW_PATCH_SCHEMA;
json_extract fallback if the gateway doesn't honour the schema.

Verdicts:
  APPROVED     — patch fulfils all acceptance criteria, no obvious bugs
  REJECTED     — patch does not fix the finding or introduces clear bugs
  NEEDS_HUMAN  — unclear / edge-case / breaking-change risk, human required
"""
from __future__ import annotations

from ..lib.aihub_client import AIHubClient, AIHubError
from ..lib.json_extract import extract_json
from ..lib.models import FindingFixState
from ..lib.schemas import REVIEW_PATCH_SCHEMA

_REVIEW_MODEL = "gpt-oss-120b-sovereign"
# Temperature: 0.7 — gpt-oss default per Spec 4.0.
#
# gpt-oss has inherent verbosity and benefits from a slightly higher temp than
# the previous gpt-4.1-mini setting (0.5). The structured-output schema enforces
# the JSON shape regardless of temp; the temp tunes the *content* nuance.
_REVIEW_TEMPERATURE = 0.7
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

STRUKTURELLE PFLICHT-CHECKS (alle MÜSSEN ✓ für APPROVED):

1. **Scope-Korrektheit**: Werden neue Funktionen/Konstanten/Types am korrekten Scope-Level eingefügt?
   - Neue helper-Funktionen → module-level (nicht innerhalb anderer Funktionen)
   - Neue React-Hooks-Aufrufe → top of component (nicht in conditionals/loops)
   - Neue Imports → top of file
   - Verstoß? → REJECTED

2. **Syntax-Plausibilität**: Sind Klammern, Brackets, Generics, JSX-Tags korrekt geschlossen?
   - Inkonsistente Indentation, fehlende Schließ-Brackets → REJECTED

3. **Side-Effect-Risk**: Verändert der Patch globalen Zustand, Imports, oder API-Contracts?
   - JA → NEEDS_HUMAN (nicht APPROVED, auch wenn korrekt)

4. **Acceptance-Criteria**: Erfüllt jeder einzelne AK aus dem Finding?
   - Auch nur EIN AK nicht erfüllt → REJECTED

5. **Test-Impact**: Würden die Änderungen plausibel bestehende Tests brechen?
   - Function-rename ohne Aufrufer-Update? → REJECTED
   - Type-Signature-Änderung ohne consumer-update? → REJECTED
   - Im Zweifel → NEEDS_HUMAN

## REJECTED-Beispiele (lerne aus echten Fehlern)

### Beispiel 1: Strukturbug — neue Funktion in falschem Scope
Die Datei NACH Patch enthält:

    export function addMinutes(date: Date, minutes: number): Date {
      return new Date(date.getTime() + minutes * 60000)

    /**
     * Konvertiert UTC-Zeitstempel ...
     */
    export function formatTimeForDisplay(...): string {
      return date.toLocaleTimeString(...)
    }
    }

→ REJECTED. Die neue Funktion `formatTimeForDisplay` wurde **innerhalb** der
   Funktion `addMinutes` eingefügt (zwischen `return` und schließendem `}`).
   Dadurch ist die Datei syntaktisch broken: orphaned brace, nested function,
   unreachable code nach return.
   Verstoß gegen Check #1 (Scope-Korrektheit) UND Check #2 (Syntax-Plausibilität).

### Beispiel 2: Missing-Return — Fallback entfernt ohne Replacement
Die Datei NACH Patch enthält:

    export function generateUniqueId(): string {
      if (crypto?.randomUUID) {
        return crypto.randomUUID();
      }

    }

→ REJECTED. Der bisherige `Math.random()`-Fallback wurde entfernt, aber kein
   Replacement (kein `throw`, kein zweiter Crypto-Pfad) wurde hinzugefügt.
   Wenn `crypto?.randomUUID` falsy ist, fällt die Funktion durch ohne Return —
   gibt `undefined` zurück und bricht den TypeScript-Type-Contract `: string`.
   Verstoß gegen Check #4 (AKs „Keine schwachen Fallback-Implementierungen"
   wurde nur halbherzig erfüllt) UND Check #2 (broken Control-Flow).

WENN DU UNSICHER BIST → NEEDS_HUMAN, niemals APPROVED.
APPROVED ist die Ausnahme, nicht die Regel.

Sei streng: Im Zweifel NEEDS_HUMAN statt APPROVED.
Antworte NUR mit JSON — kein Markdown, kein Freitext darum herum.
Pflichtfeld `concerns` ist immer ein Array (auch leer: `[]`).
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
    """Call the review LLM and return raw response string.

    Passes response_format=REVIEW_PATCH_SCHEMA so gpt-oss enforces the JSON
    shape natively. extract_json fallback in the public node handles cases
    where the gateway ignores the schema.
    """
    client = AIHubClient()
    result = client.chat(
        model=_REVIEW_MODEL,
        messages=[
            {"role": "system", "content": _REVIEW_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=_REVIEW_MAX_TOKENS,
        temperature_override=_REVIEW_TEMPERATURE,
        response_format=REVIEW_PATCH_SCHEMA,
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

    # Empty-Plan-Guard: protects against state-reset race in finding_fix.py's
    # fallback flow that occasionally produced verdict=APPROVED with
    # planned_changes_count=0. If there are no planned changes, there is
    # nothing to review.
    if not state.planned_changes:
        state.review_verdict = "NEEDS_HUMAN"
        state.review_reasoning = "review skipped: no planned_changes available"
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
    raw_concerns = data.get("concerns")
    if isinstance(raw_concerns, list):
        state.review_concerns = [str(c) for c in raw_concerns]
    return state
