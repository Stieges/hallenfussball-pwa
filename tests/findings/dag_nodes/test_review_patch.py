"""Tests for review_patch DAG node."""
from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from findings.dag_nodes.review_patch import review_patch
from findings.lib.models import FindingFixState, Finding, Severity, Status, ModelChoice


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_state(fix_applied: bool = True) -> FindingFixState:
    finding = Finding(
        id="F-042",
        severity=Severity.HIGH,
        area="a11y",
        title="Button lacks aria-label",
        file="src/x.ts",
        status=Status.OPEN,
        source="reviews/r.md",
        detected="2026-05-07",
        related=[],
        acceptance_criteria=["Button has aria-label attribute"],
    )
    return FindingFixState(
        finding=finding,
        routing=ModelChoice(provider="aihub", model="qwen3-coder-480b"),
        path_resolved="src/x.ts",
        path_resolution_method="exact",
        file_contents={},
        is_still_valid=True,
        fix_applied=fix_applied,
        planned_changes=[
            {
                "typ": "replace_text",
                "find": '<button onClick={fn}>X</button>',
                "replace": '<button aria-label="Close" onClick={fn}>X</button>',
            }
        ],
        patched_content='<button aria-label="Close" onClick={fn}>X</button>\n',
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_review_patch_approved(tmp_path):
    """When LLM returns APPROVED verdict, state reflects it."""
    state = _make_state()
    response = json.dumps({"verdict": "APPROVED", "reasoning": "All ACs met.", "concerns": []})

    with patch("findings.dag_nodes.review_patch._call_review_llm") as mock_llm:
        mock_llm.return_value = response
        state = review_patch(state)

    assert state.review_verdict == "APPROVED"
    assert "ACs met" in state.review_reasoning
    assert state.tool_call_errors == 0


def test_review_patch_rejected(tmp_path):
    """When LLM returns REJECTED, state.review_verdict == REJECTED."""
    state = _make_state()
    response = json.dumps({"verdict": "REJECTED", "reasoning": "aria-label still missing."})

    with patch("findings.dag_nodes.review_patch._call_review_llm") as mock_llm:
        mock_llm.return_value = response
        state = review_patch(state)

    assert state.review_verdict == "REJECTED"


def test_review_patch_needs_human_on_aihub_error():
    """AIHubError should produce NEEDS_HUMAN verdict and increment error counter."""
    from findings.lib.aihub_client import AIHubError

    state = _make_state()
    with patch("findings.dag_nodes.review_patch._call_review_llm") as mock_llm:
        mock_llm.side_effect = AIHubError("503 gateway timeout")
        state = review_patch(state)

    assert state.review_verdict == "NEEDS_HUMAN"
    assert state.tool_call_errors == 1
    assert "AIHubError" in state.review_reasoning


def test_review_patch_needs_human_on_unparseable_response():
    """If the LLM returns non-JSON, verdict must be NEEDS_HUMAN."""
    state = _make_state()
    with patch("findings.dag_nodes.review_patch._call_review_llm") as mock_llm:
        mock_llm.return_value = "I cannot parse this."
        state = review_patch(state)

    assert state.review_verdict == "NEEDS_HUMAN"
    assert state.tool_call_errors == 1


def test_review_patch_skips_when_fix_not_applied():
    """If fix_applied=False, review should return NEEDS_HUMAN without calling LLM."""
    state = _make_state(fix_applied=False)
    with patch("findings.dag_nodes.review_patch._call_review_llm") as mock_llm:
        state = review_patch(state)
        mock_llm.assert_not_called()

    assert state.review_verdict == "NEEDS_HUMAN"
    assert "fix_applied=False" in state.review_reasoning
