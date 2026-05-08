"""Integration tests for the finding_fix orchestrator (DAG)."""
from __future__ import annotations
from unittest.mock import patch, MagicMock
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
         patch("findings.dag_nodes.plan_changes._call_plan_llm") as mock_plan, \
         patch("findings.dag_nodes.review_patch._call_review_llm") as mock_review, \
         patch("findings.dag_nodes.run_tests.subprocess.run") as mock_run:
        mock_judge.return_value = '{"is_still_valid": true, "reasoning": "yes"}'
        mock_plan.return_value = (
            '{"analyse": "test fix", "aenderungen": ['
            '{"typ": "replace_text", "find": "let x = 1;", "replace": "const x = 1;"}'
            ']}'
        )
        mock_review.return_value = '{"verdict": "APPROVED", "reasoning": "looks good"}'
        mock_run.return_value = MagicMock(returncode=0, stdout="ok", stderr="")

        result = run_finding_fix(
            finding_id="F-001",
            findings_dir=findings,
            repo_root=tmp_path,
        )

    assert result.fix_applied is True
    assert result.tests_pass is True
    assert result.review_verdict == "APPROVED"
    # File content should have changed
    assert src.read_text() == "const x = 1;\n"
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
    src.write_text("let a = 1;\n")

    # Simulate aihub failure in plan_changes → fallback to claude haiku re-runs plan
    with patch("findings.dag_nodes.plan_changes._call_plan_llm") as mock_plan, \
         patch("findings.dag_nodes.judge_necessity._call_judge_llm") as mock_judge, \
         patch("findings.dag_nodes.review_patch._call_review_llm") as mock_review, \
         patch("findings.dag_nodes.run_tests.subprocess.run") as mock_run:
        # First call (aihub) fails JSON parse, second call (fallback) succeeds
        mock_plan.side_effect = [
            "INVALID JSON",
            '{"analyse": "fix", "aenderungen": [{"typ": "replace_text", "find": "let a = 1;", "replace": "const a = 1;"}]}',
        ]
        mock_judge.return_value = '{"is_still_valid": true, "reasoning":"y"}'
        mock_review.return_value = '{"verdict": "APPROVED", "reasoning": "looks good"}'
        mock_run.return_value = MagicMock(returncode=0, stdout="ok", stderr="")

        result = run_finding_fix(finding_id="F-002", findings_dir=findings, repo_root=tmp_path)

    assert result.fallback_used is True


def test_dag_timeout_aborts_long_running_step(tmp_path, monkeypatch):
    """R7: HARD_TIMEOUT_S must abort a hanging LLM call."""
    import time
    findings = tmp_path / "docs" / "findings"
    findings.mkdir(parents=True)
    (findings / "F-003.md").write_text(
        "---\nid: F-003\nseverity: low\narea: ux\ntitle: t\nfile: src/z.ts\n"
        "status: open\nsource: reviews/r.md\ndetected: 2026-05-07\nrelated: []\n"
        "acceptance_criteria: []\n---\n\nbody\n"
    )
    src = tmp_path / "src" / "z.ts"
    src.parent.mkdir(parents=True)
    src.write_text("a")

    # Force tiny timeout so the test does not take 300s
    monkeypatch.setattr("findings.finding_fix.HARD_TIMEOUT_S", 0.5)

    from unittest.mock import patch

    def slow_judge(*args, **kwargs):
        time.sleep(2.0)  # exceeds the patched HARD_TIMEOUT_S of 0.5s
        return '{"is_still_valid": true, "reasoning": "slow"}'

    with patch("findings.dag_nodes.judge_necessity._call_judge_llm", side_effect=slow_judge):
        from findings.finding_fix import run_finding_fix
        result = run_finding_fix(finding_id="F-003", findings_dir=findings, repo_root=tmp_path)

    # The slow judge should have been timed out; tool_call_errors incremented
    assert result.tool_call_errors >= 1
    # Fix should NOT have been applied (timeout aborted before plan_changes)
    assert result.fix_applied is False


def test_review_rejected_skips_tests(tmp_path):
    """When review_patch returns REJECTED, run_tests must NOT be called."""
    findings = tmp_path / "docs" / "findings"
    findings.mkdir(parents=True)
    (findings / "F-004.md").write_text(
        "---\nid: F-004\nseverity: low\narea: ux\ntitle: test rejected\nfile: src/w.ts\n"
        "status: open\nsource: reviews/r.md\ndetected: 2026-05-07\nrelated: []\n"
        "acceptance_criteria: []\n---\n\nbody\n"
    )
    src = tmp_path / "src" / "w.ts"
    src.parent.mkdir(parents=True)
    src.write_text("let w = 1;\n")

    with patch("findings.dag_nodes.judge_necessity._call_judge_llm") as mock_judge, \
         patch("findings.dag_nodes.plan_changes._call_plan_llm") as mock_plan, \
         patch("findings.dag_nodes.review_patch._call_review_llm") as mock_review, \
         patch("findings.dag_nodes.run_tests.subprocess.run") as mock_run:
        mock_judge.return_value = '{"is_still_valid": true, "reasoning": "yes"}'
        mock_plan.return_value = (
            '{"analyse": "test fix", "aenderungen": ['
            '{"typ": "replace_text", "find": "let w = 1;", "replace": "const w = 1;"}'
            ']}'
        )
        mock_review.return_value = '{"verdict": "REJECTED", "reasoning": "patch is wrong"}'

        result = run_finding_fix(
            finding_id="F-004",
            findings_dir=findings,
            repo_root=tmp_path,
        )

    # Review rejected → tests must NOT have been run
    mock_run.assert_not_called()
    assert result.review_verdict == "REJECTED"
    # fix_applied is True (patch was applied), but tests_pass is None
    assert result.fix_applied is True
    assert result.tests_pass is None
