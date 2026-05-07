"""Tests for git helpers (commit-hash, file-changed-since)."""
from __future__ import annotations
import pytest
import subprocess
from findings.lib.git_helpers import commit_hash_at, files_changed_between


@pytest.mark.integration
def test_commit_hash_at_returns_sha(repo_root):
    sha = commit_hash_at("HEAD", repo=repo_root)
    assert len(sha) == 40 or len(sha) == 7  # full or short


@pytest.mark.integration
def test_files_changed_between_returns_list(repo_root):
    head = commit_hash_at("HEAD", repo=repo_root)
    files = files_changed_between(f"{head}~1", head, repo=repo_root)
    assert isinstance(files, list)
