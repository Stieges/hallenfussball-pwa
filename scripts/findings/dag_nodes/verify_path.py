"""DAG node: verify the finding's file path, with symbol_search fallback (D22)."""
from __future__ import annotations
import re
from pathlib import Path
from ..lib.models import FindingFixState
from ..lib.symbol_search import find_symbol


def _extract_symbol(file_field: str) -> str | None:
    """Extract symbol after ':' (e.g. 'src/x.ts:funcName' → 'funcName')."""
    if ":" in file_field:
        return file_field.rsplit(":", 1)[1].strip()
    return None


def verify_path(state: FindingFixState, *, repo_root: str | Path) -> FindingFixState:
    """Try exact-path-match. If fail, try symbol_search. Updates state in-place-style."""
    repo_root = Path(repo_root)
    raw_path = state.finding.file
    # Strip line-suffix like ":42" or ":42-58" (keep 'symbol' if non-numeric)
    path_only = re.sub(r":\d+(-\d+)?$", "", raw_path)
    # Strip symbol-suffix like ":funcName"
    if ":" in path_only and not re.search(r"\.\w+:\d", path_only):
        # path_only might be "src/x.ts:funcName" → keep "src/x.ts"
        path_only = path_only.rsplit(":", 1)[0]

    full = repo_root / path_only
    if full.is_file():
        state.path_resolved = path_only
        state.path_resolution_method = "exact"
        return state

    # Fallback: symbol search
    symbol = _extract_symbol(raw_path)
    if symbol:
        hits = find_symbol(symbol, search_root=repo_root)
        if hits:
            state.path_resolved = str(Path(hits[0].path).relative_to(repo_root))
            state.path_resolution_method = "symbol_search"
            return state

    state.path_resolution_method = "failed"
    return state
