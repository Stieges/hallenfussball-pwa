"""Tests for apply_fix DAG node."""
from __future__ import annotations
from unittest.mock import patch
import pytest
from findings.dag_nodes.apply_fix import apply_fix
from findings.lib.models import FindingFixState, Finding, Severity, Status, ModelChoice


def _ready_state():
    finding = Finding(
        id="F-001", severity=Severity.HIGH, area="data", title="title",
        file="src/x.ts", status=Status.OPEN, source="r", detected="2026-05-07",
        related=[], acceptance_criteria=["AK1"],
    )
    return FindingFixState(
        finding=finding,
        routing=ModelChoice(provider="claude", model="sonnet-4-6"),
        path_resolved="src/x.ts",
        path_resolution_method="exact",
        file_contents={"src/x.ts": "let x = 1;\n"},
        is_still_valid=True,
    )


def test_apply_fix_writes_diff_to_state(tmp_path):
    src = tmp_path / "src" / "x.ts"
    src.parent.mkdir(parents=True)
    src.write_text("let x = 1;\n")

    state = _ready_state()
    with patch("findings.dag_nodes.apply_fix._call_apply_llm") as mock_call:
        mock_call.return_value = '{"new_content": "const x = 1;\\n", "diff": "-let x\\n+const x"}'
        state = apply_fix(state, repo_root=tmp_path)
    assert state.fix_applied is True
    assert "const x" in src.read_text()
    assert state.fix_diff is not None


def test_apply_fix_skips_when_finding_invalidated():
    state = _ready_state()
    state.is_still_valid = False
    state = apply_fix(state, repo_root="/tmp/dummy")
    assert state.fix_applied is False
