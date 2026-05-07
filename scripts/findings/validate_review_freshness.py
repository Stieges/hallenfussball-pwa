"""Phase 0a: detect findings that reference files changed since the review.

Strategy:
1. Parse all review markdown files in reviews/.
2. Extract referenced file paths (regex: `src/...\\.tsx?` or **Datei:** patterns).
3. Get list of files changed in git since review timestamp (or commit hash if specified).
4. Output list of {review, stale_files}.
"""
from __future__ import annotations
import re
import sys
from pathlib import Path
from typing import Iterable, Set

from .lib.git_helpers import commit_hash_at, files_changed_between


_FILE_PATTERN = re.compile(r"`(src/[\w/_-]+\.(?:tsx?|jsx?|css|sql|py))(?::\d+(?:-\d+)?)?`")
_DATEI_PATTERN = re.compile(r"\*\*Datei:\*\*\s*`?([\w/_-]+\.\w+)`?")


def extract_file_refs(review_text: str) -> Set[str]:
    """Extract all `src/...` style file references from a review."""
    refs: Set[str] = set()
    for m in _FILE_PATTERN.finditer(review_text):
        refs.add(m.group(1))
    for m in _DATEI_PATTERN.finditer(review_text):
        refs.add(m.group(1))
    return refs


def find_stale_files_in_reviews(review_paths: Iterable[Path], changed_files: list[str]) -> Set[str]:
    """Return the set of file paths that are referenced in any review AND changed."""
    referenced: Set[str] = set()
    for p in review_paths:
        referenced |= extract_file_refs(Path(p).read_text(errors="replace"))
    return referenced & set(changed_files)


def main(argv: list[str] | None = None) -> int:
    argv = argv or sys.argv[1:]
    if len(argv) < 2:
        print("Usage: validate_review_freshness.py <review-commit-sha> <reviews-dir>", file=sys.stderr)
        return 2
    review_sha, reviews_dir = argv[0], argv[1]
    head = commit_hash_at("HEAD")
    changed = files_changed_between(review_sha, head)
    review_files = list(Path(reviews_dir).glob("*.md"))
    stale = find_stale_files_in_reviews(review_files, changed)

    print(f"Review-SHA: {review_sha}  HEAD: {head}")
    print(f"Reviews scanned: {len(review_files)}")
    print(f"Files changed since review: {len(changed)}")
    print(f"Stale files (referenced AND changed): {len(stale)}")
    for f in sorted(stale):
        print(f"  STALE: {f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
