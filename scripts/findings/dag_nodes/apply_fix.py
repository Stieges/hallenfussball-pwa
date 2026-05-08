"""DAG node: apply the fix proposed by the LLM to the real file."""
from __future__ import annotations
import json
import os
from pathlib import Path
from ..lib.models import FindingFixState
from ..lib.aihub_client import AIHubClient


_APPLY_SYSTEM_PROMPT = """Du bist ein präziser Code-Editor. Gegeben ein Finding und der ECHTE Code,
schreibe den minimalsten Fix.

Antworte NUR mit JSON: {"new_content": "<gesamter neuer Datei-Inhalt>", "diff": "<unified diff snippet>"}

Regeln:
- Ändere NUR die Stellen die das Finding adressiert
- Behalte Code-Style, Indentation, Imports
- Schreibe KEINE Kommentare wie "// Fix für F-XXX"
- Bei Test-Datei: Test wird in Task 14 (run_tests) separat geprüft
"""


def _call_apply_llm(routing, finding_text: str, code_text: str) -> str:
    if routing.provider == "aihub":
        client = AIHubClient()
        result = client.chat(
            model=routing.model,
            messages=[
                {"role": "system", "content": _APPLY_SYSTEM_PROMPT},
                {"role": "user", "content": f"## Finding\n{finding_text}\n\n## Code\n```\n{code_text}\n```"},
            ],
            max_tokens=8000,
        )
        return result["content"]
    else:
        from anthropic import Anthropic
        client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        msg = client.messages.create(
            model=f"claude-{routing.model}",
            max_tokens=8000,
            system=_APPLY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"## Finding\n{finding_text}\n\n## Code\n```\n{code_text}\n```"}],
        )
        return msg.content[0].text


def apply_fix(state: FindingFixState, *, repo_root: str | Path) -> FindingFixState:
    if not state.is_still_valid:
        state.fix_applied = False
        return state

    repo_root = Path(repo_root)
    finding_text = f"{state.finding.title}\nAcceptance: {state.finding.acceptance_criteria}"
    # Single-file-fix only for v1 (multi-file in future Phase 4)
    if state.path_resolved is None or state.path_resolved not in state.file_contents:
        state.fix_applied = False
        return state
    code_text = state.file_contents[state.path_resolved]

    raw = _call_apply_llm(state.routing, finding_text, code_text)
    raw = raw.strip().strip("`")
    if raw.startswith("json"):
        raw = raw[4:].strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        state.fix_applied = False
        state.tool_call_errors += 1
        return state

    new_content = data.get("new_content", "")
    if not new_content:
        state.fix_applied = False
        return state

    target = repo_root / state.path_resolved
    target.write_text(new_content, encoding="utf-8")
    state.fix_applied = True
    state.fix_diff = data.get("diff", "")
    return state
