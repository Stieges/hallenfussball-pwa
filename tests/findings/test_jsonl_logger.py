"""Tests for JSONL logger (.claude/logs/finding-fixes.jsonl)."""
from __future__ import annotations
import json
import pytest
from pathlib import Path
from findings.lib.jsonl_logger import JsonlLogger


def test_logger_appends_jsonl_line(tmp_path):
    log_path = tmp_path / "test.jsonl"
    logger = JsonlLogger(log_path)
    logger.log({"finding_id": "F-001", "model": "qwen", "tokens_in": 100})

    content = log_path.read_text()
    assert content.endswith("\n")
    parsed = json.loads(content.strip())
    assert parsed["finding_id"] == "F-001"
    assert "timestamp" in parsed


def test_logger_creates_parent_dirs(tmp_path):
    log_path = tmp_path / "deeply" / "nested" / "log.jsonl"
    logger = JsonlLogger(log_path)
    logger.log({"x": 1})
    assert log_path.exists()


def test_logger_appends_multiple_entries(tmp_path):
    log_path = tmp_path / "log.jsonl"
    logger = JsonlLogger(log_path)
    logger.log({"a": 1})
    logger.log({"b": 2})

    lines = log_path.read_text().strip().split("\n")
    assert len(lines) == 2
    assert json.loads(lines[0])["a"] == 1
    assert json.loads(lines[1])["b"] == 2
