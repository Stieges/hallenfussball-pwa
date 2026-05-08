"""DAG node: ask the LLM to PLAN structured code changes.

Pattern: the LLM never produces full file content — only structured
operations (replace_text, insert_before_line, etc.) that the deterministic
apply_patch node applies.  This avoids Qwen-Thinking's known incompatibility
with structured output (Alibaba/vLLM official: thinking mode does not support
response_format=json_object) and prevents full-file hallucination drift.

Routing: qwen3-coder-480b (non-thinking by nature, code-specialised).
Temperature override: 0.3 (well below the 1.0 default for this model).
max_tokens: 4000 (sufficient for structured plan, avoids gateway timeout).
"""
from __future__ import annotations

from pathlib import Path

from ..lib.aihub_client import AIHubClient, AIHubError
from ..lib.json_extract import extract_json
from ..lib.models import FindingFixState


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_PLAN_SYSTEM_PROMPT = """Du bist ein präziser Code-Chirurg. Deine Aufgabe ist es, minimale,
chirurgische Code-Änderungen als STRUKTURIERTE OPERATIONEN zu planen.

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt. Kein Markdown, kein Freitext.

## Unterstützte Operationstypen (Feld "typ")

| typ                  | Pflichtfelder                          | Beschreibung                                  |
|----------------------|----------------------------------------|-----------------------------------------------|
| replace_text         | find (str), replace (str)             | Eindeutigen Substring ersetzen                |
| replace_lines        | line_from (int), line_to (int), new_text (str) | Zeilen ersetzen (1-indexed, inklusiv) |
| insert_before_line   | line (int), text (str)                | Text VOR Zeile einfügen (1-indexed)           |
| insert_after_line    | line (int), text (str)                | Text NACH Zeile einfügen (1-indexed)          |
| delete_lines         | line_from (int), line_to (int)        | Zeilen löschen (1-indexed, inklusiv)          |
| append_to_file       | text (str)                            | Text ans Dateiende anhängen                   |
| prepend_to_file      | text (str)                            | Text an den Dateianfang voranstellen          |

## Antwort-Schema

{
  "analyse": "1-3 Sätze: Was ist das Problem und wie wird es behoben",
  "aenderungen": [
    {
      "typ": "<operation>",
      ... operationsspezifische Felder ...
    }
  ]
}

## Konkretes Beispiel (replace_text für a11y-Fix)

Aufgabe: Button hat kein aria-label.
Vorher: <button onClick={handleClose}>X</button>
Nachher: <button aria-label="Dialog schließen" onClick={handleClose}>X</button>

{
  "analyse": "Der Schließen-Button hat kein aria-label. Screen-Reader-Nutzer können den Zweck nicht erkennen. Füge aria-label hinzu.",
  "aenderungen": [
    {
      "typ": "replace_text",
      "find": "<button onClick={handleClose}>X</button>",
      "replace": "<button aria-label=\\"Dialog schließen\\" onClick={handleClose}>X</button>"
    }
  ]
}

## Harte Regeln

- NIEMALS den ganzen Datei-Inhalt produzieren — nur Operationen
- replace_text: 'find' muss EXAKT und EINDEUTIG im Datei-Inhalt vorkommen (genau 1 Treffer)
- Ändere NUR die Stellen die das Finding adressieren
- Behalte Code-Style, Indentation, Imports unverändert
- Schreibe KEINE Kommentare wie "// Fix für F-XXX"
- Wenn mehrere unabhängige Stellen geändert werden müssen: mehrere Operationen in der Liste
- Bei Zeilennummern: exakt die Zeilennummern aus dem bereitgestellten Code mit Zeilennummern verwenden
"""


def _build_user_message(state: FindingFixState, file_content: str) -> str:
    """Build the user message with numbered file content and finding context."""
    finding = state.finding

    # Build acceptance criteria block
    aks = "\n".join(f"- {ak}" for ak in finding.acceptance_criteria) if finding.acceptance_criteria else "- (keine)"

    # Number the lines for easy reference by the LLM
    numbered_lines = "\n".join(
        f"{i + 1:4d}| {line}" for i, line in enumerate(file_content.splitlines())
    )

    return (
        f"## Finding\n"
        f"{finding.title}\n"
        f"Severity: {finding.severity.value}\n"
        f"File: {finding.file}\n"
        f"Akzeptanzkriterien:\n{aks}\n"
        f"\n"
        f"## Aktueller Code (echter Datei-Inhalt mit Zeilennummern)\n"
        f"{numbered_lines}\n"
        f"\n"
        f"## Deine Aufgabe\n"
        f"Plane Änderungen die ALLE Akzeptanzkriterien erfüllen. "
        f"Antworte mit JSON gemäß dem System-Prompt-Schema."
    )


# ---------------------------------------------------------------------------
# Internal LLM call (split out for easy mocking in tests)
# ---------------------------------------------------------------------------

def _call_plan_llm(routing, user_message: str) -> str:
    """Call the AI Hub with the plan prompt. Returns raw LLM response string."""
    # Temperature: 0.3 — DELIBERATELY lower than Qwen3-Coder default (1.0).
    #
    # Rationale: We need DETERMINISTIC structured operation output (JSON aenderungen-list),
    # not creative code generation. Higher temperatures cause Qwen3-Coder to occasionally
    # wrap valid JSON in extra prose or vary the operation 'typ' names, breaking the
    # patcher. Lower temperature reduces the rate at which Qwen3-Coder wraps
    # JSON in extra prose or varies the 'typ' field naming.
    #
    # If patcher-error rates climb above ~10% in .claude/logs/finding-fixes.jsonl,
    # consider raising to 0.5 or implementing response_format=json_schema (LiteLLM
    # supports it for Qwen Coder series).
    client = AIHubClient()
    result = client.chat(
        model=routing.model,
        messages=[
            {"role": "system", "content": _PLAN_SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=4000,
        temperature_override=0.3,
    )
    return result["content"]


# ---------------------------------------------------------------------------
# Public DAG node
# ---------------------------------------------------------------------------

def plan_changes(state: FindingFixState, *, repo_root: str | Path) -> FindingFixState:
    """Ask the LLM to produce a structured patch plan for state.finding.

    Pre-conditions (from upstream nodes):
    - state.is_still_valid is True
    - state.path_resolved is set
    - The file exists at repo_root / state.path_resolved

    Outputs written to state:
    - state.planned_changes: list of operation dicts
    - state.plan_analyse: human-readable summary string
    - state.tool_call_errors += 1 on any failure
    """
    if not state.is_still_valid:
        state.planned_changes = []
        return state

    if not state.path_resolved:
        state.planned_changes = []
        state.tool_call_errors += 1
        return state

    repo_root = Path(repo_root)
    target = repo_root / state.path_resolved
    if not target.is_file():
        state.planned_changes = []
        state.tool_call_errors += 1
        return state

    file_content = target.read_text(encoding="utf-8")
    user_message = _build_user_message(state, file_content)

    try:
        raw = _call_plan_llm(state.routing, user_message)
    except AIHubError:
        state.planned_changes = []
        state.tool_call_errors += 1
        return state
    except Exception:
        state.planned_changes = []
        state.tool_call_errors += 1
        return state

    data = extract_json(raw)
    if data is None:
        state.planned_changes = []
        state.tool_call_errors += 1
        return state

    aenderungen = data.get("aenderungen", [])
    if not isinstance(aenderungen, list):
        aenderungen = []

    state.planned_changes = aenderungen
    state.plan_analyse = data.get("analyse") or None
    return state
