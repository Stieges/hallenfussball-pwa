"""Tests for judge_necessity DAG node."""
from __future__ import annotations
from unittest.mock import patch
import pytest
from findings.dag_nodes.judge_necessity import judge_necessity
from findings.lib.models import FindingFixState, Finding, Severity, Status, ModelChoice


def _state_with_real_code():
    finding = Finding(
        id="F-001", severity=Severity.HIGH, area="data", title="useRef issue",
        file="src/x.ts", status=Status.OPEN, source="r", detected="2026-05-07",
        related=[], acceptance_criteria=["AK1"],
    )
    return FindingFixState(
        finding=finding,
        routing=ModelChoice(provider="claude", model="sonnet-4-6"),
        path_resolved="src/x.ts",
        path_resolution_method="exact",
        file_contents={"src/x.ts": "const x = useRef(); useEffect(() => {});"},
    )


def test_judge_returns_valid_when_llm_says_so():
    state = _state_with_real_code()
    with patch("findings.dag_nodes.judge_necessity._call_judge_llm") as mock_call:
        mock_call.return_value = '{"is_still_valid": true, "reasoning": "issue confirmed"}'
        state = judge_necessity(state)
    assert state.is_still_valid is True
    assert "confirmed" in state.judge_reasoning


def test_judge_returns_invalid_for_obsolete_finding():
    state = _state_with_real_code()
    with patch("findings.dag_nodes.judge_necessity._call_judge_llm") as mock_call:
        mock_call.return_value = '{"is_still_valid": false, "reasoning": "fixed already"}'
        state = judge_necessity(state)
    assert state.is_still_valid is False
