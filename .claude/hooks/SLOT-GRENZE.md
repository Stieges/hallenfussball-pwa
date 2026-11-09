# Slot-Grenze für Agenten (V3)

Technische Grenze, wie viele Agenten gleichzeitig laufen dürfen. Ersetzt die reine Absprache
(„höchstens 2 Slots, davon 1 Opus“).

## Bestandteile

| Hook-Ereignis | Matcher | Skript | Aufgabe |
|---|---|---|---|
| PreToolUse | `Agent` | `agent-start-pruefen.sh` | weist den Start ab (`permissionDecision: deny`) oder trägt ihn ein |
| SubagentStart | alle | `agent-start-erfasst.sh` | ordnet den Eintrag der `agent_id` zu |
| SubagentStop | alle | `agent-ende.sh` | trägt aus |
| SessionStart | `startup\|resume\|clear` | `slot-zuruecksetzen.sh` | leert die Zähldatei (Absturzreste) |

Logik: `slot-zaehler.py`. Test: `bash .claude/hooks/test/slot-hook.test.sh`.

## Dateien (gitignored, `.claude/state/`)

- `agenten.json` – Zähldatei, `{"agenten":[{id, ts, modell, opus, beschreibung, agent_id}]}`. Nicht von Hand pflegen.
- `slot-grenze.json` – die Grenze. Fehlt sie: `{"slots":2,"opus":1}`.
  Beispiel: `{"slots":3,"opus":1,"bis":"2026-11-09T22:00:00+01:00","gesetzt":"2026-11-09","von":"Daniel"}`.
  `bis` (optional, ISO-Zeitpunkt; ohne Zone gilt Ortszeit) – danach gilt wieder die Vorgabe 2/1.

## Regeln

- Sind schon `slots` Agenten eingetragen, wird der Start abgewiesen (Begründung nennt Grenze und laufende Einträge).
- `model: opus` (jede Schreibweise, die „opus“ enthält) nur, wenn `description` oder `prompt` „review“ oder „ursache“
  (damit auch „Ursachensuche“) nennt, ohne Groß/Klein, und weniger als `opus` Opus-Agenten laufen.
- Alle Agenten-Typen zählen gleich (`fork`, `Explore`, `general-purpose` …).

## Welche Felder die Ereignisse liefern (Quelle: code.claude.com/docs/en/hooks, Stand 2026-11-09)

- **PreToolUse** (`Agent`): `tool_name`, `tool_input` (`prompt`, `description`, `subagent_type`, `model`), `tool_use_id`
  (`toolu_…`) plus Gemeinsames (`session_id`, `cwd`, `hook_event_name` …). **Keine** `agent_id` des neuen Agenten.
- **SubagentStart**: `agent_id`, `agent_type`. **Keine** `tool_use_id`, keine Beschreibung.
- **SubagentStop**: `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message`, `stop_hook_active`.
  Feuert auch für interne Agenten von Claude Code (Prompt-Vorschläge, `/btw`).
- Es gibt **keine dokumentierte gemeinsame ID** zwischen `Agent`-Aufruf (`tool_use_id`) und Subagent (`agent_id`).

## Zuordnung beim Austragen

1. PreToolUse trägt einen Eintrag mit `tool_use_id` ein (noch ohne `agent_id`).
2. SubagentStart gibt dem **ältesten unzugeordneten** Eintrag die `agent_id`. Bei gleichzeitigen Starts kann die
   Zuordnung vertauscht sein; die **Anzahl** stimmt trotzdem, nur Beschreibung/Opus-Merkmal könnten zwischen zwei Einträgen wechseln.
3. SubagentStop trägt den Eintrag mit passender `agent_id` aus. Gibt es keinen, wird der **älteste unzugeordnete**
   Eintrag ausgetragen (Rückfall, falls SubagentStart nicht feuerte). Gibt es auch den nicht, passiert nichts
   (interner Agent, doppeltes Stop).

## Bekannte Grenzen

- Fortsetzen per `SendMessage` läuft nicht über `Agent` und wird **nicht gezählt**.
- Ohne `model` im Aufruf erbt der Agent das Modell der Sitzung; ist das Opus, zählt er nicht als Opus.
- Einträge werden nach 6 h als verwaist verworfen; zugelassene, aber nie gestartete (z. B. von Rechteprüfung
  abgelehnte) nach 10 Minuten ohne SubagentStart.
- Das Skript ist ein Wächter, kein Schloss: bei eigenem Fehler (kaputtes JSON, fehlendes `python3`) meldet es eine
  Warnung per `systemMessage` und lässt den Start zu.
- Die Zähldatei gilt pro Projektverzeichnis (`CLAUDE_PROJECT_DIR`), nicht über mehrere Sitzungen hinweg gemeinsam
  genutzter Worktrees hinweg.

## So ändert Daniel die Grenze

Daniel sagt einen Satz wie „Slots auf 3“ oder „Sonderslot bis heute Abend“. Der Orchestrator ändert dann **nur**
`.claude/state/slot-grenze.json` (Skript bleibt unberührt), trägt `gesetzt`/`von` ein und meldet die neue Grenze zurück.
Ohne Daniels ausdrücklichen Satz wird die Datei nicht geändert. Zurück zur Vorgabe: Datei löschen oder `bis` verstreichen lassen.
