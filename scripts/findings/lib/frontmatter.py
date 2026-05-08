"""YAML-Frontmatter Parser/Writer for finding markdown files."""
from __future__ import annotations
import re
from typing import Tuple
import yaml


_FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n(.*)\Z", re.DOTALL)


def parse_frontmatter(text: str) -> Tuple[dict, str]:
    """Parse YAML frontmatter from a markdown string.

    Returns (frontmatter_dict, body_string).
    Returns ({}, text) if no frontmatter present.
    """
    m = _FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    fm_yaml, body = m.group(1), m.group(2)
    fm = yaml.safe_load(fm_yaml) or {}
    return fm, body


def write_frontmatter(frontmatter: dict, body: str) -> str:
    """Combine frontmatter dict + body into a markdown string with --- delimiters."""
    fm_yaml = yaml.dump(frontmatter, sort_keys=False, allow_unicode=True, default_flow_style=False)
    return f"---\n{fm_yaml}---\n\n{body.lstrip()}"
