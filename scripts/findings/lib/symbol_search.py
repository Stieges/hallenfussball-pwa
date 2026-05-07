"""Symbol search fallback for path-imprecise findings (D22).

When a finding references file `X/Y/Z.ts:funcName` but that path doesn't exist,
grep across the project for `funcName` and return matches.
"""
from __future__ import annotations
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass
class SymbolHit:
    path: str
    line: int
    text: str


_DEFAULT_INCLUDE = (".ts", ".tsx", ".js", ".jsx", ".py", ".sql", ".css", ".json")
_DEFAULT_EXCLUDE = ("node_modules", "dist", ".git", "test-results", "coverage")


def find_symbol(symbol: str, *, search_root: str | Path, include_ext: tuple = _DEFAULT_INCLUDE) -> List[SymbolHit]:
    """Recursively find files in search_root that contain the symbol.

    Uses simple word-boundary regex (`\\bsymbol\\b`).
    """
    root = Path(search_root)
    pattern = re.compile(r"\b" + re.escape(symbol) + r"\b")
    hits: List[SymbolHit] = []

    for fp in root.rglob("*"):
        if not fp.is_file():
            continue
        if fp.suffix not in include_ext:
            continue
        if any(excl in str(fp) for excl in _DEFAULT_EXCLUDE):
            continue
        try:
            for ln, line in enumerate(fp.read_text(errors="replace").splitlines(), start=1):
                if pattern.search(line):
                    hits.append(SymbolHit(path=str(fp), line=ln, text=line))
                    break  # one hit per file is enough for triage
        except OSError:
            continue
    return hits
