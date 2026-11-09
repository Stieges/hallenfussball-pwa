#!/bin/bash
# Test der Slot-Grenze (V3). Läuft mit `bash .claude/hooks/test/slot-hook.test.sh`.
# Nutzt eigene Wegwerf-Dateien (SLOT_AGENTEN_DATEI / SLOT_GRENZE_DATEI), berührt .claude/state nie.
set -u
HOOKS="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
export SLOT_AGENTEN_DATEI="$T/agenten.json" SLOT_GRENZE_DATEI="$T/slot-grenze.json"
command -v jq >/dev/null || { echo "jq fehlt"; exit 2; }
FAILS=0; N=0
ok()   { N=$((N+1)); echo "ok   $N - $1"; }
fail() { N=$((N+1)); FAILS=$((FAILS+1)); echo "FAIL $N - $1"; }
zaehler() { jq '.agenten | length' "$SLOT_AGENTEN_DATEI" 2>/dev/null || echo "?"; }
neu() { rm -f "$SLOT_AGENTEN_DATEI" "$SLOT_GRENZE_DATEI"; }
# start <model|-> <description> [prompt] [tool_use_id]  -> Ausgabe des Hooks
start() {
  local m="$1" d="$2" p="${3:-Aufgabe}" id="${4:-toolu_$RANDOM}"
  jq -nc --arg m "$m" --arg d "$d" --arg p "$p" --arg id "$id" \
    '{hook_event_name:"PreToolUse",tool_name:"Agent",tool_use_id:$id,
      tool_input:({description:$d,prompt:$p,subagent_type:"general-purpose"} + (if $m=="-" then {} else {model:$m} end))}' \
    | bash "$HOOKS/agent-start-pruefen.sh"
}
claim() { jq -nc --arg a "$1" '{hook_event_name:"SubagentStart",agent_id:$a,agent_type:"general-purpose"}' | bash "$HOOKS/agent-start-erfasst.sh"; }
stop()  { jq -nc --arg a "$1" '{hook_event_name:"SubagentStop",agent_id:$a,agent_type:"general-purpose"}' | bash "$HOOKS/agent-ende.sh"; }
abgewiesen() { echo "$1" | jq -e '.hookSpecificOutput.permissionDecision=="deny" and (.hookSpecificOutput.permissionDecisionReason|length>0)' >/dev/null 2>&1; }
zugelassen() { ! abgewiesen "$1" && [ -z "$(echo "$1" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)" ]; }

echo "# Fall 1: zwei Starts zugelassen, dritter abgewiesen"; neu
A=$(start sonnet "Aufgabe A"); B=$(start haiku "Aufgabe B"); C=$(start sonnet "Aufgabe C")
zugelassen "$A" && zugelassen "$B" && [ "$(zaehler)" = 2 ] && ok "erster und zweiter Start zugelassen, Zähler 2" || fail "erster/zweiter Start ($A | $B | Zähler $(zaehler))"
abgewiesen "$C" && echo "$C" | jq -e '.hookSpecificOutput.permissionDecisionReason | contains("2") and contains("Aufgabe A")' >/dev/null \
  && [ "$(zaehler)" = 2 ] && ok "dritter Start abgewiesen (Grenze + laufende Einträge in der Begründung)" || fail "dritter Start ($C)"
E=$(start - "ohne Modell"); abgewiesen "$E" && ok "Start ohne Modellangabe zählt auch" || fail "ohne Modell"

echo "# Fall 2: Opus ohne Zweck abgewiesen"; neu
O=$(start opus "Implementiere Feature X" "Baue das Feature"); abgewiesen "$O" && [ "$(zaehler)" = "?" -o "$(zaehler)" = 0 ] \
  && ok "Opus ohne Zweck abgewiesen, nichts eingetragen" || fail "Opus ohne Zweck ($O)"

echo "# Fall 3: Opus mit review zugelassen, zweiter Opus abgewiesen"; neu
O1=$(start opus "Opus-REVIEW von PR 493"); O2=$(start opus "Ursachensuche für rote Tests")
zugelassen "$O1" && ok "Opus mit „Review“ (Großschreibung egal) zugelassen" || fail "Opus review ($O1)"
abgewiesen "$O2" && echo "$O2" | jq -e '.hookSpecificOutput.permissionDecisionReason | contains("Opus-Grenze")' >/dev/null \
  && ok "zweiter Opus abgewiesen (Opus-Grenze)" || fail "zweiter Opus ($O2)"
S=$(start sonnet "normal"); zugelassen "$S" && ok "Sonnet neben Opus zugelassen (Slot 2 von 2)" || fail "Sonnet neben Opus ($S)"
neu; P=$(start opus "Analyse" "Bitte eine Ursachensuche durchführen"); zugelassen "$P" && ok "Zweck im prompt genügt" || fail "Zweck im prompt ($P)"

echo "# Fall 4: Stop senkt den Zähler"; neu
start sonnet "A" "x" t1 >/dev/null; start sonnet "B" "x" t2 >/dev/null; claim ag-1 >/dev/null; claim ag-2 >/dev/null
stop ag-2 >/dev/null
[ "$(zaehler)" = 1 ] && [ "$(jq -r '.agenten[0].beschreibung' "$SLOT_AGENTEN_DATEI")" = A ] && ok "Stop trägt genau den passenden Agenten aus" || fail "Stop per agent_id"
zugelassen "$(start sonnet C)" && ok "nach Stop wieder ein Start möglich" || fail "Start nach Stop"
stop ag-unbekannt >/dev/null; stop ag-unbekannt >/dev/null; stop ag-unbekannt >/dev/null
[ "$(zaehler)" -ge 0 ] && ok "Stop ohne passenden Eintrag bricht nicht ab" || fail "Stop unbekannt"
neu; start sonnet "A" >/dev/null; stop ag-ohne-claim >/dev/null
[ "$(zaehler)" = 0 ] && ok "Rückfall: ohne SubagentStart-Zuordnung wird der älteste Eintrag ausgetragen" || fail "Rückfall ältester"
neu; start sonnet "A" >/dev/null; claim ag-1 >/dev/null; stop ag-1 >/dev/null; stop ag-1 >/dev/null
[ "$(zaehler)" = 0 ] && ok "doppeltes Stop (z. B. Fortsetzung) löscht nichts Fremdes" || fail "doppeltes Stop"

echo "# Fall 5: Grenze und abgelaufenes bis"; neu
echo '{"slots":3,"opus":1,"gesetzt":"2026-11-09","von":"Daniel"}' > "$SLOT_GRENZE_DATEI"
start sonnet a >/dev/null; start sonnet b >/dev/null; R=$(start sonnet c)
zugelassen "$R" && ok "slots=3 aus slot-grenze.json gilt (dritter Start zugelassen)" || fail "slots=3 ($R)"
neu; echo '{"slots":3,"opus":1,"bis":"2000-01-01T00:00:00Z"}' > "$SLOT_GRENZE_DATEI"
start sonnet a >/dev/null; start sonnet b >/dev/null; R=$(start sonnet c)
abgewiesen "$R" && ok "abgelaufenes bis -> Vorgabe 2" || fail "abgelaufenes bis ($R)"
neu; echo '{"slots":3,"opus":1,"bis":"2999-01-01T00:00:00+01:00"}' > "$SLOT_GRENZE_DATEI"
start sonnet a >/dev/null; start sonnet b >/dev/null; R=$(start sonnet c)
zugelassen "$R" && ok "bis in der Zukunft -> Sonderslot gilt" || fail "bis Zukunft ($R)"
neu; echo 'kein json' > "$SLOT_GRENZE_DATEI"; start sonnet a >/dev/null; start sonnet b >/dev/null; R=$(start sonnet c)
abgewiesen "$R" && ok "kaputte slot-grenze.json -> Vorgabe" || fail "kaputte Grenze ($R)"

echo "# Fall 6: fehlende oder kaputte Zähldatei"; neu
R=$(start sonnet a); zugelassen "$R" && [ "$(zaehler)" = 1 ] && ok "fehlende Zähldatei wird angelegt" || fail "fehlende Zähldatei ($R)"
echo '{{{ kaputt' > "$SLOT_AGENTEN_DATEI"; R=$(start sonnet a)
zugelassen "$R" && [ "$(zaehler)" = 1 ] && ok "kaputte Zähldatei wird neu angelegt (mit Hinweis)" || fail "kaputte Zähldatei ($R)"
echo "$R" | jq -e '.systemMessage|contains("kaputt")' >/dev/null && ok "Hinweis per systemMessage" || fail "kein Hinweis"
echo '{"agenten":"unsinn"}' > "$SLOT_AGENTEN_DATEI"; zugelassen "$(start sonnet a)" && ok "falsche Struktur wird überlebt" || fail "falsche Struktur"
OLD=$(date -u -v-7H +%Y-%m-%dT%H:%M:%S+00:00 2>/dev/null || date -u -d '7 hours ago' +%Y-%m-%dT%H:%M:%S+00:00)
echo "{\"agenten\":[{\"ts\":\"$OLD\",\"agent_id\":\"x\"},{\"ts\":\"$OLD\",\"agent_id\":\"y\"}]}" > "$SLOT_AGENTEN_DATEI"
zugelassen "$(start sonnet a)" && ok "verwaiste Einträge (>6 h) zählen nicht" || fail "verwaist"
echo '{"hook_event_name":"SessionStart"}' | bash "$HOOKS/slot-zuruecksetzen.sh" >/dev/null
[ "$(zaehler)" = 0 ] && ok "SessionStart setzt die Zähldatei zurück" || fail "Reset"

echo "# Robustheit: kaputte Eingabe blockiert nichts"
for s in agent-start-pruefen agent-start-erfasst agent-ende slot-zuruecksetzen; do
  OUT=$(echo 'das ist kein json' | bash "$HOOKS/$s.sh"); RC=$?
  [ $RC -eq 0 ] && echo "$OUT" | jq -e '.systemMessage|length>0' >/dev/null && ! abgewiesen "$OUT" \
    && ok "$s: kaputtes JSON -> exit 0 + Warnung" || fail "$s kaputtes JSON (rc=$RC, $OUT)"
done
OUT=$(echo '[1,2]' | bash "$HOOKS/agent-start-pruefen.sh"); echo "$OUT" | jq -e '.systemMessage' >/dev/null && ok "JSON ohne Objekt -> Warnung, zugelassen" || fail "Array-Eingabe"

echo; echo "$N Prüfungen, $FAILS fehlgeschlagen"
[ "$FAILS" -eq 0 ]
