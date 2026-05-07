"""Tests for findings extractor (Phase 1)."""
from __future__ import annotations
from unittest.mock import patch
import pytest
from pathlib import Path
from findings.extract_findings import extract_from_review, write_finding_files


SAMPLE_REVIEW = """# Review: architecture

## Critical
- **useRef für Subscriptions** in `src/core/contexts/RepositoryContext.tsx:33`
  Cleanup-Problem bei Re-Renders.
"""

# A mocked LLM extraction returns structured findings.
MOCK_LLM_OUTPUT = '''[
  {
    "severity": "high",
    "area": "architecture",
    "title": "useRef für Subscriptions ohne Cleanup",
    "file": "src/core/contexts/RepositoryContext.tsx",
    "lines": "33",
    "effort": "1h",
    "problem": "useRef könnte Cleanup-Probleme bei Re-Renders haben",
    "reproduction": "grep -n 'supabaseLiveMatchRepoRef' src/core/contexts/RepositoryContext.tsx",
    "fix_proposal": "useEffect cleanup logic verifizieren oder durch state ersetzen",
    "acceptance_criteria": [
      "RepositoryContext rendert ohne useRef für Subscriptions",
      "Tests verifizieren Cleanup bei Unmount"
    ]
  }
]'''


def test_extract_from_review_yields_findings():
    with patch("findings.extract_findings._call_llm_extract") as mock_call:
        mock_call.return_value = MOCK_LLM_OUTPUT
        findings = extract_from_review(SAMPLE_REVIEW, source="reviews/test.md")
    assert len(findings) == 1
    assert findings[0].severity.value == "high"
    assert findings[0].file.endswith("RepositoryContext.tsx")
    assert findings[0].id.startswith("F-")
    assert len(findings[0].acceptance_criteria) >= 1


def test_write_finding_files_creates_index_and_per_finding(tmp_path, sample_finding_dict):
    from findings.lib.models import Finding
    sample_finding_dict["acceptance_criteria"] = ["AK1", "AK2"]
    f = Finding(**sample_finding_dict)
    write_finding_files([f], findings_dir=tmp_path)

    assert (tmp_path / "F-001.md").exists()
    assert (tmp_path / "INDEX.md").exists()
    index_text = (tmp_path / "INDEX.md").read_text()
    assert "F-001" in index_text
