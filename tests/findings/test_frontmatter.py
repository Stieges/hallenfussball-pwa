"""Tests for YAML frontmatter parser/writer."""
from __future__ import annotations
import pytest
from findings.lib.frontmatter import parse_frontmatter, write_frontmatter


SAMPLE = """---
id: F-042
severity: low
area: ux
title: Touch-Target zu klein
file: src/components/ui/ActionMenu.tsx
status: open
source: reviews/2026-05-07_2056_components_ui.md
detected: 2026-05-07
related: []
acceptance_criteria: []
---

# Body

Markdown content here.
"""


def test_parse_frontmatter_extracts_yaml_dict():
    fm, body = parse_frontmatter(SAMPLE)
    assert fm["id"] == "F-042"
    assert fm["severity"] == "low"
    assert fm["related"] == []
    assert "# Body" in body


def test_parse_frontmatter_handles_no_frontmatter():
    fm, body = parse_frontmatter("# Just a body\n\nNo frontmatter.")
    assert fm == {}
    assert body.strip().startswith("# Just a body")


def test_write_frontmatter_roundtrip():
    fm, body = parse_frontmatter(SAMPLE)
    rebuilt = write_frontmatter(fm, body)
    fm2, body2 = parse_frontmatter(rebuilt)
    assert fm2 == fm
    assert body2.strip() == body.strip()


def test_write_frontmatter_uses_block_yaml():
    fm = {"id": "F-001", "tags": ["a", "b"]}
    out = write_frontmatter(fm, "Body")
    assert out.startswith("---\n")
    assert "id: F-001" in out
    assert "Body" in out
