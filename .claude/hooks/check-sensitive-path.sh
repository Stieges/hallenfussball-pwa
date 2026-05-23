#!/bin/bash
# PreToolUse hook for Edit|Write — blocks modifications to sensitive paths.
# Reads JSON from stdin, exits 2 (with stderr message back to Claude) if the
# target file_path matches a sensitive pattern.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('tool_input', {}).get('file_path', ''))
except Exception:
    pass
" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Patterns to block (case-insensitive substring or regex match)
PATTERNS=(
    '\.env$'
    '\.env\.'
    '\.pem$'
    '\.key$'
    'secret'
    'supabase-service-role'
    '/credentials\.json$'
    '/\.serena/cache/'
)

for pattern in "${PATTERNS[@]}"; do
    if echo "$FILE_PATH" | grep -qiE "$pattern"; then
        echo "BLOCKED: '$FILE_PATH' matches sensitive-path pattern '$pattern'" >&2
        echo "Reason: this file likely contains credentials or local-only state." >&2
        echo "If you really need to write here, do it manually outside the agent." >&2
        exit 2
    fi
done

exit 0
