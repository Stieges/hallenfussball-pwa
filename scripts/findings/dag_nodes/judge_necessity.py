"""DAG node: judge whether a finding is still valid against current code.

This is the LLM step where we DON'T trust the bot-description (D21).
The judge sees the REAL file contents (state.file_contents) and decides:
- 'still_valid: true' → proceed to apply_fix
- 'still_valid: false' → mark Finding archived (obsolete) and stop
"""
from __future__ import annotations
import json
import os
from ..lib.models import FindingFixState
from ..lib.aihub_client import AIHubClient
from ..lib.schemas import JUDGE_NECESSITY_SCHEMA


_JUDGE_SYSTEM_PROMPT = """Du bist ein Code-Judge. Ein Finding wurde von einem Reviewer-Bot
gemeldet. Deine Aufgabe: Anhand des ECHTEN Code-Inhalts entscheiden, ob das Finding
noch valide ist (Code-Stand könnte sich seit Review geändert haben).

Antworte NUR mit JSON: {"is_still_valid": true|false, "reasoning": "<kurz>"}
"""


def _call_judge_llm(routing, finding_text: str, code_text: str) -> str:
    """Call the routed LLM (claude or aihub) for the judge step."""
    if routing.provider == "aihub":
        client = AIHubClient()
        # max_tokens=500 (was 2000): judge produces a tiny JSON {is_still_valid, reasoning}.
        # Smaller budget keeps Qwen-Thinking total output under the gateway timeout.
        # response_format=JUDGE_NECESSITY_SCHEMA enforces the JSON shape gateway-side
        # where supported; existing parser handles models that ignore it.
        result = client.chat(
            model=routing.model,
            messages=[
                {"role": "system", "content": _JUDGE_SYSTEM_PROMPT},
                {"role": "user", "content": f"## Finding\n{finding_text}\n\n## Aktueller Code\n```\n{code_text}\n```"},
            ],
            max_tokens=500,
            response_format=JUDGE_NECESSITY_SCHEMA,
        )
        return result["content"]
    else:
        # Claude
        from anthropic import Anthropic
        client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        msg = client.messages.create(
            model=f"claude-{routing.model}",
            max_tokens=2000,
            system=_JUDGE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"## Finding\n{finding_text}\n\n## Code\n```\n{code_text}\n```"}],
        )
        return msg.content[0].text


def judge_necessity(state: FindingFixState) -> FindingFixState:
    from ..lib.aihub_client import AIHubError
    finding_text = f"{state.finding.title}\n{state.finding.area}\nFile: {state.finding.file}"
    code_text = "\n".join(f"# {p}\n{c}" for p, c in state.file_contents.items())
    try:
        raw = _call_judge_llm(state.routing, finding_text, code_text)
    except (AIHubError, Exception) as e:
        # Provider 504 / network glitch / rate limit. Conservative: assume still
        # valid (apply_fix will decide); count as tool error to enable fallback.
        state.is_still_valid = True
        state.judge_reasoning = f"Judge LLM unreachable ({type(e).__name__}); defaulting to valid."
        state.tool_call_errors += 1
        return state
    if not raw:
        # Empty response (Qwen sometimes returns thinking-only with empty content
        # despite our normalisation). Conservative: assume still valid.
        state.is_still_valid = True
        state.judge_reasoning = "Judge LLM returned empty content; defaulting to valid."
        return state
    # Strip <think>…</think>, ```json fences, then parse.
    import re as _re
    s = _re.sub(r"<think>.*?</think>", "", raw, flags=_re.DOTALL).strip()
    s = _re.sub(r"^```(?:json)?\s*", "", s)
    s = _re.sub(r"\s*```$", "", s).strip()
    try:
        data = json.loads(s)
    except json.JSONDecodeError:
        # Conservative: if judge can't speak JSON, assume still valid and let apply_fix decide
        state.is_still_valid = True
        state.judge_reasoning = "Judge LLM returned non-JSON; defaulting to valid."
        return state
    state.is_still_valid = bool(data.get("is_still_valid"))
    state.judge_reasoning = data.get("reasoning", "")
    return state
