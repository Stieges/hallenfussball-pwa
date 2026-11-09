#!/bin/bash
# SessionStart: Zähldatei leeren, damit nach einem Absturz keine alten Einträge übrig bleiben.
# Robustheit: schlägt das Skript selbst fehl (kaputtes JSON, kein python3 ...), blockiert es NICHTS.
# Es meldet eine Warnung über systemMessage und lässt den Start zu (exit 0).
# Doku: .claude/hooks/SLOT-GRENZE.md
DIR="$(cd "$(dirname "$0")" && pwd)"
EINGABE=$(cat)
AUS=$(printf '%s' "$EINGABE" | python3 "$DIR/slot-zaehler.py" reset 2>&1)
RC=$?
if [ $RC -ne 0 ]; then
    MSG=$(printf '%s' "$AUS" | tail -n 1 | tr -d '"\\' | cut -c1-300)
    printf '{"systemMessage":"Slot-Hook defekt (%s), Start trotzdem zugelassen: %s"}\n' "reset" "$MSG"
    exit 0
fi
[ -n "$AUS" ] && printf '%s\n' "$AUS"
exit 0
