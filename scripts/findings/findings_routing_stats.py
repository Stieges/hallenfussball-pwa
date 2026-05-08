"""Auswertung von .claude/logs/finding-fixes.jsonl: Erfolgsrate je Modell."""
from __future__ import annotations
import json
import sys
from collections import defaultdict
from pathlib import Path
from statistics import median


def main(argv: list[str] | None = None) -> int:
    argv = argv or sys.argv[1:]
    log_path = Path(argv[0]) if argv else Path(".claude/logs/finding-fixes.jsonl")
    if not log_path.is_file():
        print(f"Log file not found: {log_path}")
        return 1

    by_model = defaultdict(list)
    for line in log_path.read_text().splitlines():
        if not line.strip():
            continue
        entry = json.loads(line)
        by_model[entry.get("model", "unknown")].append(entry)

    print(f"Source: {log_path}")
    print(f"Total entries: {sum(len(v) for v in by_model.values())}\n")

    print(f"{'Model':30s} | {'Runs':>5s} | {'Pass-rate':>10s} | {'Median ms':>10s} | {'Fallback':>9s}")
    print("-" * 80)
    for model, entries in sorted(by_model.items()):
        total = len(entries)
        passed = sum(1 for e in entries if e.get("tests_pass"))
        med_ms = median([e.get("duration_ms", 0) for e in entries]) if entries else 0
        fallback_used = sum(1 for e in entries if e.get("fallback_used"))
        pass_rate = (passed / total * 100) if total else 0
        print(f"{model:30s} | {total:>5d} | {pass_rate:>9.1f}% | {med_ms:>10.0f} | {fallback_used:>9d}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
