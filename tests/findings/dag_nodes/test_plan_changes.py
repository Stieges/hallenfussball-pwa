"""Tests for plan_changes DAG node."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from findings.dag_nodes.plan_changes import plan_changes
from findings.lib.models import FindingFixState, Finding, Severity, Status, ModelChoice


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_state(is_still_valid: bool = True, path_resolved: str = "src/x.ts") -> FindingFixState:
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
        acceptance_criteria=["Button has aria-label", "No regression"],
    )
    return FindingFixState(
        finding=finding,
        routing=ModelChoice(provider="aihub", model="qwen3-coder-480b"),
        path_resolved=path_resolved,
        path_resolution_method="exact",
        file_contents={path_resolved: '<button onClick={fn}>X</button>\n'},
        is_still_valid=is_still_valid,
    )


_VALID_LLM_RESPONSE = json.dumps({
    "analyse": "Button fehlt aria-label. Hinzufügen.",
    "aenderungen": [
        {
            "typ": "replace_text",
            "find": '<button onClick={fn}>X</button>',
            "replace": '<button aria-label="Schließen" onClick={fn}>X</button>',
        }
    ],
})


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_plan_changes_happy_path(tmp_path):
    """Happy path: LLM returns valid JSON, state gets planned_changes and plan_analyse."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "x.ts").write_text('<button onClick={fn}>X</button>\n')

    state = _make_state()
    with patch("findings.dag_nodes.plan_changes._call_plan_llm") as mock_llm:
        mock_llm.return_value = _VALID_LLM_RESPONSE
        state = plan_changes(state, repo_root=tmp_path)

    assert len(state.planned_changes) == 1
    assert state.planned_changes[0]["typ"] == "replace_text"
    assert state.plan_analyse == "Button fehlt aria-label. Hinzufügen."
    assert state.tool_call_errors == 0


def test_plan_changes_skips_when_finding_invalidated(tmp_path):
    """When is_still_valid=False, node should early-return with empty planned_changes."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "x.ts").write_text("code\n")

    state = _make_state(is_still_valid=False)
    with patch("findings.dag_nodes.plan_changes._call_plan_llm") as mock_llm:
        state = plan_changes(state, repo_root=tmp_path)
        mock_llm.assert_not_called()

    assert state.planned_changes == []
    assert state.tool_call_errors == 0


def test_plan_changes_increments_errors_on_aihub_error(tmp_path):
    """AIHubError must increment tool_call_errors and leave planned_changes empty."""
    from findings.lib.aihub_client import AIHubError
    src = tmp_path / "src"
    src.mkdir()
    (src / "x.ts").write_text("code\n")

    state = _make_state()
    with patch("findings.dag_nodes.plan_changes._call_plan_llm") as mock_llm:
        mock_llm.side_effect = AIHubError("gateway timeout")
        state = plan_changes(state, repo_root=tmp_path)

    assert state.planned_changes == []
    assert state.tool_call_errors == 1


def test_plan_changes_increments_errors_on_unparseable_json(tmp_path):
    """If the LLM returns non-JSON, tool_call_errors should be incremented."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "x.ts").write_text("code\n")

    state = _make_state()
    with patch("findings.dag_nodes.plan_changes._call_plan_llm") as mock_llm:
        mock_llm.return_value = "Sorry, I cannot help with that."
        state = plan_changes(state, repo_root=tmp_path)

    assert state.planned_changes == []
    assert state.tool_call_errors == 1


def test_plan_changes_increments_errors_when_file_missing(tmp_path):
    """If path_resolved points to a non-existent file, increment tool_call_errors."""
    state = _make_state(path_resolved="src/does_not_exist.ts")
    with patch("findings.dag_nodes.plan_changes._call_plan_llm") as mock_llm:
        state = plan_changes(state, repo_root=tmp_path)
        mock_llm.assert_not_called()

    assert state.planned_changes == []
    assert state.tool_call_errors == 1
