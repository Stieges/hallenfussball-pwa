"""Severity → Modell routing with auto-fallback (Spec 4.2, 4.3)."""
from __future__ import annotations
from .models import Severity, Finding, ModelChoice


def parse_model_override(spec: str) -> ModelChoice:
    """Parse 'claude-opus-4-6' or 'qwen-3.5-122b-sovereign' into ModelChoice."""
    if spec.startswith("claude-"):
        return ModelChoice(
            provider="claude",
            model=spec[len("claude-"):],
            require_human_review="opus" in spec,
        )
    return ModelChoice(provider="aihub", model=spec, require_human_review=False)


def route_finding_fix(finding: Finding) -> ModelChoice:
    """Default routing per Spec 4.1, with explicit `model_routing` override."""
    if finding.model_routing:
        return parse_model_override(finding.model_routing)

    if finding.severity == Severity.CRITICAL:
        return ModelChoice(provider="claude", model="opus-4-6", require_human_review=True)
    elif finding.severity == Severity.HIGH:
        return ModelChoice(provider="claude", model="sonnet-4-6", require_human_review=False)
    else:  # MEDIUM or LOW
        # qwen-3.6-35b-sovereign is the SWE-Bench/Terminal-Bench leader among
        # sovereign Qwen models (35B/A3B beats 122B/A10B on coding tasks per
        # 2026 benchmarks: SWE-Bench Verified 73.4 ≈, Terminal-Bench 51.5 vs 40.5).
        # Smaller active footprint (3B) → faster than 3.5-122b at thinking-mode.
        return ModelChoice(provider="aihub", model="qwen-3.6-35b-sovereign", require_human_review=False)


def fallback_for(routing: ModelChoice) -> ModelChoice | None:
    """Auto-fallback target on tool-fail (Spec 4.3).

    Strategy: stay within AI Hub for the first fallback (Sovereign-first), escalate
    to Anthropic only if the AI Hub code-specialist also fails. Keeps `anthropic`
    SDK as an optional dependency — only loaded when severity HIGH/CRITICAL or an
    explicit per-finding model_routing override targets claude-*.

    aihub/qwen-3.5-122b-sovereign → aihub/qwen3-coder-480b (paid, code-tuned)
    aihub/qwen3-coder-480b → claude/haiku-4-5 (last resort, requires anthropic)
    claude/* → no fallback
    """
    if routing.provider == "aihub":
        if routing.model.startswith("qwen3-coder"):
            return ModelChoice(provider="claude", model="haiku-4-5", require_human_review=False)
        return ModelChoice(provider="aihub", model="qwen3-coder-480b", require_human_review=False)
    return None
