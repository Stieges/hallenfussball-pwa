# CI Failure Analyse - 2025-12-30

## Zusammenfassung

| Feld | Wert |
|------|------|
| **Betroffene Runs** | [#20596563711](https://github.com/Stieges/hallenfussball-pwa/actions/runs/20596563711), [#20596410119](https://github.com/Stieges/hallenfussball-pwa/actions/runs/20596410119) |
| **Fehler** | `Error: Timed out waiting 120000ms from config.webServer.` |
| **Root Cause** | Playwright-Projekt-Namen in CI und Config divergiert |
| **Fix** | CI Workflow aktualisiert (`iPhone 13 Safari` → `iPhone 13`) |

---

## Root Cause Analyse

### Problem 1: Projekt-Namen Mismatch (BEHOBEN)

1. Commit `9ca0e94` (feat(testing): Add QA testing system...) änderte `playwright.config.ts`
2. Die Projekt-Namen wurden vereinfacht:
   - `'iPhone 13 Safari'` → `'iPhone 13'`
   - `'iPhone SE Safari'`, `'iPhone 15 Pro Safari'`, `'Desktop Safari'` entfernt
3. **Die CI-Workflow-Datei wurde NICHT aktualisiert**
4. CI versuchte `npx playwright test --project="iPhone 13 Safari"` auszuführen
5. Playwright fand das Projekt nicht → Timeout beim WebServer-Start

**Fix:** ci.yml aktualisiert (Commit `6063992`)

### Problem 2: Port-Mismatch (BEHOBEN)

Nach dem ersten Fix trat weiterhin ein Timeout auf:

| Config | Port | Hinweis |
|--------|------|---------|
| `vite.config.ts` (committed) | `3000` | Original |
| `vite.config.ts` (lokal) | `3002` | Uncommitted! |
| `playwright.config.ts` (alt) | `5173` | Default |

**Ursache:** Die lokale vite.config.ts hatte uncommitted Änderungen (3002),
aber CI verwendet den committed Stand (3000). Playwright wurde fälschlich
auf 3002 gesetzt.

**Fix:** Beide Configs auf Port 3000 vereinheitlicht

### Diff der Änderung

```diff
# playwright.config.ts
-    name: 'iPhone 13 Safari',
+    name: 'iPhone 13',

# .github/workflows/ci.yml (WAR NICHT GEÄNDERT)
project: ['iPhone 13 Safari', 'Pixel 5', 'Desktop Chrome']
```

### Fehler-Symptom vs. Ursache

| Symptom | Echte Ursache |
|---------|---------------|
| `Timed out waiting 120000ms from config.webServer` | Playwright startet WebServer, findet aber kein passendes Projekt |

---

## Fix

```yaml
# .github/workflows/ci.yml
matrix:
  project: ['iPhone 13', 'Pixel 5', 'Desktop Chrome']  # War: iPhone 13 Safari
```

---

## Handlungsempfehlungen

### 1. Pre-Commit Check für CI/Config Sync (HOCH)

**Problem:** Änderungen an `playwright.config.ts` vergessen oft die CI-Datei.

**Lösung:** Husky Pre-Commit Hook hinzufügen:

```bash
# .husky/pre-commit (erweitern)
if git diff --cached --name-only | grep -q "playwright.config.ts"; then
  echo "⚠️  playwright.config.ts geändert - ci.yml auch prüfen!"
  grep -E "project:" .github/workflows/ci.yml
  echo "---"
  grep -E "name:" playwright.config.ts | grep "'"
fi
```

### 2. GitHub Actions Workflow Test lokal (MITTEL)

**Problem:** CI-Fehler werden erst nach Push bemerkt.

**Lösung:** [act](https://github.com/nektos/act) für lokale Workflow-Tests installieren:

```bash
brew install act
act -j e2e-tests --list  # Prüft Syntax
```

### 3. CI-Projekt-Namen aus Config ableiten (MITTEL)

**Problem:** Doppelte Definition von Projekt-Namen.

**Lösung:** CI-Workflow dynamisch machen (erfordert mehr Setup):

```yaml
# Option A: Alle Projekte testen
- name: Run E2E tests
  run: npx playwright test  # Ohne --project

# Option B: Matrix aus Config extrahieren (komplex)
```

### 4. Playwright Config-Validierung in CI (NIEDRIG)

```yaml
- name: Validate Playwright config
  run: |
    npx playwright test --list 2>&1 | grep -E "project:" || exit 1
```

### 5. Dokumentation erweitern

In `.claude/CLAUDE.md` oder `TESTING.md` hinzufügen:

```markdown
## CI/Test-Konfiguration

**WICHTIG:** Bei Änderungen an `playwright.config.ts`:
1. Prüfe `.github/workflows/ci.yml` Matrix-Projektnamen
2. Stelle sicher dass alle CI-Projektnamen in der Config existieren
```

---

## Präventions-Checkliste

| # | Maßnahme | Aufwand | Impact |
|---|----------|---------|--------|
| 1 | Pre-Commit Warning für playwright.config.ts | 15 min | Hoch |
| 2 | `act` für lokale CI-Tests | 30 min | Mittel |
| 3 | Docs Update (Workflow-Sync Hinweis) | 10 min | Mittel |
| 4 | CI ohne explizite Projektnamen | 1h | Niedrig (weniger Kontrolle) |

---

## Nächste Schritte

1. ✅ Fix committed (ci.yml aktualisiert)
2. [ ] Push und CI-Run verifizieren
3. [ ] Pre-Commit Hook hinzufügen (optional)
4. [ ] Docs aktualisieren (optional)
