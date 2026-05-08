"""Tests for read_affected_files DAG node (D21)."""
from __future__ import annotations
from findings.dag_nodes.read_affected_files import read_affected_files
from findings.lib.models import FindingFixState, Finding, Severity, Status, ModelChoice


def test_reads_resolved_file_into_state(tmp_path):
    target = tmp_path / "src" / "x.ts"
    target.parent.mkdir(parents=True)
    target.write_text("export const HELLO = 1;")
    finding = Finding(
        id="F-001", severity=Severity.LOW, area="ux", title="t", file="src/x.ts",
        status=Status.OPEN, source="r", detected="2026-05-07", related=[],
        acceptance_criteria=[],
    )
    state = FindingFixState(
        finding=finding,
        routing=ModelChoice(provider="aihub", model="x"),
        path_resolved="src/x.ts",
        path_resolution_method="exact",
    )
    state = read_affected_files(state, repo_root=tmp_path)
    assert "src/x.ts" in state.file_contents
    assert "HELLO" in state.file_contents["src/x.ts"]
