"""Pytest fixtures for findings tests."""
from __future__ import annotations
import pytest
from pathlib import Path

@pytest.fixture
def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent

@pytest.fixture
def sample_finding_dict() -> dict:
    return {
        "id": "F-001",
        "severity": "high",
        "area": "architecture",
        "title": "Test Finding",
        "file": "src/example.ts",
        "lines": "10-20",
        "effort": "1h",
        "status": "open",
        "source": "reviews/test.md",
        "detected": "2026-05-07",
        "fixed_at": None,
        "fixed_in_commit": None,
        "related": [],
        "parent": None,
        "model_routing": None,
    }
