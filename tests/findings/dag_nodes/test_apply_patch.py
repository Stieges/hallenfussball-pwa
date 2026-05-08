"""Tests for apply_patch DAG node.

Uses real code_patcher + real tmp files (no LLM, no mocking).

Run with:
    PYTHONPATH=scripts python3 -m pytest tests/findings/dag_nodes/test_apply_patch.py -v
"""
from __future__ import annotations

import pytest

from findings.dag_nodes.apply_patch import apply_patch
from findings.lib.models import FindingFixState, Finding, Severity, Status, ModelChoice


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_state(planned_changes: list, path_resolved: str = "src/x.ts") -> FindingFixState:
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
        acceptance_criteria=["Button has aria-label"],
    )
    return FindingFixState(
        finding=finding,
        routing=ModelChoice(provider="aihub", model="qwen3-coder-480b"),
        path_resolved=path_resolved,
        path_resolution_method="exact",
        file_contents={},
        is_still_valid=True,
        planned_changes=planned_changes,
    )


ORIGINAL_CODE = '<button onClick={fn}>X</button>\n'
EXPECTED_CODE = '<button aria-label="Close" onClick={fn}>X</button>\n'


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_apply_patch_happy_path(tmp_path):
    """replace_text operation should produce correct patched_content and write file."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "x.ts").write_text(ORIGINAL_CODE)

    changes = [
        {
            "typ": "replace_text",
            "find": '<button onClick={fn}>X</button>',
            "replace": '<button aria-label="Close" onClick={fn}>X</button>',
        }
    ]
    state = _make_state(changes)
    state = apply_patch(state, repo_root=tmp_path)

    assert state.fix_applied is True
    assert state.patched_content == EXPECTED_CODE
    assert (tmp_path / "src" / "x.ts").read_text() == EXPECTED_CODE
    assert state.patch_errors == []


def test_apply_patch_empty_planned_changes(tmp_path):
    """Empty planned_changes: fix_applied=False, no file write."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "x.ts").write_text(ORIGINAL_CODE)

    state = _make_state([])
    state = apply_patch(state, repo_root=tmp_path)

    assert state.fix_applied is False
    # File should be unchanged
    assert (tmp_path / "src" / "x.ts").read_text() == ORIGINAL_CODE


def test_apply_patch_missing_file(tmp_path):
    """When target file doesn't exist: fix_applied=False, patch_errors populated."""
    changes = [{"typ": "replace_text", "find": "x", "replace": "y"}]
    state = _make_state(changes, path_resolved="src/missing.ts")
    state = apply_patch(state, repo_root=tmp_path)

    assert state.fix_applied is False
    assert any("not found" in e for e in state.patch_errors)


def test_apply_patch_operation_error_leaves_file_unchanged(tmp_path):
    """When replace_text find-string is not found: file must NOT be modified."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "x.ts").write_text(ORIGINAL_CODE)

    changes = [{"typ": "replace_text", "find": "DOES_NOT_EXIST", "replace": "nope"}]
    state = _make_state(changes)
    state = apply_patch(state, repo_root=tmp_path)

    assert state.fix_applied is False
    # Errors should explain what went wrong
    assert len(state.patch_errors) > 0
    # File must be unchanged (atomicity guarantee from code_patcher)
    assert (tmp_path / "src" / "x.ts").read_text() == ORIGINAL_CODE


def test_apply_patch_sets_patched_content_and_fix_applied(tmp_path):
    """Verify both fix_applied=True and patched_content are set on success."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "x.ts").write_text("const x = 1;\n")

    changes = [{"typ": "replace_text", "find": "const x = 1;", "replace": "const x = 42;"}]
    state = _make_state(changes)
    state = apply_patch(state, repo_root=tmp_path)

    assert state.fix_applied is True
    assert state.patched_content is not None
    assert "42" in state.patched_content


def test_apply_patch_append_operation(tmp_path):
    """append_to_file operation appends text to file."""
    src = tmp_path / "src"
    src.mkdir()
    (src / "x.ts").write_text("const x = 1;\n")

    changes = [{"typ": "append_to_file", "text": "// end of file\n"}]
    state = _make_state(changes)
    state = apply_patch(state, repo_root=tmp_path)

    assert state.fix_applied is True
    content = (tmp_path / "src" / "x.ts").read_text()
    assert content.endswith("// end of file\n")
