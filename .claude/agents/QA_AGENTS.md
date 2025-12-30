# Quality Assurance Agents

> **Datei:** `.claude/agents/QA_AGENTS.md`
> **Hauptbefehl:** `vollständiger test`

---

## Hauptbefehl

```
vollständiger test
```

Führt **ALLE 11 Agents** der Reihe nach aus und erstellt einen konsolidierten Report.

---

## Alle Agents

| # | Agent | Prüft |
|---|-------|-------|
| 1 | @code-quality | Lint, Types, Patterns, Tech Debt |
| 2 | @security | Dependencies, XSS, DSGVO |
| 3 | @functional | Features wie spezifiziert |
| 4 | @ui-ux | Design Tokens, Konsistenz, Usability |
| 5 | @device | Mobile, Desktop, Cross-Browser |
| 6 | @accessibility | WCAG, Keyboard, Screen Reader |
| 7 | @performance | Bundle Size, Ladezeit, Runtime |
| 8 | @pwa | Offline, Service Worker, Install |
| 9 | @api | Endpoints, Validierung, Errors |
| 10 | @regression | Keine alten Bugs wieder da |
| 11 | **@usability** | Nielsen Heuristics, Task Flows, Mobile/Desktop UX |

---

## Ablauf bei "vollständiger test"

```
┌─────────────────────────────────────────────────────────────────┐
│  VOLLSTÄNDIGER TEST                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. @code-quality    ──→ Lint + Types prüfen                    │
│         ↓                                                       │
│  2. @security        ──→ npm audit + Code-Patterns              │
│         ↓                                                       │
│  3. @functional      ──→ Unit Tests + E2E Happy Paths           │
│         ↓                                                       │
│  4. @ui-ux           ──→ Design Token Compliance                │
│         ↓                                                       │
│  5. @device          ──→ Mobile + Desktop Tests                 │
│         ↓                                                       │
│  6. @accessibility   ──→ axe-core + Keyboard                    │
│         ↓                                                       │
│  7. @performance     ──→ Bundle + Lighthouse                    │
│         ↓                                                       │
│  8. @pwa             ──→ Manifest + Offline                     │
│         ↓                                                       │
│  9. @api             ──→ Endpoints (falls vorhanden)            │
│         ↓                                                       │
│  10. @regression     ──→ Alle Tests nochmal                     │
│         ↓                                                       │
│  11. @usability      ──→ Nielsen Heuristics + Task Flows        │
│         ↓                                                       │
│  ══════════════════════════════════════════════════════════     │
│  CONSOLIDATED REPORT → docs/qa-reports/[DATUM]-FULL-QA.md       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Weitere Befehle

| Befehl | Was passiert |
|--------|--------------|
| `vollständiger test` | Alle 11 Agents |
| `schneller test` | @code-quality + @functional (nur Happy Path) |
| `vor release` | @regression + @security + @performance + @device |
| `Führe @[agent] aus` | Einzelner Agent |
| `Führe @usability aus` | Vollständiger Usability-Durchlauf (11 Teile) |
| `Führe @usability aus für [Feature]` | Fokussierter Usability-Test |
| `Führe @usability-mobile aus` | Nur Mobile-Usability |
| `Führe @usability-desktop aus` | Nur Desktop-Usability |
| `Führe @usability-flows aus` | Nur Task-Flow-Analyse |

---

## Einzelne Agents: Details

---

### Agent 1: @code-quality

**Prüft:** Linting, TypeScript, Patterns, Tech Debt

**Befehle:**
```bash
npm run lint
npx tsc --noEmit
grep -r ": any" src/ --include="*.ts" --include="*.tsx" | wc -l
grep -r "@ts-ignore" src/ | wc -l
find src -name "*.tsx" -exec wc -l {} \; | sort -rn | head -10
```

**Checkliste:**
- [ ] ESLint ohne Errors
- [ ] ESLint Warnings < 20
- [ ] Keine `any` Types
- [ ] Keine @ts-ignore ohne Begründung
- [ ] Komponenten < 300 Zeilen
- [ ] Test Coverage > 30%

**Output:**
```markdown
## @code-quality Report

### Linting
| Metrik | Wert | Status |
|--------|------|--------|
| Errors | X | ✅/❌ |
| Warnings | X | ✅/⚠️ |

### TypeScript
| Check | Count | Status |
|-------|-------|--------|
| `any` Types | X | ✅/❌ |
| @ts-ignore | X | ✅/⚠️ |

### Dateigröße
| Datei | Zeilen | Status |
|-------|--------|--------|
| größte | X | ✅/❌ |
```

---

### Agent 2: @security

**Prüft:** Dependencies, XSS, Secrets, DSGVO

**Befehle:**
```bash
npm audit
npm audit --audit-level=high
npm outdated
grep -r "dangerouslySetInnerHTML" src/
grep -r "eval(" src/
grep -r "innerHTML" src/
grep -r "console.log" src/ --include="*.ts" --include="*.tsx" | grep -v test | wc -l
```

**Checkliste:**
- [ ] npm audit: keine critical/high
- [ ] Kein dangerouslySetInnerHTML ohne Sanitizing
- [ ] Keine hardcoded Secrets
- [ ] Keine console.logs in Production

**Output:**
```markdown
## @security Report

### Dependencies
| Severity | Count | Action |
|----------|-------|--------|
| Critical | X | 🔴 Sofort |
| High | X | 🔴 Sofort |
| Moderate | X | 🟡 Bald |

### Code Patterns
| Check | Status |
|-------|--------|
| XSS Patterns | ✅/❌ |
| Console.logs | X Stellen |
```

---

### Agent 3: @functional

**Prüft:** Features funktionieren wie spezifiziert

**Befehle:**
```bash
npm test -- --run
npm run test:e2e -- tests/e2e/flows/
```

**Checkliste:**
- [ ] Alle Unit Tests grün
- [ ] E2E Happy Paths grün
- [ ] Edge Cases getestet
- [ ] Error States funktionieren

**Output:**
```markdown
## @functional Report

### Tests
| Suite | Passed | Failed |
|-------|--------|--------|
| Unit | X | X |
| E2E | X | X |

### Kritische Flows
| Flow | Status |
|------|--------|
| Tournament erstellen | ✅/🐛 |
| Match Scoring | ✅/🐛 |
```

---

### Agent 4: @ui-ux

**Prüft:** Design Tokens, Konsistenz, Usability

**Befehle:**
```bash
# Hardcoded Farben finden
grep -rE "#[0-9a-fA-F]{3,6}" src/components --include="*.tsx" --include="*.ts" | grep -v test | grep -v ".d.ts"

# Hardcoded Pixel finden
grep -rE "[0-9]+px" src/components --include="*.tsx" --include="*.ts" | grep -v test | grep -v node_modules

# Design Token Usage
grep -r "colors\." src/components | wc -l
grep -r "spacing\." src/components | wc -l
```

**Checkliste:**
- [ ] Keine hardcoded Farben (#xxx)
- [ ] Keine hardcoded Spacing (Xpx)
- [ ] Keine hardcoded Font Sizes
- [ ] Loading States vorhanden
- [ ] Empty States vorhanden
- [ ] Error States hilfreich

**Output:**
```markdown
## @ui-ux Report

### Design Token Compliance
| Kategorie | Violations |
|-----------|------------|
| Farben | X Stellen |
| Spacing | X Stellen |
| Typography | X Stellen |

### Violations
| Datei | Zeile | Problem | Fix |
|-------|-------|---------|-----|
| ... | ... | #fff | colors.white |
```

---

### Agent 5: @device

**Prüft:** Mobile, Desktop, Cross-Browser

**Befehle:**
```bash
npm run test:e2e -- --project="iPhone 13"
npm run test:e2e -- --project="Pixel 5"
npm run test:e2e -- --project="Desktop Chrome"
```

**Device Matrix:**
| Device | Viewport | Touch | Priorität |
|--------|----------|-------|-----------|
| iPhone 13 | 390×844 | ✅ | 🔴 Hoch |
| Pixel 5 | 393×851 | ✅ | 🔴 Hoch |
| Desktop | 1920×1080 | ❌ | 🔴 Hoch |

**Checkliste:**
- [ ] viewport-fit=cover
- [ ] 100dvh statt 100vh
- [ ] Touch Targets ≥44px
- [ ] Input font-size ≥16px
- [ ] touch-action: manipulation
- [ ] Safe Area Insets

**Output:**
```markdown
## @device Report

### Test Matrix
| Device | Status | Issues |
|--------|--------|--------|
| iPhone 13 | ✅/🐛 | |
| Pixel 5 | ✅/🐛 | |
| Desktop | ✅/🐛 | |

### Touch Target Violations
| Element | Größe | Required |
|---------|-------|----------|
| ... | 32px | 44px |
```

---

### Agent 6: @accessibility

**Prüft:** WCAG 2.1 AA, Keyboard, Screen Reader

**Befehle:**
```bash
npm run test:e2e -- tests/e2e/usability/accessibility.spec.ts
```

**Checkliste:**
- [ ] axe-core: keine critical/serious
- [ ] Kontraste ≥4.5:1
- [ ] Alle Funktionen per Keyboard
- [ ] Focus sichtbar
- [ ] Escape schließt Modals
- [ ] Überschriften-Hierarchie korrekt

**Output:**
```markdown
## @accessibility Report

### axe-core
| Impact | Count |
|--------|-------|
| Critical | X |
| Serious | X |
| Moderate | X |

### Keyboard
| Aktion | Status |
|--------|--------|
| Tab Navigation | ✅/❌ |
| Focus Visible | ✅/❌ |
| Escape Dialogs | ✅/❌ |
```

---

### Agent 7: @performance

**Prüft:** Bundle Size, Ladezeit, Runtime

**Befehle:**
```bash
npm run build
du -sh dist/
ls -la dist/assets/*.js
npx vite-bundle-visualizer  # optional
```

**Thresholds:**
| Metrik | Gut | Akzeptabel | Schlecht |
|--------|-----|------------|----------|
| Bundle (gzip) | <200KB | <500KB | >500KB |
| FCP | <1s | <1.5s | >2s |
| LCP | <1.5s | <2.5s | >3s |

**Output:**
```markdown
## @performance Report

### Bundle
| Chunk | Size | Status |
|-------|------|--------|
| main.js | XXX KB | ✅/⚠️/❌ |
| Total | XXX KB | ✅/⚠️/❌ |

### Empfehlungen
1. ...
```

---

### Agent 8: @pwa

**Prüft:** Offline, Service Worker, Install

**Befehle:**
```bash
cat public/manifest.json
grep -E "(theme-color|apple-mobile|manifest)" index.html
```

**Checkliste:**
- [ ] manifest.json vorhanden & valide
- [ ] Icons in 192 + 512
- [ ] display: standalone
- [ ] theme-color gesetzt
- [ ] apple-mobile-web-app-capable
- [ ] Service Worker registriert
- [ ] Offline-Fallback funktioniert

**Output:**
```markdown
## @pwa Report

### Manifest
| Feld | Status |
|------|--------|
| name | ✅/❌ |
| icons | ✅/❌ |
| display | ✅/❌ |

### Offline Test
| Check | Status |
|-------|--------|
| SW registriert | ✅/❌ |
| App lädt offline | ✅/❌ |
```

---

### Agent 9: @api

**Prüft:** Endpoints, Validierung, Errors (falls Backend vorhanden)

**Hinweis:** Bei localStorage-only App überspringen.

**Checkliste:**
- [ ] Alle Endpoints erreichbar
- [ ] Input Validierung
- [ ] Error Handling (4xx, 5xx)
- [ ] Timeout Handling
- [ ] Offline Handling

---

### Agent 10: @regression

**Prüft:** Keine alten Bugs wieder eingeführt

**Befehle:**
```bash
npm test -- --run
npm run test:e2e
```

**Checkliste:**
- [ ] Alle Unit Tests grün
- [ ] Alle E2E Tests grün
- [ ] Keine neuen skipped Tests
- [ ] Gefixte Bugs sind noch gefixt

**Output:**
```markdown
## @regression Report

### Tests
| Suite | Passed | Failed | Skipped |
|-------|--------|--------|---------|
| Unit | X | X | X |
| E2E | X | X | X |

### Regressions
| Feature | Problem |
|---------|---------|
| (keine) | ✅ |
```

---

### Agent 11: @usability

**Prüft:** Nielsen Heuristics, Mobile/Desktop UX, Task Flows, Cognitive Load

**Detaillierte Dokumentation:** `.claude/agents/USABILITY_AGENT.md`

**11 Prüfbereiche:**
1. Nielsen's 10 Heuristics
2. Mobile Usability (One-Handed, Touch, Gestures)
3. Desktop Usability (Keyboard, Mouse, Multi-Window)
4. Task-Flow-Analyse (Effizienz, Klicks, Zeit)
5. Fehlertoleranz & Recovery
6. Cognitive Load & Information Architecture
7. Feedback & Guidance
8. Navigation & Orientierung
9. Formular-Usability
10. Onboarding & Hilfe
11. Kontext-spezifisch (Spielfeldrand-Szenario)

**Kritische Task-Flow-Ziele:**
| Flow | Klicks (Ziel) | Zeit (Ziel) |
|------|---------------|-------------|
| Tor erfassen | ≤2 | ≤3s |
| Spieler wechseln | ≤3 | ≤5s |
| Nächstes Spiel starten | ≤1 | ≤2s |
| Ergebnis korrigieren | ≤3 | ≤5s |
| Turnier erstellen | ≤15 | ≤5min |

**Touch Target Requirements:**
| Element-Typ | Minimum | Empfohlen |
|-------------|---------|-----------|
| Sekundär-Buttons | 44×44px | 48×48px |
| Primär-Buttons | 48×48px | 56×56px |
| Score-Buttons | 56×56px | 64×64px |

**Output:**
```markdown
## @usability Report

### Nielsen Heuristics
| Heuristik | Status | Issues |
|-----------|--------|--------|
| Sichtbarkeit Status | ✅/⚠️/❌ | X |
| System/Welt Match | ✅/⚠️/❌ | X |
| Benutzerkontrolle | ✅/⚠️/❌ | X |
| Konsistenz | ✅/⚠️/❌ | X |
| Fehlervermeidung | ✅/⚠️/❌ | X |
| Wiedererkennung | ✅/⚠️/❌ | X |
| Flexibilität | ✅/⚠️/❌ | X |
| Ästhetik | ✅/⚠️/❌ | X |
| Fehlerbehandlung | ✅/⚠️/❌ | X |
| Hilfe | ✅/⚠️/❌ | X |

### Mobile Usability
| Check | Status |
|-------|--------|
| One-Handed Operation | ✅/❌ |
| Touch Targets ≥44px | ✅/❌ |
| Touch Feedback | ✅/❌ |
| Input Zoom (≥16px) | ✅/❌ |

### Task Flows
| Flow | Klicks | Zeit | Status |
|------|--------|------|--------|
| Tor erfassen | X | Xs | ✅/❌ |
| ... | ... | ... | ... |

### Spielfeldrand-Tauglichkeit
| Anforderung | Status |
|-------------|--------|
| One-Handed | ✅/❌ |
| Große Touch Targets | ✅/❌ |
| Schnelles Tor-Erfassen | ✅/❌ |
| Offline-fähig | ✅/❌ |
| Gute Lesbarkeit | ✅/❌ |
| Fehlertoleranz | ✅/❌ |
```

---

## Consolidated Report Template

Nach `vollständiger test` wird erstellt:

**Datei:** `docs/qa-reports/YYYY-MM-DD-FULL-QA.md`

```markdown
# Vollständiger Test Report – [DATUM]

## Zusammenfassung

| Agent | Status | Critical | High | Medium |
|-------|--------|----------|------|--------|
| @code-quality | ✅/⚠️/❌ | 0 | 0 | 0 |
| @security | ✅/⚠️/❌ | 0 | 0 | 0 |
| @functional | ✅/⚠️/❌ | 0 | 0 | 0 |
| @ui-ux | ✅/⚠️/❌ | 0 | 0 | 0 |
| @device | ✅/⚠️/❌ | 0 | 0 | 0 |
| @accessibility | ✅/⚠️/❌ | 0 | 0 | 0 |
| @performance | ✅/⚠️/❌ | 0 | 0 | 0 |
| @pwa | ✅/⚠️/❌ | 0 | 0 | 0 |
| @api | ✅/⚠️/❌ | 0 | 0 | 0 |
| @regression | ✅/⚠️/❌ | 0 | 0 | 0 |
| @usability | ✅/⚠️/❌ | 0 | 0 | 0 |

**Gesamt:** X Critical, X High, X Medium

## 🔴 Critical Issues (Blocker)

1. ...

## 🟠 High Priority

1. ...

## 🟡 Medium Priority

1. ...

## Details pro Agent

### @code-quality
[Details]

### @security
[Details]

...

## Empfehlungen

1. ...

## Nächste Schritte

- [ ] Critical Issues fixen
- [ ] High Priority diese Woche
- [ ] Medium Priority ins Backlog

---
Generated: [TIMESTAMP]
```
