"""Integration tests for the finding_fix orchestrator (DAG)."""
from __future__ import annotations
from unittest.mock import patch
import pytest
from pathlib import Path
from findings.finding_fix import run_finding_fix
from findings.lib.models import Severity


def test_full_pipeline_low_severity_with_mocked_llm(tmp_path):
    # Setup: minimal repo with a finding
    findings = tmp_path / "docs" / "findings"
    findings.mkdir(parents=True)
    (findings / "F-001.md").write_text(
        "---\nid: F-001\nseverity: low\narea: ux\ntitle: test\nfile: src/x.ts\n"
        "status: open\nsource: reviews/r.md\ndetected: 2026-05-07\nrelated: []\n"
        "acceptance_criteria: []\n---\n\nbody\n"
    )
    src = tmp_path / "src" / "x.ts"
    src.parent.mkdir(parents=True)
    src.write_text("let x = 1;\n")

    with patch("findings.dag_nodes.judge_necessity._call_judge_llm") as mock_judge, \
         patch("findings.dag_nodes.apply_fix._call_apply_llm") as mock_apply, \
         patch("findings.dag_nodes.run_tests.subprocess.run") as mock_run:
        mock_judge.return_value = '{"is_still_valid": true, "reasoning": "yes"}'
        mock_apply.return_value = '{"new_content": "const x = 1;\\n", "diff": "diff"}'
        from unittest.mock import MagicMock
        mock_run.return_value = MagicMock(returncode=0, stdout="ok", stderr="")

        result = run_finding_fix(
            finding_id="F-001",
            findings_dir=findings,
            repo_root=tmp_path,
        )

    assert result.fix_applied is True
    assert result.tests_pass is True
    # The status should be flipped to 'fixed'
    text = (findings / "F-001.md").read_text()
    assert "status: fixed" in text


def test_fallback_kicks_in_after_aihub_failure(tmp_path):
    findings = tmp_path / "docs" / "findings"
    findings.mkdir(parents=True)
    (findings / "F-002.md").write_text(
        "---\nid: F-002\nseverity: medium\narea: ux\ntitle: t\nfile: src/y.ts\n"
        "status: open\nsource: reviews/r.md\ndetected: 2026-05-07\nrelated: []\n"
        "acceptance_criteria: [AK1]\n---\n\nbody\n"
    )
    src = tmp_path / "src" / "y.ts"
    src.parent.mkdir(parents=True)
    src.write_text("a")

    # Simulate aihub failure → fallback to claude haiku
    with patch("findings.dag_nodes.apply_fix._call_apply_llm") as mock_apply, \
         patch("findings.dag_nodes.judge_necessity._call_judge_llm") as mock_judge, \
         patch("findings.dag_nodes.run_tests.subprocess.run") as mock_run:
        # First call (aihub) fails JSON parse, second call (haiku) succeeds
        mock_apply.side_effect = ["INVALID JSON", '{"new_content":"b","diff":""}']
        mock_judge.return_value = '{"is_still_valid": true, "reasoning":"y"}'
        from unittest.mock import MagicMock
        mock_run.return_value = MagicMock(returncode=0, stdout="ok", stderr="")

        result = run_finding_fix(finding_id="F-002", findings_dir=findings, repo_root=tmp_path)

    assert result.fallback_used is True
