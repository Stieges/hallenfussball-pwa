"""Tests for findings.lib.json_extract — robust JSON extraction from LLM output.

Run with:
    PYTHONPATH=scripts python3 -m pytest tests/findings/lib/test_json_extract.py -v
"""
from __future__ import annotations

import pytest

from findings.lib.json_extract import extract_json


# ---------------------------------------------------------------------------
# Happy paths
# ---------------------------------------------------------------------------

def test_extract_direct_json():
    raw = '{"verdict": "APPROVED", "reasoning": "looks good"}'
    result = extract_json(raw)
    assert result == {"verdict": "APPROVED", "reasoning": "looks good"}


def test_extract_json_in_code_fence():
    raw = '```json\n{"key": "value"}\n```'
    result = extract_json(raw)
    assert result == {"key": "value"}


def test_extract_json_in_plain_fence():
    raw = '```\n{"key": "value"}\n```'
    result = extract_json(raw)
    assert result == {"key": "value"}


def test_extract_json_after_think_block():
    raw = (
        "<think>I need to think about this carefully...</think>\n"
        '{"analyse": "the fix", "aenderungen": []}'
    )
    result = extract_json(raw)
    assert result == {"analyse": "the fix", "aenderungen": []}


def test_extract_json_with_surrounding_text():
    raw = 'Here is my answer:\n{"verdict": "REJECTED"}\nThat is all.'
    result = extract_json(raw)
    assert result == {"verdict": "REJECTED"}


def test_extract_json_with_nested_object():
    raw = '{"outer": {"inner": 42}, "list": [1, 2, 3]}'
    result = extract_json(raw)
    assert result == {"outer": {"inner": 42}, "list": [1, 2, 3]}


# ---------------------------------------------------------------------------
# Error / edge-case paths
# ---------------------------------------------------------------------------

def test_extract_returns_none_for_empty_string():
    assert extract_json("") is None


def test_extract_returns_none_for_no_json():
    assert extract_json("This is just plain text without any JSON.") is None


def test_extract_returns_none_for_invalid_json():
    assert extract_json("{not valid json}") is None


def test_extract_ignores_json_arrays_at_top_level():
    # We only extract dict objects, not bare arrays
    raw = '[1, 2, 3]'
    # extract_json looks for '{' — this has none, so returns None
    assert extract_json(raw) is None


def test_think_block_with_fenced_json():
    raw = (
        "<think>reasoning here</think>\n"
        "```json\n"
        '{"verdict": "NEEDS_HUMAN", "reasoning": "edge case"}\n'
        "```"
    )
    result = extract_json(raw)
    assert result == {"verdict": "NEEDS_HUMAN", "reasoning": "edge case"}


# ---------------------------------------------------------------------------
# Recovery-2: prose-leaked thinking output (Qwen-3.6 leakage)
# ---------------------------------------------------------------------------

def test_extract_strips_thinking_process_preamble():
    """Qwen-3.6 sometimes prefixes the JSON with 'Here's a thinking process:' prose."""
    raw = (
        "Here's a thinking process:\n\n"
        "1. **Analyze the User Input:**\n"
        "   - **Finding:** \"Schwacher Fallback\"\n\n"
        '{"analyse": "fix the fallback", "aenderungen": []}'
    )
    result = extract_json(raw)
    assert result == {"analyse": "fix the fallback", "aenderungen": []}


def test_extract_strips_okay_so_preamble():
    """Other prose preambles (\"Okay, so...\", \"Let me think...\") also handled."""
    raw = (
        "Okay, so the user wants me to plan changes for this finding. "
        "Let me think about what to do.\n\n"
        '{"verdict": "APPROVED", "reasoning": "looks fine", "concerns": []}'
    )
    result = extract_json(raw)
    assert result == {"verdict": "APPROVED", "reasoning": "looks fine", "concerns": []}


def test_extract_handles_pure_json_unchanged():
    """Regression: pure JSON (no prose preamble) still parses identically."""
    raw = '{"x": 1, "y": "two"}'
    result = extract_json(raw)
    assert result == {"x": 1, "y": "two"}


def test_extract_returns_none_for_pure_prose():
    """Pure prose with no `{` or `[` anywhere → None (existing behaviour)."""
    raw = "This is just thinking out loud without any JSON structure at all."
    assert extract_json(raw) is None
