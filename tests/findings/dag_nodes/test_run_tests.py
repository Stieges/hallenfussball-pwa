"""Tests for run_tests DAG node."""
from __future__ import annotations
from unittest.mock import patch, MagicMock
from findings.dag_nodes.run_tests import run_tests
from findings.lib.models import FindingFixState, Finding, Severity, Status, ModelChoice


def _state_post_fix():
    finding = Finding(
        id="F-001", severity=Severity.LOW, area="ux", title="t", file="src/x.ts",
        status=Status.OPEN, source="r", detected="2026-05-07", related=[], acceptance_criteria=[],
    )
    s = FindingFixState(
        finding=finding,
        routing=ModelChoice(provider="aihub", model="x"),
        fix_applied=True,
    )
    return s


def test_run_tests_passes_on_zero_exit():
    state = _state_post_fix()
    with patch("findings.dag_nodes.run_tests.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="all good", stderr="")
        state = run_tests(state, repo_root="/tmp")
    assert state.tests_pass is True


def test_run_tests_fails_on_nonzero_exit():
    state = _state_post_fix()
    with patch("findings.dag_nodes.run_tests.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stdout="FAIL", stderr="error")
        state = run_tests(state, repo_root="/tmp")
    assert state.tests_pass is False


def test_run_tests_skips_if_no_fix_applied():
    state = _state_post_fix()
    state.fix_applied = False
    state = run_tests(state, repo_root="/tmp")
    assert state.tests_pass is None
