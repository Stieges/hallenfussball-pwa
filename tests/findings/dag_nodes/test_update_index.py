"""Tests for update_index DAG node."""
from __future__ import annotations
import yaml
from findings.dag_nodes.update_index import update_finding_status
from findings.lib.models import Status


def test_update_finding_status_sets_fixed_with_commit(tmp_path):
    f = tmp_path / "F-001.md"
    f.write_text("---\nid: F-001\nstatus: open\n---\n\nbody\n")
    update_finding_status(f, status=Status.FIXED, commit_sha="abc1234")

    text = f.read_text()
    fm_yaml = text.split("---")[1]
    fm = yaml.safe_load(fm_yaml)
    assert fm["status"] == "fixed"
    assert fm["fixed_in_commit"] == "abc1234"
    assert fm["fixed_at"] is not None
