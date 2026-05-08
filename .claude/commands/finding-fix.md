---
description: Fix a single finding from docs/findings/INDEX.md by ID
---

# Finding-Fix Command

Du wendest einen Fix für ein Finding aus dem Findings-Backlog an.

## Aufgabe

Argument: $ARGUMENTS (Finding-ID, z.B. `F-042`)

## Schritte

1. Lade die Datei `docs/findings/$ARGUMENTS.md`
2. Lese das Frontmatter (severity, file, model_routing, acceptance_criteria)
3. Rufe `python3 -m findings.finding_fix $ARGUMENTS` auf (aus dem Repo-Root, mit PYTHONPATH=scripts)
4. Wenn `Tests pass: True` und `Fallback used: False`: melde Erfolg
5. Wenn `Fallback used: True`: erkläre dass Sovereign nicht reichte und Haiku übernahm
6. Wenn `Tests pass: False` oder `Path-resolution: failed`:
   - markiere im Frontmatter `status: requires_human_check`
   - melde an User mit konkretem Hinweis was geprüft werden muss

## Wichtig

- Niemals `severity: critical` Findings ohne Mensch-Review committen
- Bei `model_routing: claude-opus-*` immer Diff dem User zeigen vor Commit
- Logs landen in `.claude/logs/finding-fixes.jsonl`
