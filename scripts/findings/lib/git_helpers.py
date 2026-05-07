"""Git helpers for commit-hash lookup and diff queries."""
from __future__ import annotations
import subprocess
from pathlib import Path
from typing import List


def commit_hash_at(ref: str, *, repo: str | Path = ".") -> str:
    """Return the full commit SHA for a given ref (e.g. 'HEAD', 'main', '@{u}')."""
    return subprocess.check_output(
        ["git", "rev-parse", ref], cwd=str(repo), text=True
    ).strip()


def files_changed_between(from_ref: str, to_ref: str, *, repo: str | Path = ".") -> List[str]:
    """List files changed between two refs (relative paths)."""
    out = subprocess.check_output(
        ["git", "diff", "--name-only", from_ref, to_ref],
        cwd=str(repo),
        text=True,
    )
    return [line for line in out.splitlines() if line.strip()]
