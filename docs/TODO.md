# TODO - Hallenfußball PWA

> Zentrale Aufgabenliste für das Projekt. Neue Aufgaben werden hier erfasst.
> **Letzte Aktualisierung:** 2025-12-29

---

## 🔴 Aktuell in Arbeit

### Live-Cockpit (Scoreboard)

**Referenz:** `docs/concepts/LIVE-COCKPIT-KONZEPT.md`
**Gap-Analyse:** 2025-12-27 durchgeführt

> ⚠️ **Hinweis:** Es existiert bereits eine umfangreiche Implementierung in `src/components/live-cockpit/`.
> Die Phasen wurden basierend auf der Gap-Analyse aktualisiert.

---

### Phase 1: Types & Hooks – OFFEN

| Aufgabe | Status | Commit | Notizen |
|---------|--------|--------|---------|
| Types erweitern (`tournament.ts`) | ✅ Erledigt | `fffa28c` | `MatchEventType`, `MatchEvent`, `MatchState`, `ActivePenalty`, `PenaltyShootout`, `PenaltyKick`, `KnockoutConfig` |
| `useDialogTimer` Hook | ✅ Erledigt | – | Auto-Dismiss Countdown-Timer für Dialoge |
| `useMatchTimer` Hook | ⬜ Offen | – | Timer-Logik aus LiveCockpit extrahieren |
| `useLiveCockpit` Hook | ⬜ Offen | – | State-Management aus LiveCockpit extrahieren |

**Nächster Schritt:** Types erweitern in `tournament.ts`
**Konzept-Referenz:** Abschnitt 8 (Datenmodell)

---

### Phase 2: Kern-Komponenten – ✅ ERLEDIGT

| Aufgabe | Status | Commit | Notizen |
|---------|--------|--------|---------|
| Ordnerstruktur anlegen | ✅ Erledigt | – | `src/components/live-cockpit/` existiert |
| `ScoreDisplay` | ✅ Erledigt | – | `components/ScoreDisplay/index.tsx` |
| `GoalButton` (ActionZone) | ✅ Erledigt | – | `components/ActionZone/index.tsx` |
| `MatchControls` (Footer) | ✅ Erledigt | – | `components/FooterBar/index.tsx` |
| `Header` | ✅ Erledigt | – | `components/Header/index.tsx` mit Modus, Undo |
| `GoalScorerDialog` | ✅ Erledigt | – | Mit Auto-Dismiss Timer (10s, `useDialogTimer`) |
| `LiveCockpit` (Container) | ✅ Erledigt | – | `LiveCockpit.tsx` (650 LOC) |

**Status:** Vollständig implementiert inkl. Auto-Dismiss Timer.

---

### Phase 3: Erweiterte Features – GRÖSSTENTEILS ERLEDIGT

| Aufgabe | Status | Commit | Notizen |
|---------|--------|--------|---------|
| `usePenaltyTimer` Hook | ⬜ Offen | – | Mehrere Zeitstrafen parallel |
| `useMode` Hook | ✅ Erledigt | – | In Header/LiveCockpit implementiert |
| `useUndo` Hook | ⬜ Offen | – | Logik existiert, aber nicht als Hook |
| `CardDialog` | ✅ Erledigt | – | 3-Step Flow: Kartentyp → Team → Spieler |
| `TimePenaltyDialog` | ✅ Erledigt | – | 3-Step Flow: Dauer → Team → Spieler |
| `SubstitutionDialog` | ✅ Erledigt | – | 3-Step Flow: Team → Raus → Rein |
| `PenaltyIndicators` | ✅ Erledigt | – | Countdown-Anzeige mit Farbwechsel bei <10s |
| `EventLog` | ⚠️ Teilweise | – | Inline in LiveCockpit, nicht extrahiert |
| `OpenEntriesSection` | ✅ Erledigt | – | Collapsible mit Badge-Counter |
| `ModeSwitch` | ✅ Erledigt | – | In Header implementiert |
| `MoreMenu` | ✅ Erledigt | – | `ExtendedActionsPanel/index.tsx` |
| `PlayerNumberPicker` | ⬜ Offen | – | Wiederverwendbar aus Dialogen extrahieren |

**Konzept-Referenz:** Abschnitt 3.2 (Aktionen-Matrix), Abschnitt 5.2-5.4 (Eingabe-Flows)

**Fertig:** `CardDialog`, `TimePenaltyDialog`, `SubstitutionDialog`, `PenaltyIndicators`, `OpenEntriesSection`

---

### Phase 4: Penalty-Schießen – TEILWEISE ERLEDIGT

| Aufgabe | Status | Commit | Notizen |
|---------|--------|--------|---------|
| `usePenaltyShootout` Hook | ⬜ Offen | – | Logik in Dialog, nicht als Hook |
| `TiebreakerBanner` | ✅ Erledigt | – | `Tiebreaker/TiebreakerBanner.tsx` |
| `PenaltyShootoutDialog` | ✅ Erledigt | – | `Tiebreaker/PenaltyShootoutDialog.tsx` |
| `PenaltyResultDialog` | ⬜ Offen | – | Nur Endergebnis (Alternative zu Tracking) |
| Integration in MatchControls | ✅ Erledigt | – | Callbacks vorhanden |

**Konzept-Referenz:** Abschnitt 6 (Penalty-Schießen)

---

### Zusammenfassung: Priorisierte TODO-Liste

| Prio | Aufgabe | Phase | Status |
|:----:|---------|-------|--------|
| ~~1~~ | ~~Types erweitern (MatchEventType, MatchState, etc.)~~ | 1 | ✅ Erledigt |
| ~~2~~ | ~~`useDialogTimer` Hook + GoalScorerDialog Auto-Dismiss~~ | 1 | ✅ Erledigt |
| ~~3~~ | ~~`CardDialog` implementieren~~ | 3 | ✅ Erledigt |
| ~~4~~ | ~~`TimePenaltyDialog` implementieren~~ | 3 | ✅ Erledigt |
| ~~5~~ | ~~`PenaltyIndicators` (Laufende Strafen)~~ | 3 | ✅ Erledigt |
| ~~6~~ | ~~`SubstitutionDialog` implementieren~~ | 3 | ✅ Erledigt |
| ~~7~~ | ~~`OpenEntriesSection` implementieren~~ | 3 | ✅ Erledigt |
| 8 | `useMatchTimer` Hook extrahieren | 1 | Offen |
| 9 | `useLiveCockpit` Hook extrahieren | 1 | Offen |
| 10 | `PenaltyResultDialog` (nur Endergebnis) | 4 | Offen |

---

## 🟡 Backlog

### Features

| Aufgabe | Priorität | Geschätzt | User Story |
|---------|-----------|-----------|------------|
| Monitor-Ansicht (TV-Modus) | Hoch | - | US-MON-TV-DISPLAY |
| Public View (Zuschauer-Link) | Mittel | - | - |
| Trainer-Cockpit | Mittel | - | US-TRAINER-COCKPIT |
| Turnier kopieren/löschen konzeptionieren | Mittel | - | US-TOURNAMENT-COPY |

### Bugs

| Bug | Priorität | Status | Beschreibung |
|-----|-----------|--------|--------------|
| [BUG-004](bugs/BUG-004-Timer-Springt.md) | 🔴 Critical | ✅ Fixed | Timer springt in 5-Sekunden-Schritten |
| [BUG-005](bugs/BUG-005-Tor-Dialog-Fehlt.md) | 🔴 Critical | ✅ Fixed | Tor ohne Torschütze/Assist-Dialog |
| [BUG-006](bugs/BUG-006-Zeitstrafe-Dialog-Redundant.md) | 🟡 Minor | ✅ Fixed | Zeitstrafe-Dialog fragt redundant nach Zeit |
| [BUG-007](bugs/BUG-007-Karten-Dialog-Redundant.md) | 🟡 Minor | ✅ Fixed | Karten-Dialog mit Quick-Mode |
| [BUG-008](bugs/BUG-008-Zeitstrafe-Cleanup.md) | 🟡 Minor | ✅ Fixed | Zeitstrafe-Countdown + Cleanup |
| [BUG-009](bugs/BUG-009-Wechsel-Dialog.md) | 🟡 Minor | Open | Wechsel-Dialog umständlich |
| [BUG-010](bugs/BUG-010-Event-Nachbearbeitung.md) | 🟠 Major | Open | Event-Log nachträgliche Bearbeitung |
| BUG-003 Grid Insert | Feature Request | - | Insert-between ist nicht Bug, sondern Feature |

### Refactoring

| Aufgabe | Priorität | Betroffene Dateien |
|---------|-----------|-------------------|
| **Wizard: 100+ hardcoded rgba() migrieren** | Hoch | `features/tournament-creation/**` – IST-Analyse: [WIZARD-IST-ANALYSE.md](analysis/WIZARD-IST-ANALYSE.md) |
| Wizard: Neue Subtle/Border Tokens erstellen | Hoch | `design-tokens/colors/semantic.ts` – primarySubtle, secondarySubtle, warningSubtle, goldSubtle + Border-Varianten |
| **Live-Cockpit: LiveCockpit.tsx aufteilen (935→~400 LOC)** | Hoch | `live-cockpit/LiveCockpit.tsx` – IST-Analyse: [LIVE-COCKPIT-IST-ANALYSE.md](analysis/LIVE-COCKPIT-IST-ANALYSE.md) |
| Live-Cockpit: Dialog-Code extrahieren (~300 LOC) | Mittel | `live-cockpit/components/Dialogs/*.tsx` – DialogBase, TeamSelector, PlayerNumberInput |
| Live-Cockpit: ~22 hardcoded fontSize migrieren | Mittel | `live-cockpit/**/*.tsx` – zu fontSizes.* |
| Shared Dialog Styles extrahieren | Mittel | `live-cockpit/components/Dialogs/*.tsx` – ~70% Code-Duplikation zwischen Dialogen (~300 LOC Ersparnis) |
| Team Interface zentralisieren | Niedrig | `live-cockpit/types.ts` → 4× dupliziert in Dialogen |
| formatTime Utility extrahieren | Niedrig | `utils/time.ts` → 3× dupliziert |
| Keyboard-Support für Dialoge | Niedrig | Alle Dialoge – Escape/Enter Shortcuts |
| Focus-Trap für Dialoge | Niedrig | Alle Dialoge – echte Modal-Semantik |
| Design Token Migration | Niedrig | Verbleibende Komponenten (Screens erledigt) |
| Live-Cockpit: Mode aus localStorage laden | Niedrig | `live-cockpit/LiveCockpit.tsx` – fehlendes Init |
| Live-Cockpit: LiveCockpitMockup.tsx entfernen | Niedrig | `live-cockpit/LiveCockpitMockup.tsx` – 602 LOC obsolet? |

### Analyse

| Aufgabe | Priorität | Notizen |
|---------|-----------|---------|
| Themes analysieren | Mittel | Corporate Colors, Dark/Light Mode |
| PDF Creator analysieren | Mittel | pdfExporter.ts, Optimierungspotential |

### Dokumentation

| Aufgabe | Priorität |
|---------|-----------|
| - | - |

---

## Erledigt

| Aufgabe | Erledigt am | Commit |
|---------|-------------|--------|
| Live-Cockpit Layout-Revert (Focus-Mode Compact) | 2025-12-29 | `19c5143` - ScoreDisplay, ActionZone, LiveCockpit |
| Event Logging für Penalties, Cards, Substitutions, Fouls | 2025-12-29 | `c343877` - RuntimeMatchEvent erweitert, Handler verbunden |
| Live-Cockpit IST-Analyse | 2025-12-29 | [LIVE-COCKPIT-IST-ANALYSE.md](analysis/LIVE-COCKPIT-IST-ANALYSE.md) |
| Wizard IST-Analyse | 2025-12-29 | [WIZARD-IST-ANALYSE.md](analysis/WIZARD-IST-ANALYSE.md) |
| Live-Cockpit Dialoge (Card, Penalty, Substitution) | 2025-12-28 | inkl. ARIA, Touch-Targets |
| PenaltyIndicators + OpenEntriesSection | 2025-12-28 | Countdown, Badge-Counter |
| useDialogTimer Hook | 2025-12-28 | Auto-Dismiss für GoalScorerDialog |
| 4-fach Subagent-Review durchgeführt | 2025-12-28 | architecture, code, ux, project |
| useTournamentSync Hook erstellen | 2025-12-27 | 728 → 444 LOC (-284 LOC) |
| ImportDialog modularisieren | 2025-12-27 | 704 → 179 LOC + ImportSteps + ImportTemplates |
| ScheduleTab aufteilen | 2025-12-27 | 493 → 301 LOC + useScheduleTabActions Hook |
| Mobile Bottom Navigation + BottomSheet | 2025-12-27 | Mobile UX Konzept umgesetzt |
| BUG-001: Schedule Sync zwischen Views | 2025-12-27 | TournamentManagementScreen syncMatch() |
| BUG-002: DragGhost Position | 2025-12-27 | GroupStageSchedule DragOverlay fix |
| UX-Patterns Analyse | 2025-12-27 | Umfassende Analyse aller States/Flows |
| Hardcoded Design Tokens ersetzen (Screens) | 2025-12-27 | fontSize/colors in 3 Screens |
| ConfirmDialog konsolidieren | 2025-12-27 | Nur noch 1 Datei |
| ScheduleTab reduzieren | 2025-12-27 | 792 → 493 LOC |
| Screens & Navigation analysieren | 2025-12-27 | Teil der UX-Analyse |
| TournamentCreationScreen: useTournamentWizard integrieren | 2025-12-27 | -414 LOC (1085→671) |
| UI-Komponenten-Analyse (Tabs, Dialoge) | 2025-12-27 | docs/analysis/UI-COMPONENTS-ANALYSIS-2025-12-28.md |
| Screen-Analyse (alle 5 Screens) | 2025-12-27 | docs/analysis/SCREEN-ANALYSIS-2025-12-28.md |
| README.md komplett neu schreiben | 2025-12-27 | eea403a |
| LICENSE erstellen (MIT + Commons Clause) | 2025-12-27 | - |
| API Key Sicherheitslücke fixen | 2025-12-27 | - |

---

## Template für neue Einträge

```markdown
### Neue Aufgabe

| Feld | Wert |
|------|------|
| **Aufgabe** | Kurze Beschreibung |
| **Priorität** | Hoch / Mittel / Niedrig |
| **Kategorie** | Feature / Bug / Refactoring / Docs |
| **User Story** | US-XXX (falls vorhanden) |
| **Betroffene Dateien** | src/... |
| **Notizen** | Zusätzliche Infos |
```
