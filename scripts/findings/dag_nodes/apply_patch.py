"""DAG node: apply state.planned_changes to the target file using the local patcher.

Pure local — NO LLM call.  Uses code_patcher.apply_changes (deterministic).
Implements the "apply" step of the Belegflow-pattern pipeline:

    plan_changes (LLM)  →  apply_patch (LOCAL)  →  review_patch (LLM)

This separation guarantees that the LLM never writes files directly:
it only produces structured change operations, which a deterministic
code patcher applies and a reviewer LLM then validates.
"""
from __future__ import annotations

from pathlib import Path

from ..lib.code_patcher import apply_changes
from ..lib.models import FindingFixState


def apply_patch(state: FindingFixState, *, repo_root: str | Path) -> FindingFixState:
    """Apply state.planned_changes to the file at repo_root / state.path_resolved.

    Pre-conditions (from upstream nodes):
    - state.planned_changes contains at least one operation dict (from plan_changes)
    - state.path_resolved is set and points to an existing file within repo_root

    Outputs written to state:
    - state.fix_applied: True if patch succeeded, False otherwise
    - state.patched_content: new file content (str) when fix_applied is True
    - state.patch_warnings: list of non-fatal warnings from the patcher
    - state.patch_errors: list of error messages when fix_applied is False
    """
    if not state.planned_changes:
        state.fix_applied = False
        return state

    repo_root = Path(repo_root)

    if not state.path_resolved:
        state.fix_applied = False
        state.patch_errors = ["path_resolved is not set"]
        return state

    target = repo_root / state.path_resolved
    if not target.is_file():
        state.fix_applied = False
        state.patch_errors = [f"Target file not found: {state.path_resolved}"]
        return state

    file_content = target.read_text(encoding="utf-8")
    result = apply_changes(file_content, state.planned_changes, file_path=state.path_resolved)

    state.patch_warnings = result.warnings

    if result.success:
        target.write_text(result.new_content, encoding="utf-8")
        state.patched_content = result.new_content
        state.fix_applied = True
        state.patch_errors = []
    else:
        state.fix_applied = False
        state.patch_errors = result.errors

    return state
