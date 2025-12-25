# Workflow Guidelines - Hallenfußball PWA

## Vor jeder Änderung

### 1. Kontext verstehen
```
□ Relevante Serena Memories lesen
□ CODE_INDEX.md konsultieren (betroffene Sektion)
□ Bestehende Patterns im Zielordner prüfen
```

### 2. Abhängigkeiten prüfen
```
□ Wird die Datei anderswo importiert? (find_referencing_symbols)
□ Welche Types werden verwendet?
□ Gibt es ähnliche Implementierungen?
```

## Während der Implementierung

### Code-Qualität
- Bestehende Patterns respektieren
- Keine neuen Anti-Patterns einführen
- Tests für neue Logik schreiben
- TypeScript strikt einhalten

### Komponenten-Größe
- Max 300 Zeilen pro Datei
- Aufteilen wenn größer
- Logik in Hooks extrahieren

## Nach jeder Änderung

### Pflicht-Checks
```bash
npm run lint        # ESLint prüfen
npm test -- --run   # Tests ausführen
npm run build       # Build prüfen
```

### Dokumentation aktualisieren?

| Änderungstyp | CODE_INDEX.md | Memory |
|--------------|---------------|--------|
| Neue Datei/Komponente | ✅ Ja | - |
| Neues Pattern | ✅ Ja | ✅ Ja |
| Bug-Fix | ❌ Nein | - |
| Refactoring (strukturell) | ✅ Ja | ✅ ggf. |
| Kleine Anpassung | ❌ Nein | - |

### CODE_INDEX.md Format
```markdown
### `/src/[pfad]/[datei].tsx` - [Kurzbeschreibung]
**Zweck**: [Was macht die Datei]

**Wichtige Funktionen:**
- `functionName()` - [Beschreibung]

**Exports:**
- `ComponentName` - [Beschreibung]
```

## Git Workflow

### Commit-Nachricht
```
[Typ]: [Kurzbeschreibung]

[Optionale Details]

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Typen
- `Feat:` - Neue Funktionalität
- `Fix:` - Bug-Behebung
- `Refactor:` - Code-Umstrukturierung
- `Docs:` - Dokumentation
- `Test:` - Tests
- `Chore:` - Build, Config, etc.

## Pre-Commit Hooks (automatisch)

1. **lint-staged** - ESLint auf geänderten Dateien
2. **npm test** - Alle Tests ausführen

Commit wird abgelehnt wenn:
- ESLint-Fehler vorhanden
- Tests fehlschlagen

## CI/CD (GitHub Actions)

Bei Push/PR auf `main` oder `develop`:
1. ESLint
2. Tests
3. Production Build
4. Artefakt-Upload

## Troubleshooting

### "Wo gehört diese Datei hin?"
→ Lese `file-structure-guide` Memory

### "Wie soll ich das implementieren?"
→ Lese `component-patterns` Memory

### "Welche Konventionen gelten?"
→ Lese `coding-conventions` Memory

### "Ist mein Code gut genug?"
→ Prüfe gegen `code-quality-analysis` Memory
