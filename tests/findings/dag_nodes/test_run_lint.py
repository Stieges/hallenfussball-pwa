"""Tests for run_lint DAG node (Defense-in-Depth Pre-Gate before review_patch)."""
from __future__ import annotations
from unittest.mock import patch, MagicMock
from findings.dag_nodes.run_lint import run_lint
from findings.lib.models import FindingFixState, Finding, Severity, Status, ModelChoice


def _state(*, fix_applied: bool, path: str = "src/x.ts") -> FindingFixState:
    finding = Finding(
        id="F-001", severity=Severity.LOW, area="ux", title="t", file=path,
        status=Status.OPEN, source="r", detected="2026-05-07", related=[], acceptance_criteria=[],
    )
    s = FindingFixState(
        finding=finding,
        routing=ModelChoice(provider="aihub", model="x"),
        fix_applied=fix_applied,
        path_resolved=path,
    )
    return s


def test_run_lint_skips_if_no_fix_applied():
    state = _state(fix_applied=False)
    with patch("findings.dag_nodes.run_lint.subprocess.run") as mock_run:
        state = run_lint(state, repo_root="/tmp")
    assert state.lint_passed is None
    assert state.review_verdict is None
    mock_run.assert_not_called()
