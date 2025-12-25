# EPIC-CODE-QUALITY: Code-Qualität & Architektur-Optimierung

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | EPIC-CODE-QUALITY |
| **Priorität** | High |
| **Status** | Ready for Planning |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Technische Schulden / Architektur |
| **Gesamtaufwand** | 15-20 Tage |
| **Stories** | 6 |

---

## Executive Summary

Dieses Epic fasst alle identifizierten Code-Qualitäts-Verbesserungen zusammen, basierend auf:
- **Code-Qualitäts-Analyse** (Score: 5.0/10 → Ziel: 8.0/10)
- **6 User Stories** mit detaillierten Refinements
- **adesso AI Hub Refinement-Feedback** für jede Story

### Kritische Erkenntnisse aus Refinements

| Story | Status | Kernfeedback |
|-------|--------|--------------|
| US-TESTING-SETUP | Needs Revision | AC messbar machen, PWA-Testing fehlt, +50% Aufwand |
| US-REFACTOR-MONITOR | Needs Revision | Baseline-Messungen fehlen, Migration-Strategie |
| US-STATE-MANAGEMENT | Major Revision | In Epic splitten, Spike-Story zuerst |
| US-CUSTOM-HOOKS | Needs Revision | Konflikt mit US-PWA-OFFLINE klären |
| US-LAZY-LOADING | Needs Revision | Error Boundaries, Preloading-Strategie |
| US-GOD-COMPONENTS | Needs Revision | Aufwand 2-3x unterschätzt, Rollback-Plan |

---

## Priorisierte Umsetzungsreihenfolge

### Sprint 1: Fundament (5 Tage)

#### 1.1 US-TESTING-SETUP (Kritisch - Zuerst)
**Begründung:** Ohne Tests sind alle anderen Refactorings riskant.

**Angepasste Acceptance Criteria:**
```markdown
GIVEN das Projekt
WHEN ich `npm test` ausführe
THEN werden mindestens 20 Unit Tests erfolgreich ausgeführt
AND die Code Coverage beträgt mindestens 30% (Utils: 60%)
AND E2E Smoke Tests für 3 Kern-User-Flows existieren
```

**Angepasster Aufwand:** 35-40h (statt 24h)

**Aufgaben:**
- [ ] Vitest + Testing Library Setup (4h)
- [ ] Test Factories für Tournament, Team, Match (4h)
- [ ] scheduleGenerator.ts Tests (8h)
- [ ] playoffResolver.ts Tests (6h)
- [ ] Playwright E2E Setup + 3 Smoke Tests (8h)
- [ ] CI/CD Pipeline (4h)
- [ ] **NEU:** Service Worker Testing mit MSW (6h)

---

### Sprint 2: Architektur-Fundament (5 Tage)

#### 2.1 SPIKE: State-Management-Evaluation (1 Tag)
**Begründung:** Vor Implementierung Optionen evaluieren.

**Aufgaben:**
- [ ] ADR (Architecture Decision Record) erstellen
- [ ] Context API vs Zustand vs Jotai evaluieren
- [ ] Performance-Baseline messen (React DevTools Profiler)
- [ ] Props-Drilling-Tiefe dokumentieren
- [ ] Empfehlung mit Begründung

#### 2.2 US-CUSTOM-HOOKS (2 Tage)
**Begründung:** Wiederverwendbare Hooks sind Basis für weitere Refactorings.

**Angepasste Acceptance Criteria:**
```markdown
GIVEN Custom Hooks
WHEN implementiert
THEN existieren useLocalStorage, useDebounce, useMediaQuery, useMatchTimer
AND alle Hooks haben >80% Test Coverage
AND Bundle-Size-Impact <2KB
AND Keine Memory Leaks (useEffect cleanup verifiziert)
```

**Abstimmung erforderlich:**
- [ ] Mit US-PWA-OFFLINE bzgl. `useLocalStorage` koordinieren

**Angepasster Aufwand:** 12h (statt 8h)

#### 2.3 US-STATE-MANAGEMENT (2 Tage)
**Begründung:** Nach Spike-Ergebnis und Custom Hooks.

**Angepasste Acceptance Criteria:**
```markdown
GIVEN TournamentContext
WHEN implementiert
THEN ist Props-Drilling von 6 auf max. 2 Ebenen reduziert
AND Performance-Baseline ist dokumentiert (vor/nach)
AND Alle Management-Tabs nutzen useTournament()
AND Bestehende Tournaments sind migriert
```

**Angepasster Aufwand:** 20h (statt 16h)

---

### Sprint 3: Refactoring (5 Tage)

#### 3.1 US-REFACTOR-MONITOR (3 Tage)
**Begründung:** Größte God Component, höchster Impact.

**Voraussetzungen:**
- [ ] Testing-Setup abgeschlossen
- [ ] Snapshot-Tests für MonitorTab erstellt
- [ ] Performance-Baseline mit React Profiler

**Angepasste Acceptance Criteria:**
```markdown
GIVEN MonitorTab.tsx (1.206 Zeilen)
WHEN refaktorisiert
THEN besteht Container aus max. 300 Zeilen
AND useMatchTimer Hook ist extrahiert und getestet
AND LiveScore, MatchTimer, TVDisplay sind separate Komponenten
AND Alle Snapshot-Tests bestehen (keine visuellen Regressionen)
AND Render-Performance ist um 20% verbessert (gemessen)
```

**Angepasster Aufwand:** 24h (statt 16h)

#### 3.2 US-GOD-COMPONENTS (2 Tage)
**Begründung:** Nach MonitorTab die restlichen God Components.

**Scope-Reduktion (Phase 1):**
- [ ] scheduleGenerator.ts → 4 Module (Höchste Prio)
- [ ] TournamentManagementScreen → Container + Hooks

**Phase 2 (separater Sprint):**
- [ ] playoffResolver.ts
- [ ] GroupStageSchedule.tsx
- [ ] Step4_Teams.tsx

**Angepasster Aufwand:** 16h für Phase 1 (statt 24h gesamt)

---

### Sprint 4: Optimierung (3 Tage)

#### 4.1 US-LAZY-LOADING (1.5 Tage)
**Begründung:** Performance-Optimierung nach stabilem Code.

**Voraussetzungen:**
- [ ] Bundle-Size-Baseline gemessen (mit Vite-Analyse)
- [ ] LCP-Baseline gemessen (mit Lighthouse)

**Angepasste Acceptance Criteria:**
```markdown
GIVEN Lazy Loading
WHEN implementiert
THEN ist Initial Bundle von X KB auf <Y KB reduziert (min. 30%)
AND LCP ist <2.5s (Good-Threshold)
AND Error Boundaries fangen Chunk-Load-Fehler ab
AND Preloading für kritische Routen ist konfiguriert
```

**Angepasster Aufwand:** 12h (statt 8h)

#### 4.2 Monitoring & Dokumentation (1.5 Tage)
- [ ] Bundle-Size-Tracking in CI/CD
- [ ] Performance-Dashboard (Web Vitals)
- [ ] Architektur-Dokumentation aktualisieren
- [ ] Code-Quality-Report (Nachher-Vergleich)

---

## Gemeinsame Definition of Done (alle Stories)

### Code-Qualität
- [ ] TypeScript ohne `any` Types
- [ ] ESLint ohne Errors
- [ ] Keine Datei >300 Zeilen
- [ ] Code Review abgeschlossen

### Testing
- [ ] Unit Tests für neue/geänderte Logik (>80% Coverage)
- [ ] Snapshot-Tests für UI-Komponenten
- [ ] E2E Tests für kritische Flows
- [ ] Memory Leak Tests für Hooks

### Performance
- [ ] Baseline vorher dokumentiert
- [ ] Messung nachher dokumentiert
- [ ] Keine Performance-Regression

### Dokumentation
- [ ] README/ADR aktualisiert
- [ ] Code-Kommentare wo nötig
- [ ] CHANGELOG aktualisiert

---

## Risiko-Matrix

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Regression in Live-Tournaments | Mittel | Hoch | Feature-Flags, Rollback-Plan |
| Performance-Verschlechterung | Niedrig | Mittel | Baseline-Messungen, Profiling |
| Merge-Konflikte | Hoch | Niedrig | Feature-Freeze für Epic |
| Bundle-Size-Increase | Mittel | Mittel | Chunk-Analyse, Tree-Shaking |
| PWA-Sync-Probleme | Mittel | Hoch | Mit US-PWA-OFFLINE koordinieren |

---

## Abhängigkeiten

```
US-TESTING-SETUP
       ↓
   [SPIKE: State Management]
       ↓
  US-CUSTOM-HOOKS
       ↓
US-STATE-MANAGEMENT
       ↓
US-REFACTOR-MONITOR
       ↓
US-GOD-COMPONENTS
       ↓
US-LAZY-LOADING
```

---

## Erfolgskriterien (Epic-Level)

| Metrik | Vorher | Nachher (Ziel) |
|--------|--------|----------------|
| Code-Quality-Score | 5.0/10 | 8.0/10 |
| Test Coverage | 0% | 50% |
| Dateien >300 Zeilen | 6 | 0 |
| Custom Hooks | 0 | 8+ |
| Props-Drilling-Tiefe | 6 Ebenen | 2 Ebenen |
| Initial Bundle Size | ~500KB | <350KB |
| LCP | ~4s | <2.5s |

---

## Nächste Schritte

1. **Sofort:** Stories mit Refinement-Feedback aktualisieren
2. **Sofort:** Baseline-Messungen durchführen:
   - Bundle Size mit `vite build --mode analyze`
   - LCP mit Lighthouse
   - React Profiler Screenshots
3. **Sprint Planning:** Stories in Sprint-Backlog aufnehmen
4. **Kickoff:** Technisches Kickoff-Meeting für das Team

---

## Refinement-Dokumentation

Die vollständigen Refinement-Berichte für jede Story befinden sich in den jeweiligen User-Story-Dateien unter `/User Stories/Features/`.

| Story | Datei | Refinement-Status |
|-------|-------|-------------------|
| Testing Setup | [US-TESTING-SETUP.md](Features/US-TESTING-SETUP.md) | Needs Revision |
| Refactor Monitor | [US-REFACTOR-MONITOR.md](Features/US-REFACTOR-MONITOR.md) | Needs Revision |
| State Management | [US-STATE-MANAGEMENT.md](Features/US-STATE-MANAGEMENT.md) | Major Revision |
| Custom Hooks | [US-CUSTOM-HOOKS.md](Features/US-CUSTOM-HOOKS.md) | Needs Revision |
| Lazy Loading | [US-LAZY-LOADING.md](Features/US-LAZY-LOADING.md) | Needs Revision |
| God Components | [US-GOD-COMPONENTS.md](Features/US-GOD-COMPONENTS.md) | Needs Revision |

---

## Quellen & Referenzen

- [Code-Quality-Analysis.md](/docs/CODE-QUALITY-ANALYSIS.md) - Ursprüngliche Analyse
- React Best Practices 2024/2025
- adesso AI Hub Refinement-Feedback
