"""DAG node: run ESLint as deterministic Pre-Gate before review_patch.

Rationale: review_patch (LLM reviewer) has shown to halluzinate APPROVED
verdicts on patches that violate react-hooks/exhaustive-deps and similar
rules (see F-037 live-run, 2026-05-10). A deterministic lint check before
the LLM reviewer is invoked prevents this class of False-Positives.

On lint-fail: sets state.review_verdict='NEEDS_HUMAN' directly, signalling
downstream that review_patch should be skipped. On non-JS/TS files or when
fix_applied is False, this node is a no-op.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from ..lib.models import FindingFixState

_LINTABLE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx"}


def run_lint(
    state: FindingFixState, *, repo_root: str | Path, timeout: int = 60
) -> FindingFixState:
    if not state.fix_applied:
        return state
    if not state.path_resolved:
        return state
    ext = Path(state.path_resolved).suffix.lower()
    if ext not in _LINTABLE_EXTENSIONS:
        return state

    repo_root = Path(repo_root)
    try:
        proc = subprocess.run(
            ["npx", "eslint", "--max-warnings", "0", state.path_resolved],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        state.lint_passed = False
        state.lint_output = f"TIMEOUT after {timeout}s"
        state.review_verdict = "NEEDS_HUMAN"
        state.review_reasoning = state.lint_output
        return state

    state.lint_output = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode == 0:
        state.lint_passed = True
        return state

    state.lint_passed = False
    state.review_verdict = "NEEDS_HUMAN"
    state.review_reasoning = (
        f"ESLint failed (exit {proc.returncode}):\n{state.lint_output[:1500]}"
    )
    return state
