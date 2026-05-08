"""Tests for verify_path DAG node."""
from __future__ import annotations
import pytest
from findings.dag_nodes.verify_path import verify_path
from findings.lib.models import FindingFixState, Finding, Severity, Status, ModelChoice


def _state(file_path: str) -> FindingFixState:
    finding = Finding(
        id="F-001", severity=Severity.LOW, area="ux", title="t", file=file_path,
        status=Status.OPEN, source="r", detected="2026-05-07", related=[],
        acceptance_criteria=[],
    )
    return FindingFixState(finding=finding, routing=ModelChoice(provider="aihub", model="qwen-3.5-122b-sovereign"))


def test_exact_path_match(tmp_path):
    target = tmp_path / "src" / "exists.ts"
    target.parent.mkdir(parents=True)
    target.write_text("// exists")
    state = _state(str(target.relative_to(tmp_path)))
    state = verify_path(state, repo_root=tmp_path)
    assert state.path_resolved == str(target.relative_to(tmp_path))
    assert state.path_resolution_method == "exact"


def test_symbol_search_fallback(tmp_path):
    """When path doesn't exist, but symbol can be found via grep."""
    real_file = tmp_path / "src" / "actual.ts"
    real_file.parent.mkdir(parents=True)
    real_file.write_text("export function generateRoundRobinPairings() {}")

    finding = Finding(
        id="F-001", severity=Severity.LOW, area="ux", title="missing path",
        file="src/wrong/path.ts:generateRoundRobinPairings",
        status=Status.OPEN, source="r", detected="2026-05-07", related=[],
        acceptance_criteria=[],
    )
    state = FindingFixState(finding=finding, routing=ModelChoice(provider="aihub", model="x"))
    state = verify_path(state, repo_root=tmp_path)
    assert state.path_resolution_method == "symbol_search"
    assert "actual.ts" in state.path_resolved


def test_failed_when_neither_path_nor_symbol_found(tmp_path):
    state = _state("src/does_not_exist.ts:totally_missing_func")
    state = verify_path(state, repo_root=tmp_path)
    assert state.path_resolution_method == "failed"
