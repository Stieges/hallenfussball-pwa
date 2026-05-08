"""DAG node: read the resolved file into state (D21).

This ensures the LLM works with REAL file contents, not the bot-snippet
which may contain hallucinated paths or stale code.
"""
from __future__ import annotations
from pathlib import Path
from ..lib.models import FindingFixState


def read_affected_files(state: FindingFixState, *, repo_root: str | Path, max_chars: int = 50000) -> FindingFixState:
    """Read resolved file and any related-finding files into state.file_contents."""
    repo_root = Path(repo_root)
    if not state.path_resolved:
        return state
    full = repo_root / state.path_resolved
    if full.is_file():
        content = full.read_text(errors="replace")
        if len(content) > max_chars:
            content = content[:max_chars] + f"\n\n... (truncated at {max_chars} chars)"
        state.file_contents[state.path_resolved] = content
    return state
