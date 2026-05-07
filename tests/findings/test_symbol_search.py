"""Tests for symbol search fallback (D22)."""
from __future__ import annotations
import pytest
from pathlib import Path
from findings.lib.symbol_search import find_symbol


def test_find_existing_function(tmp_path):
    src = tmp_path / "lib.py"
    src.write_text("def my_function(): pass\n")
    hits = find_symbol("my_function", search_root=tmp_path)
    assert len(hits) == 1
    assert "my_function" in hits[0].text
    assert hits[0].path == str(src)


def test_find_returns_empty_when_missing(tmp_path):
    (tmp_path / "lib.py").write_text("def other(): pass\n")
    hits = find_symbol("missing_function", search_root=tmp_path)
    assert hits == []


def test_find_searches_recursively(tmp_path):
    sub = tmp_path / "sub" / "deep"
    sub.mkdir(parents=True)
    (sub / "x.py").write_text("class FooBar: pass\n")
    hits = find_symbol("FooBar", search_root=tmp_path)
    assert len(hits) == 1
