"""Tests for review freshness validation (Phase 0a)."""
from __future__ import annotations
import pytest
from pathlib import Path
from findings.validate_review_freshness import find_stale_files_in_reviews


def test_finds_files_referenced_in_review_that_changed_since(tmp_path):
    review = tmp_path / "review.md"
    review.write_text(
        "Some text\n"
        "- **Datei:** `src/foo.ts`\n"
        "- Issue in `src/bar.ts:42`\n"
    )
    changed_files = ["src/foo.ts"]

    stale = find_stale_files_in_reviews([review], changed_files)
    assert "src/foo.ts" in stale
    assert "src/bar.ts" not in stale


def test_no_stale_when_only_unrelated_files_changed(tmp_path):
    review = tmp_path / "review.md"
    review.write_text("Issue in `src/foo.ts`\n")
    changed = ["src/unrelated.ts"]
    stale = find_stale_files_in_reviews([review], changed)
    assert stale == set()
