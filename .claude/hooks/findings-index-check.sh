#!/bin/bash
# Stop hook — warns at session end if docs/findings/INDEX.md was modified
# but not staged. Non-blocking (exit 0) — just a reminder.

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$PROJECT_ROOT" ]; then
    exit 0
fi

cd "$PROJECT_ROOT" || exit 0

INDEX_FILE="docs/findings/INDEX.md"

# File doesn't exist → nothing to check
[ -f "$INDEX_FILE" ] || exit 0

# Has unstaged modifications?
if ! git diff --quiet "$INDEX_FILE" 2>/dev/null; then
    echo "" >&2
    echo "REMINDER: $INDEX_FILE has unstaged modifications." >&2
    echo "If you finished a finding-fix, ensure test-file and verified-commit columns are updated." >&2
    echo "" >&2
fi

exit 0
