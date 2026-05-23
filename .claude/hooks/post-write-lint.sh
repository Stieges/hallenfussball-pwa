#!/bin/bash
# PostToolUse hook for Edit|Write — runs ESLint on the modified file.
# Scope: src/ only, skips test files (Vitest covers those better).
# Exit 2 with stderr message if lint fails — Claude must address before
# moving on. No auto-fix.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
    pass
" 2>/dev/null)

# Filter: only lint .ts/.tsx/.js/.jsx
if [[ ! "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
    exit 0
fi

# Skip test files
if [[ "$FILE_PATH" =~ /__tests__/ ]] || [[ "$FILE_PATH" =~ \.test\. ]] || [[ "$FILE_PATH" =~ \.spec\. ]]; then
    exit 0
fi

# Only lint files in src/ (other folders may not have ESLint config applied)
if [[ ! "$FILE_PATH" =~ /src/ ]]; then
    exit 0
fi

# Find project root
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$PROJECT_ROOT" ] || [ ! -f "$PROJECT_ROOT/eslint.config.js" ]; then
    exit 0
fi

cd "$PROJECT_ROOT" || exit 0

# Run ESLint, max-warnings 0
RESULT=$(npx --no-install eslint "$FILE_PATH" --max-warnings 0 --format=compact 2>&1)
EXIT=$?

if [ $EXIT -ne 0 ]; then
    echo "LINT FAILED for $FILE_PATH:" >&2
    echo "$RESULT" >&2
    echo "" >&2
    echo "Fix lint errors before continuing. Do not bypass with --no-verify or eslint-disable." >&2
    exit 2
fi

exit 0
