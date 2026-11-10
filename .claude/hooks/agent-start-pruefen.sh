#!/bin/bash
# PreToolUse auf Agent: weist den Start ab, wenn die Slot-/Opus-Grenze erreicht ist; sonst trägt er den Agenten ein.
# Robustheit: schlägt das Skript selbst fehl (kaputtes JSON, kein python3 ...), blockiert es NICHTS.
# Es meldet eine Warnung über systemMessage und lässt den Start zu (exit 0).
# Doku: .claude/hooks/SLOT-GRENZE.md
DIR="$(cd "$(dirname "$0")" && pwd)"
EINGABE=$(cat)
AUS=$(printf '%s' "$EINGABE" | python3 "$DIR/slot-zaehler.py" start 2>&1)
RC=$?
if [ $RC -ne 0 ]; then
    MSG=$(printf '%s' "$AUS" | tail -n 1 | tr -d '"\\[:cntrl:]' | cut -c1-300)
    printf '{"systemMessage":"Slot-Hook defekt (%s), Start trotzdem zugelassen: %s"}\n' "start" "$MSG"
    exit 0
fi
[ -n "$AUS" ] && printf '%s\n' "$AUS"
exit 0
