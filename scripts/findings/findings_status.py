"""Quick dashboard: count findings per severity / area / status."""
from __future__ import annotations
import sys
from collections import Counter
from pathlib import Path
from .lib.frontmatter import parse_frontmatter


def main(argv: list[str] | None = None) -> int:
    argv = argv or sys.argv[1:]
    findings_dir = Path(argv[0]) if argv else Path("docs/findings")
    files = list(findings_dir.glob("F-*.md"))
    if not files:
        print(f"No findings in {findings_dir}/")
        return 1

    severity = Counter()
    area = Counter()
    status = Counter()
    stale = 0

    for f in files:
        fm, _ = parse_frontmatter(f.read_text())
        severity[fm.get("severity", "?")] += 1
        area[fm.get("area", "?")] += 1
        status[fm.get("status", "?")] += 1
        if fm.get("stale"):
            stale += 1

    print(f"Total findings: {len(files)}")
    print(f"\nSeverity:")
    for s in ("critical", "high", "medium", "low"):
        print(f"  {s:10s}: {severity[s]}")
    print(f"\nStatus:")
    for s in ("open", "in-progress", "fixed", "archived", "wontfix"):
        print(f"  {s:12s}: {status[s]}")
    print(f"\nArea:")
    for a, count in area.most_common():
        print(f"  {a:20s}: {count}")
    print(f"\nStale: {stale}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
