"""Tests for findings.lib.code_patcher — deterministic code patch engine.

Run with:
    PYTHONPATH=scripts python3 -m pytest tests/findings/lib/test_code_patcher.py -v
"""

from __future__ import annotations

import pytest

from findings.lib.code_patcher import apply_changes, PatchResult


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SIMPLE = "let x = 1;\nlet y = 2;\nlet z = 3;\n"

# Five-line fixture used for line-based operations
FIVE_LINES = "line1\nline2\nline3\nline4\nline5\n"


# ---------------------------------------------------------------------------
# replace_text — happy path
# ---------------------------------------------------------------------------

def test_replace_text_happy_path():
    content = "let x = 1;\nlet y = 2;\n"
    result = apply_changes(content, [
        {"typ": "replace_text", "find": "let x = 1;", "replace": "const x = 1;"}
    ])
    assert result.success is True
    assert result.new_content == "const x = 1;\nlet y = 2;\n"
    assert result.applied == 1
    assert result.errors == []


def test_replace_text_multiline_find():
    content = "function foo() {\n  return 1;\n}\n"
    result = apply_changes(content, [
        {"typ": "replace_text", "find": "  return 1;\n", "replace": "  return 42;\n"}
    ])
    assert result.success is True
    assert "return 42;" in result.new_content


# ---------------------------------------------------------------------------
# replace_text — uniqueness constraint
# ---------------------------------------------------------------------------

def test_replace_text_zero_matches_fails():
    result = apply_changes(SIMPLE, [
        {"typ": "replace_text", "find": "DOES_NOT_EXIST", "replace": "nope"}
    ])
    assert result.success is False
    assert result.new_content is None
    assert result.applied == 0
    assert any("0 times" in e for e in result.errors)


def test_replace_text_two_matches_fails():
    content = "foo\nfoo\n"
    result = apply_changes(content, [
        {"typ": "replace_text", "find": "foo", "replace": "bar"}
    ])
    assert result.success is False
    assert result.new_content is None
    assert any("2 times" in e or "must be unique" in e for e in result.errors)


def test_replace_text_three_matches_fails():
    content = "x x x"
    result = apply_changes(content, [
        {"typ": "replace_text", "find": "x", "replace": "y"}
    ])
    assert result.success is False
    assert any("3 times" in e or "must be unique" in e for e in result.errors)


def test_replace_text_empty_find_fails():
    result = apply_changes(SIMPLE, [
        {"typ": "replace_text", "find": "", "replace": "something"}
    ])
    assert result.success is False
    assert result.new_content is None


# ---------------------------------------------------------------------------
# replace_lines — happy path
# ---------------------------------------------------------------------------

def test_replace_lines_single_line():
    result = apply_changes(FIVE_LINES, [
        {"typ": "replace_lines", "line_from": 2, "line_to": 2, "new_text": "replaced\n"}
    ])
    assert result.success is True
    lines = result.new_content.splitlines()
    assert lines[0] == "line1"
    assert lines[1] == "replaced"
    assert lines[2] == "line3"
    assert result.applied == 1


def test_replace_lines_range():
    result = apply_changes(FIVE_LINES, [
        {"typ": "replace_lines", "line_from": 2, "line_to": 4, "new_text": "mid\n"}
    ])
    assert result.success is True
    lines = result.new_content.splitlines()
    assert lines == ["line1", "mid", "line5"]


# ---------------------------------------------------------------------------
# replace_lines — out-of-bounds / inverted range
# ---------------------------------------------------------------------------

def test_replace_lines_line_to_exceeds_file():
    result = apply_changes(FIVE_LINES, [
        {"typ": "replace_lines", "line_from": 4, "line_to": 99, "new_text": "x"}
    ])
    assert result.success is False
    assert result.new_content is None
    assert any("exceeds" in e or "line_to" in e for e in result.errors)


def test_replace_lines_inverted_range():
    result = apply_changes(FIVE_LINES, [
        {"typ": "replace_lines", "line_from": 4, "line_to": 2, "new_text": "x"}
    ])
    assert result.success is False
    assert any("inverted" in e or "line_to" in e for e in result.errors)


def test_replace_lines_line_from_zero_fails():
    result = apply_changes(FIVE_LINES, [
        {"typ": "replace_lines", "line_from": 0, "line_to": 1, "new_text": "x"}
    ])
    assert result.success is False
    assert any("below 1" in e or "line_from" in e for e in result.errors)


# ---------------------------------------------------------------------------
# insert_before_line — happy path and bounds
# ---------------------------------------------------------------------------

def test_insert_before_line_happy_path():
    result = apply_changes(FIVE_LINES, [
        {"typ": "insert_before_line", "line": 3, "text": "inserted\n"}
    ])
    assert result.success is True
    lines = result.new_content.splitlines()
    assert lines[2] == "inserted"
    assert lines[3] == "line3"
    assert result.applied == 1


def test_insert_before_line_first_line():
    content = "alpha\nbeta\n"
    result = apply_changes(content, [
        {"typ": "insert_before_line", "line": 1, "text": "zero\n"}
    ])
    assert result.success is True
    assert result.new_content.startswith("zero\n")


def test_insert_before_line_out_of_bounds_zero():
    result = apply_changes(FIVE_LINES, [
        {"typ": "insert_before_line", "line": 0, "text": "x"}
    ])
    assert result.success is False
    assert result.new_content is None


def test_insert_before_line_out_of_bounds_too_large():
    result = apply_changes(FIVE_LINES, [
        {"typ": "insert_before_line", "line": 10, "text": "x"}
    ])
    assert result.success is False
    assert result.new_content is None


# ---------------------------------------------------------------------------
# insert_after_line — happy path and bounds
# ---------------------------------------------------------------------------

def test_insert_after_line_happy_path():
    result = apply_changes(FIVE_LINES, [
        {"typ": "insert_after_line", "line": 2, "text": "between2and3\n"}
    ])
    assert result.success is True
    lines = result.new_content.splitlines()
    assert lines[1] == "line2"
    assert lines[2] == "between2and3"
    assert lines[3] == "line3"


def test_insert_after_line_last_line():
    content = "alpha\nbeta\n"
    result = apply_changes(content, [
        {"typ": "insert_after_line", "line": 2, "text": "gamma\n"}
    ])
    assert result.success is True
    assert result.new_content.endswith("gamma\n")


def test_insert_after_line_out_of_bounds():
    result = apply_changes(FIVE_LINES, [
        {"typ": "insert_after_line", "line": 99, "text": "x"}
    ])
    assert result.success is False
    assert result.new_content is None


def test_insert_after_line_zero_fails():
    result = apply_changes(FIVE_LINES, [
        {"typ": "insert_after_line", "line": 0, "text": "x"}
    ])
    assert result.success is False


# ---------------------------------------------------------------------------
# delete_lines — happy path and bounds
# ---------------------------------------------------------------------------

def test_delete_lines_happy_path():
    result = apply_changes(FIVE_LINES, [
        {"typ": "delete_lines", "line_from": 2, "line_to": 3}
    ])
    assert result.success is True
    lines = result.new_content.splitlines()
    assert lines == ["line1", "line4", "line5"]
    assert result.applied == 1


def test_delete_lines_single_line():
    result = apply_changes(FIVE_LINES, [
        {"typ": "delete_lines", "line_from": 1, "line_to": 1}
    ])
    assert result.success is True
    assert not result.new_content.startswith("line1")


def test_delete_lines_exceeds_bounds():
    result = apply_changes(FIVE_LINES, [
        {"typ": "delete_lines", "line_from": 4, "line_to": 100}
    ])
    assert result.success is False
    assert result.new_content is None


# ---------------------------------------------------------------------------
# append_to_file
# ---------------------------------------------------------------------------

def test_append_to_file_happy_path():
    content = "hello\n"
    result = apply_changes(content, [
        {"typ": "append_to_file", "text": "world\n"}
    ])
    assert result.success is True
    assert result.new_content == "hello\nworld\n"
    assert result.applied == 1


def test_append_to_file_adds_newline_if_missing():
    content = "no_trailing_newline"
    result = apply_changes(content, [
        {"typ": "append_to_file", "text": "appended\n"}
    ])
    assert result.success is True
    assert "no_trailing_newline\n" in result.new_content
    assert result.new_content.endswith("appended\n")
    assert len(result.warnings) == 1


def test_append_to_file_empty_file():
    result = apply_changes("", [
        {"typ": "append_to_file", "text": "first line\n"}
    ])
    assert result.success is True
    assert result.new_content == "first line\n"


# ---------------------------------------------------------------------------
# prepend_to_file
# ---------------------------------------------------------------------------

def test_prepend_to_file_happy_path():
    content = "second\n"
    result = apply_changes(content, [
        {"typ": "prepend_to_file", "text": "first\n"}
    ])
    assert result.success is True
    assert result.new_content == "first\nsecond\n"
    assert result.applied == 1


def test_prepend_to_file_empty_file():
    result = apply_changes("", [
        {"typ": "prepend_to_file", "text": "header\n"}
    ])
    assert result.success is True
    assert result.new_content == "header\n"


# ---------------------------------------------------------------------------
# Atomic property: mid-sequence failure rolls back everything
# ---------------------------------------------------------------------------

def test_atomic_failure_mid_sequence():
    """op #2 of 3 fails → new_content must be None, not partial."""
    content = "aaa\nbbb\nccc\n"
    changes = [
        # op 1: valid
        {"typ": "replace_text", "find": "aaa", "replace": "AAA"},
        # op 2: invalid (NOT_FOUND)
        {"typ": "replace_text", "find": "DOES_NOT_EXIST", "replace": "x"},
        # op 3: would be valid, but never reached
        {"typ": "append_to_file", "text": "ddd\n"},
    ]
    result = apply_changes(content, changes)
    assert result.success is False
    assert result.new_content is None
    # Only op 1 succeeded before failure
    assert result.applied == 1
    assert len(result.errors) == 1


def test_atomic_failure_first_op():
    """First op fails → applied=0."""
    changes = [
        {"typ": "replace_text", "find": "MISSING", "replace": "x"},
        {"typ": "append_to_file", "text": "extra\n"},
    ]
    result = apply_changes(SIMPLE, changes)
    assert result.success is False
    assert result.applied == 0


# ---------------------------------------------------------------------------
# Empty changes list
# ---------------------------------------------------------------------------

def test_empty_changes_returns_original():
    result = apply_changes(SIMPLE, [])
    assert result.success is True
    assert result.new_content == SIMPLE
    assert result.applied == 0
    assert result.errors == []
    assert result.warnings == []


# ---------------------------------------------------------------------------
# Unknown operation type
# ---------------------------------------------------------------------------

def test_unknown_op_type_fails():
    result = apply_changes(SIMPLE, [
        {"typ": "magic_rewrite", "instructions": "do something"}
    ])
    assert result.success is False
    assert result.new_content is None
    assert any("magic_rewrite" in e for e in result.errors)
    assert any("unknown" in e.lower() for e in result.errors)


def test_unknown_op_type_lists_known_ops():
    result = apply_changes(SIMPLE, [{"typ": "nonexistent"}])
    assert result.success is False
    # Error message should hint at known operations
    error_text = " ".join(result.errors)
    assert "replace_text" in error_text or "known" in error_text.lower()


# ---------------------------------------------------------------------------
# Multi-op happy path: 3 operations in sequence
# ---------------------------------------------------------------------------

def test_multi_op_sequence():
    """Three operations applied in order, each sees the result of the previous."""
    content = "alpha\nbeta\ngamma\n"
    changes = [
        {"typ": "replace_text", "find": "alpha", "replace": "ALPHA"},
        {"typ": "insert_after_line", "line": 2, "text": "inserted\n"},
        {"typ": "append_to_file", "text": "omega\n"},
    ]
    result = apply_changes(content, changes)
    assert result.success is True
    assert result.applied == 3
    lines = result.new_content.splitlines()
    assert lines[0] == "ALPHA"
    assert lines[1] == "beta"
    assert lines[2] == "inserted"
    assert lines[3] == "gamma"
    assert lines[4] == "omega"


def test_multi_op_delete_then_replace():
    """Delete a block then replace a remaining line."""
    content = "keep\ndelete_me\nalso_delete\nchange_me\n"
    changes = [
        {"typ": "delete_lines", "line_from": 2, "line_to": 3},
        {"typ": "replace_text", "find": "change_me", "replace": "CHANGED"},
    ]
    result = apply_changes(content, changes)
    assert result.success is True
    assert result.applied == 2
    assert result.new_content == "keep\nCHANGED\n"


# ---------------------------------------------------------------------------
# Round-trip: content must be byte-identical when ops are no-ops
# ---------------------------------------------------------------------------

def test_newline_preservation():
    """Ensure no rstrip, no normalisation of line endings."""
    content = "line1\r\nline2\r\nline3\r\n"
    result = apply_changes(content, [
        {"typ": "replace_text", "find": "line2\r\n", "replace": "LINE2\r\n"}
    ])
    assert result.success is True
    assert result.new_content == "line1\r\nLINE2\r\nline3\r\n"


def test_no_trailing_newline_preserved():
    """Files without trailing newline must come out without one (unless appended)."""
    content = "abc"
    result = apply_changes(content, [
        {"typ": "replace_text", "find": "abc", "replace": "xyz"}
    ])
    assert result.success is True
    assert result.new_content == "xyz"
    assert not result.new_content.endswith("\n")
