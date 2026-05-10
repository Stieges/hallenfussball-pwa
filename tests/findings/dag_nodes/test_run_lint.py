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


def test_run_lint_skips_for_non_js_extensions():
    state = _state(fix_applied=True, path="docs/some.md")
    with patch("findings.dag_nodes.run_lint.subprocess.run") as mock_run:
        state = run_lint(state, repo_root="/tmp")
    assert state.lint_passed is None
    mock_run.assert_not_called()


def test_run_lint_sets_lint_passed_true_on_zero_exit():
    state = _state(fix_applied=True, path="src/hooks/foo.ts")
    with patch("findings.dag_nodes.run_lint.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        state = run_lint(state, repo_root="/tmp")
    assert state.lint_passed is True
    assert state.review_verdict is None  # downstream review_patch still runs
    mock_run.assert_called_once()
    call_args = mock_run.call_args
    assert call_args[0][0] == ["npx", "eslint", "--max-warnings", "0", "src/hooks/foo.ts"]
    assert call_args[1]["timeout"] == 60
