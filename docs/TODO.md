# TODO - Hallenfußball PWA

> Zentrale Aufgabenliste für das Projekt. Neue Aufgaben werden hier erfasst.
> **Letzte Aktualisierung:** 2026-01-20

---

## 🔴 P0: Enterprise Review Critical Issues

**Detaillierte Dokumentation:**
- 📋 **Implementierungsplan:** [roadmap/P0-IMPLEMENTATION-PLAN.md](roadmap/P0-IMPLEMENTATION-PLAN.md)
- ✅ **TODO-Tracking:** [roadmap/P0-TODOS.md](roadmap/P0-TODOS.md)

| P0 | Problem | Aufwand | Status |
|----|---------|---------|--------|
| P0-1 | Registration Code im Client-Bundle (Sicherheitsrisiko) | 4h | ✅ Erledigt |
| P0-2 | WCAG 4.1.3 Focus Management fehlt (Barrierefreiheit) | 6h | ✅ Erledigt (Basis-Komponenten) |
| P0-3 | Kein IndexedDB (localStorage 5MB Limit) | 8h | ✅ Erledigt |
| P0-4 | Keine Conflict Resolution UI (Cloud/Local Merge) | 6h | ✅ Erledigt |

**Gesamtaufwand:** ~24h ✅ **ALLE P0 ABGESCHLOSSEN** (PR #42 merged 2026-01-16)

**P0-2 Details:** Base components (Dialog, ConfirmDialog, BottomSheet, Auth) sind WCAG 4.1.3 compliant. 24 Feature-Dialoge optional in Follow-up. Details: [docs/wip/FOCUS-TRAP-INTEGRATION-STATUS.md](wip/FOCUS-TRAP-INTEGRATION-STATUS.md)

> ⚠️ **Hinweis:** P0-TODOS.md muss nach jedem abgeschlossenen Task aktualisiert werden!

---

## ✅ ERLEDIGT: Quick Wins aus Three-Agent Review (PR #77)

**Status:** ✅ Erledigt (2026-01-20, PR #77 merged)
**Quelle:** Three-Agent Review nach BUG-001/BUG-002 Commit

| QW | Beschreibung | Aufwand | Status |
|----|--------------|---------|--------|
| QW-001 | Offline-Indikator in AuthSection | 15min | ✅ Erledigt |
| QW-002 | Toast bei Auth-Timeout | 10min | ✅ Erledigt |
| QW-003 | OptimisticLockError UI-Handling | 20min | ✅ Erledigt |
| QW-004 | OptimisticLockError konsolidieren | 30min | ✅ Erledigt |
| QW-005 | LocalStorage Version-Inkrement | 15min | ✅ Erledigt |
| QW-006 | Named Constants für Timeouts | 10min | ✅ Erledigt |

**Betroffene Dateien:**
- `src/core/errors.ts` - Erweiterte OptimisticLockError
- `src/core/repositories/LocalStorageLiveMatchRepository.ts` - Version-Inkrement
- `src/features/auth/context/AuthContext.tsx` - Named Constants + Timeout-Flag
- `src/hooks/useAuthTimeoutToast.ts` - NEU: Toast Hook
- `src/hooks/useMatchExecution.ts` - Toast bei Konflikten
- `src/components/layout/AuthSection.tsx` - Offline-Indikator
- `src/App.tsx` - useAuthTimeoutToast Integration

**Inkludiert Bug-Fixes:**
- **BUG-001:** Auth Session Persistence (15s Timeout, 5 Retries, Exponential Backoff) ✅
- **BUG-002:** Optimistic Locking für Race Conditions ✅

---

## ✅ ERLEDIGT: Supabase Email Templates aktualisiert

**Status:** ✅ Erledigt (2026-01-13, via Management API)
**Priorität:** 🟠 Hoch

> **Problem:** Outlook/O365 Email-Scanner öffnen Links automatisch und verbrauchen Token bevor User klickt.
> **Lösung:** Links auf `/auth/confirm` geändert - diese Seite zeigt einen Button, Scanner klicken nicht auf Buttons.

| Template | Status |
|----------|--------|
| Confirm signup | ✅ Erledigt |
| Magic Link | ✅ Erledigt |
| Reset Password | ✅ Erledigt |
| Invite User | ✅ Erledigt |

**Erledigt:**
- [x] Templates via Supabase Management API aktualisiert
- [x] Deutsche Betreffzeilen gesetzt
- [x] `docs/wip/SUPABASE-EMAIL-TEMPLATES-TODO.md` gelöscht

---

## 🔵 IN ARBEIT: Supabase-Migration

**Status:** 🔵 In Arbeit
**MCP Server:** Konfiguriert in `.mcp.json`
**Project-Ref:** `amtlqicosscsjnnthvzm`

| Schritt | Status | Notizen |
|---------|--------|---------|
| Storage-Key konsolidieren | ✅ Erledigt | Alle nutzen `STORAGE_KEYS.TOURNAMENTS` |
| Supabase MCP konfigurieren | ✅ Erledigt | `.mcp.json` |
| Tabellen erstellen | ✅ Erledigt | tournaments, teams, matches, match_events, live_matches (existierten bereits) |
| `SupabaseRepository` implementieren | ✅ Erledigt | `src/core/repositories/SupabaseRepository.ts` + `supabaseMappers.ts` |
| Repository in App integrieren | ✅ Erledigt | `useRepository` Hook + alle Hooks aktualisiert |
| Migration testen | ⬜ Offen | E2E-Test mit authentifiziertem User |

**Architektur-Änderungen (2026-01-08):**
- `src/utils/storage.ts` gelöscht (toter Code, nutzte anderen Key)
- `src/services/api.ts` → nutzt jetzt `STORAGE_KEYS.TOURNAMENTS`
- `src/core/repositories/LocalStorageRepository.ts` → nutzt `STORAGE_KEYS.TOURNAMENTS`
- `src/contexts/TournamentContext.tsx` → localStorage-Fallback entfernt
- `src/core/repositories/SupabaseRepository.ts` → NEU: Supabase-Implementierung
- `src/core/repositories/supabaseMappers.ts` → NEU: Type-Konvertierung Frontend↔Supabase
- `src/hooks/useRepository.ts` → NEU: Auth-aware Repository-Selektion
- `src/hooks/useMatchExecution.ts` → nutzt jetzt `useRepository`
- `src/hooks/useTournamentWizard.ts` → nutzt jetzt `useRepository`
- `src/hooks/useTournamentManager.ts` → nutzt jetzt `useRepository`
- `src/hooks/useScheduleManager.ts` → nutzt jetzt `useRepository`

**Nächste Session:** E2E-Test mit authentifiziertem User durchführen.

---

## ✅ ERLEDIGT: Guest Data Migration (Auth)

**Status:** ✅ Erledigt (2026-01-19)
**Quelle:** Externes Code-Review (2026-01-11)

> **Lösung:** `guestMigrationService.ts` implementiert und in `authActions.ts` integriert.

### Implementierung

| Aufgabe | Status | Datei |
|---------|--------|-------|
| Migration-Service erstellen | ✅ Erledigt | `src/features/auth/services/guestMigrationService.ts` |
| Lokale Turniere laden bei Registrierung | ✅ Erledigt | `authActions.ts` → `register()` Z.181 |
| `owner_id` setzen für alle lokalen Turniere | ✅ Erledigt | Via `SupabaseRepository.save()` |
| Turniere nach Supabase hochladen | ✅ Erledigt | `migrateGuestTournaments()` |
| Lokale Kopie löschen nach Upload | ✅ Erledigt | `localRepo.delete()` nach Success |
| Fehlerbehandlung (partielle Migration) | ✅ Erledigt | `MigrationResult` mit `failedCount` |
| Progress Callback für UI | ✅ Erledigt | `ProgressCallback` Type |

### Akzeptanzkriterien

- [x] Guest erstellt Turnier → Registriert sich → Turnier ist in Cloud verfügbar
- [x] Mehrere Turniere werden korrekt migriert
- [x] Fehler bei einzelnem Turnier stoppt nicht die gesamte Migration
- [x] Progress Callback für User-Feedback
- [x] Keine Duplikate (prüft gegen Cloud-IDs)

---

## 🟢 QA-DURCHLAUF ABGESCHLOSSEN (2026-01-05)

**Status:** PASSED - Release-ready

**Ergebnisse:** [docs/qa/](qa/)
- [QA-ZUSAMMENFASSUNG.md](qa/QA-ZUSAMMENFASSUNG.md) - Executive Summary
- [QA-UMSETZUNGSPLAN.md](qa/QA-UMSETZUNGSPLAN.md) - Priorisierter Fixplan

**Wichtigste Erkenntnisse:**
- 336/337 Unit Tests passed
- 613/684 E2E Tests passed
- 0 ESLint/TypeScript Fehler
- 0 `any` Types in .tsx

**Vor Release zu beheben (P1):**
1. Mobile Team-Namen Truncation
2. aria-labels für IconButtons

---

## ✅ ERLEDIGT: Mobile-UX-Verbesserungen (Wizard)

**Status:** ✅ Erledigt (Wizard), ⚠️ Spielplan noch prüfen
**Priorität:** War 🔴 KRITISCH

> **Lösung:** `flex-wrap: wrap` in allen Wizard CSS Modules implementiert.

### Teil 1: Wizard Teams – Flex-Wrap Layout ✅

| Aufgabe | Status | Betroffene Dateien |
|---------|--------|-------------------|
| Team-Row refactoren mit `flex-wrap` | ✅ Erledigt | `Step4_Teams.module.css` (4x) |
| Input `min-width` für Umbruch | ✅ Erledigt | `SmartConfig.module.css` |
| `flex-wrap` in Overview | ✅ Erledigt | `Step5_Overview.module.css` |

**Implementierte CSS:**
- `Step4_Teams.module.css` - 4x `flex-wrap: wrap`
- `Step5_Overview.module.css` - 1x `flex-wrap: wrap`
- `SmartConfig.module.css` - 4x `flex-wrap: wrap`

### Teil 2: Spielplan Grid – Noch zu prüfen

> ⚠️ Spielplan-Komponenten sollten separat geprüft werden (MatchCard, GameCard).

### Teil 3: Design Tokens – Nicht benötigt

Vorhandene Tokens (`spacing`, `breakpoints`) reichen aus.

### Teil 4: Tests – Optional

Visual Regression Tests optional für zukünftige Releases.

---

## 🔴 Aktuell in Arbeit

### Public View (Zuschauer-Ansicht) – IN ARBEIT

**Referenz:** `docs/concepts/PUBLIC-PAGE-KONZEPT-v4-FINAL.md`
**Route:** `/live/:shareCode`

| Phase | Status | Beschreibung |
|-------|--------|--------------|
| Phase 1: Foundation | ✅ Erledigt | Route, Supabase-Integration, LiveViewScreen |
| Phase 2: Mein Team & Filter | ✅ Erledigt | Teamauswahl, Nur-meine-Spiele, Filter (Gruppe/Phase/Status) |
| Phase 3: Public View UI | ✅ Erledigt | PublicBottomNav, Tabs (Spiele/Tabellen/Info) |
| Phase 4: UX & Themes | ✅ Erledigt | Theme-Switch, Pull-to-Refresh, Deep-Link Persistence |
| Phase 5: PWA & Polish | ✅ Erledigt | Haptic Feedback, Service Worker caching |

**Implementierte Komponenten:**

| Komponente | Status | Pfad |
|------------|--------|------|
| `LiveViewScreen` | ✅ | `src/screens/LiveViewScreen.tsx` |
| `PublicLiveViewScreen` | ✅ | `src/screens/PublicLiveViewScreen.tsx` |
| `PublicBottomNav` | ✅ | `src/components/ui/PublicBottomNav.tsx` |
| Filter-UI (Gruppe/Phase/Status) | ✅ | In `LiveViewScreen.tsx` |
| "Mein Team" Selector | ✅ | In `LiveViewScreen.tsx` |
| "Nur meine Spiele" Toggle | ✅ | In `LiveViewScreen.tsx` |
| Tab-Navigation (Spiele/Tabellen/Info) | ✅ | In `LiveViewScreen.tsx` |
| Theme-Switch (BaseThemeSelector) | ✅ | In Settings-Tab |
| Pull-to-Refresh | ✅ | In `LiveViewScreen.tsx` |
| Deep-Link Persistence (URL Query-Params) | ✅ | In `LiveViewScreen.tsx` |
| Haptic Feedback Hook | ✅ | `src/hooks/useHaptic.ts` |
| Service Worker Supabase Caching | ✅ | `vite.config.ts` (workbox) |

**Status:** ✅ **Public View Feature ist komplett!**

---

### Live-Cockpit (Scoreboard)

**Referenz:** `docs/concepts/LIVE-COCKPIT-KONZEPT.md`
**Gap-Analyse:** 2025-12-27 durchgeführt

> ⚠️ **Hinweis:** Die Produktion verwendet `LiveCockpitMockup.tsx` (887 LOC).
> `LiveCockpit.tsx` ist **@deprecated** und wird nicht mehr verwendet.
> Die Phasen wurden basierend auf der Gap-Analyse aktualisiert.

---

### Phase 1: Types & Hooks – ✅ ERLEDIGT

| Aufgabe | Status | Commit | Notizen |
|---------|--------|--------|---------|
| Types erweitern (`tournament.ts`) | ✅ Erledigt | `fffa28c` | `MatchEventType`, `MatchEvent`, `MatchState`, `ActivePenalty`, `PenaltyShootout`, `PenaltyKick`, `KnockoutConfig` |
| `useDialogTimer` Hook | ✅ Erledigt | – | Auto-Dismiss Countdown-Timer für Dialoge |
| `useMatchTimer` Hook | ✅ Erledigt | – | `src/hooks/useMatchTimer.ts` – requestAnimationFrame-basiert |
| `useLiveCockpit` Hook | ❌ Obsolet | – | LiveCockpit.tsx ist @deprecated, kein Refactoring nötig |

**Status:** Phase 1 abgeschlossen.
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
| `LiveCockpit` (Container) | ✅ Erledigt | – | `LiveCockpitMockup.tsx` (887 LOC) – **Aktive Produktion** |

**Status:** Vollständig implementiert. `LiveCockpit.tsx` ist @deprecated.

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
| ~~8~~ | ~~`useMatchTimer` Hook extrahieren~~ | 1 | ✅ Erledigt (existiert in `src/hooks/`) |
| ~~9~~ | ~~`useLiveCockpit` Hook extrahieren~~ | 1 | ❌ Obsolet (LiveCockpit.tsx deprecated) |
| 10 | `PenaltyResultDialog` (nur Endergebnis) | 4 | Niedrig – Nice-to-have |

**🎉 Live-Cockpit Feature ist funktional komplett!** Verbleibende Aufgaben sind Refactoring/Nice-to-have.

---

## 🟡 Backlog

### Usability Issues (aus @usability Report 2025-12-30)

**Report:** `docs/qa-reports/2025-12-30-USABILITY.md`

#### HIGH Priority

| ID | Issue | Datei | Status |
|----|-------|-------|--------|
| ~~H1~~ | ~~Button (sm) keine minHeight → Touch Target < 44px~~ | `src/components/ui/Button.tsx` | ✅ Erledigt |
| H2 | Kein Undo für Turnier-Löschung → Papierkorb | [Konzept](concepts/PAPIERKORB-KONZEPT.md) | ⬜ Offen (~5h) |

#### MEDIUM Priority

| ID | Issue | Datei | Status |
|----|-------|-------|--------|
| ~~M1~~ | ~~ESC-Handler für Dialoge~~ | `ConfirmDialog`, `BottomSheet`, `ActionMenu` | ⚠️ Teilweise (weitere Dialoge prüfen) |
| M2 | Keyboard Shortcuts undokumentiert | Docs | ⬜ Offen (1h) |
| ~~M3~~ | ~~`touch-action: manipulation` fehlt in Button~~ | `src/components/ui/Button.tsx` | ✅ Erledigt |
| M4 | Focus-Outline kontrastreicher | `Button.tsx`, `Input.tsx` | ⬜ Offen (30 Min) |
| M5 | Spiel-Beendigung kein Undo | `LiveCockpitMockup.tsx` | ⬜ Offen (2h) |
| M6 | Altersklassen-Dropdown lang (~30 Optionen) | `Step1_Metadata` | ⬜ Offen (1h) |
| M7 | Error Messages nur roter Rahmen, kein Text | `src/components/ui/Input.tsx` | ⬜ Offen (1h) |
| M8 | Kein Onboarding für Power-Features | App | ⬜ Offen (3h) |

---

### Features

| Aufgabe | Priorität | Geschätzt | User Story |
|---------|-----------|-----------|------------|
| Monitor-Ansicht (TV-Modus) | Hoch | - | US-MON-TV-DISPLAY |
| Public View (Zuschauer-Link) | Mittel | - | - |
| Trainer-Cockpit | Mittel | - | US-TRAINER-COCKPIT |
| Turnier kopieren/löschen konzeptionieren | Mittel | - | US-TOURNAMENT-COPY |
| **Elfmeterschießen-Flow UI** | Mittel | - | - |
| **PWA Install-Button in App** | Niedrig | 1h | - |

### Quality Infrastructure (aus Phase 1 Plan)

> **Plan:** Siehe `.claude/plans/fizzy-meandering-papert.md`
> **Phase 1:** ✅ Erledigt (PR #55 merged)

#### Phase 2: CI/CD Extensions (~2h)

| # | Task | Aufwand | Status | Beschreibung |
|---|------|---------|--------|--------------|
| 2.1 | Test Tier Separation | ~30min | ⬜ Offen | Pre-commit nur Unit-Tests, CI alle Tests |
| 2.2 | Bundle Size Check | ~20min | ⬜ Offen | size-limit Action + 250KB Limit |
| 2.3 | Coverage Enforcement | ~10min | ⬜ Offen | Thresholds erhöhen (50% lines/functions) |
| 2.4 | CodeQL Scanning | ~15min | ⬜ Offen | Security vulnerability scanning |

#### Phase 3: Code Quality Gates (~1h)

| # | Task | Aufwand | Status | Beschreibung |
|---|------|---------|--------|--------------|
| 3.1 | Commitlint | ~15min | ⬜ Offen | Conventional Commits enforcing |
| 3.2 | Import Restrictions | ~20min | ⬜ Offen | ESLint no-restricted-imports |
| 3.3 | Lighthouse CI | ~30min | ⬜ Offen | Performance Budget in CI |
| 3.4 | Auto-Changelog | ~20min | ⬜ Offen | Changelog aus Conventional Commits |

### Elfmeterschießen-Flow (separates Feature)

> **Status:** 📋 Konzept erforderlich
> **Abhängigkeit:** Match Cockpit Pro (Settings vorhanden)

Das Match Cockpit Pro Feature enthält nur die **Settings** für Elfmeterschießen:
- `penaltyShootersPerTeam` (Default: 5)
- `penaltySuddenDeathAfter` (Default: 6)

Was **FEHLT** und als separates Feature umgesetzt werden muss:

| Aufgabe | Beschreibung |
|---------|--------------|
| Elfmeter-Erfassung UI | Schütze auswählen, Treffer/Fehlschuss Button |
| Elfmeter-Scoreboard | Visuelle Darstellung der Schüsse (●/○) |
| Sudden Death Logik | Automatische Erkennung wann entschieden |
| Runden-Tracking | "Runde 3 von 5" Anzeige |
| Ergebnis-Commit | Finales Ergebnis nach Elfmeterschießen ins Match schreiben |
| Monitor-Sync | Elfmeter-Status an TV-Ansicht senden |

### PWA Installation (Dokumentation)

> **Status:** PWA ist korrekt konfiguriert mit `vite-plugin-pwa`. Installation funktioniert automatisch.

#### Manuelle Installation durch User

| Plattform | Browser | Methode |
|-----------|---------|---------|
| **Android** | Chrome | ⋮ Menü → "App installieren" oder "Zum Startbildschirm" |
| **Windows** | Chrome | Adressleiste → ⊕ Icon ODER Menü → "Installieren..." |
| **Windows** | Edge | Adressleiste → App-Icon ODER Menü → Apps → "Als App installieren" |
| **macOS** | Chrome | Menü → "Hallenfußball Turnier-Manager installieren..." |
| **iOS** | Safari | Teilen-Button → "Zum Home-Bildschirm" |

#### Optional: In-App Install-Button implementieren

```typescript
// Hook für PWA Installation
const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

useEffect(() => {
  const handler = (e: BeforeInstallPromptEvent) => {
    e.preventDefault();
    setInstallPrompt(e);
  };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}, []);

const handleInstallClick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  setInstallPrompt(null);
};
```

#### PWA-Manifest (generiert)

```json
{
  "name": "Hallenfußball Turnier-Manager",
  "short_name": "Turnier",
  "display": "standalone",
  "theme_color": "#00e676",
  "background_color": "#1a1a2e"
}
```

#### Hinweis für Localhost-Testing

PWA-Installation auf `localhost` funktioniert nur in Chrome/Edge. Für vollständige Tests (Safari, iOS):
- `ngrok` für temporäre HTTPS-URL
- Deploy auf Vercel/Netlify

### Team-Management (Phase 2)

**Analyse:** `.serena/memories/team-management-analysis-2026-01.md`
**Stand:** 85% implementiert (Phase 1 produktionsreif)

| Aufgabe | Priorität | Status | Notizen |
|---------|-----------|--------|---------|
| Unit-Tests für `teamHelpers.ts` | Hoch | ⬜ Offen | deleteTeamSafely, renameTeam, analyzeTeamMatches |
| E2E-Tests für TeamsTab | Hoch | ⬜ Offen | Create, Rename, Delete, Soft-Delete |
| Trainer-Cockpit implementieren | Mittel | ⬜ Offen | Konzept: `docs/concepts/TRAINER-COCKPIT-CONCEPT.md` |
| Public Team-Registration | Mittel | ⬜ Offen | Öffentliches Anmeldeformular für Teams |
| Audit-Log Integration | Niedrig | ⬜ Offen | Konzept: `docs/concepts/AUDIT-LOG-KONZEPT.md` |
| Supabase Auth Migration | Phase 2 | ⬜ Offen | E-Mail-Einladungen, Real-time Sync |

### Bugs

| Bug | Priorität | Status | Beschreibung |
|-----|-----------|--------|--------------|
| [BUG-004](bugs/BUG-004-Timer-Springt.md) | 🔴 Critical | ✅ Fixed | Timer springt in 5-Sekunden-Schritten |
| [BUG-005](bugs/BUG-005-Tor-Dialog-Fehlt.md) | 🔴 Critical | ✅ Fixed | Tor ohne Torschütze/Assist-Dialog |
| [BUG-006](bugs/BUG-006-Zeitstrafe-Dialog-Redundant.md) | 🟡 Minor | ✅ Fixed | Zeitstrafe-Dialog fragt redundant nach Zeit |
| [BUG-007](bugs/BUG-007-Karten-Dialog-Redundant.md) | 🟡 Minor | ✅ Fixed | Karten-Dialog mit Quick-Mode |
| [BUG-008](bugs/BUG-008-Zeitstrafe-Cleanup.md) | 🟡 Minor | ✅ Fixed | Zeitstrafe-Countdown + Cleanup |
| [BUG-009](bugs/BUG-009-Wechsel-Dialog.md) | 🟡 Minor | ✅ Fixed | Wechsel-Dialog – RAUS/REIN Redesign in LiveCockpitMockup |
| [BUG-010](bugs/BUG-010-Event-Nachbearbeitung.md) | 🟠 Major | ✅ Fixed | Event-Log Bearbeitung – EventEditDialog in LiveCockpitMockup |
| BUG-011 | 🟡 Minor | ✅ Closed | **Spielplan 2.0:** Card-Tap öffnet kein Quick-Score Expand (Mobile) – War Test-Problem, nicht Impl-Bug |
| BUG-012 | 🟡 Minor | ✅ Closed | **Spielplan 2.0:** "Zum Cockpit" Navigation – War Test-Problem, nicht Impl-Bug |
| BUG-003 Grid Insert | Feature Request | - | Insert-between ist nicht Bug, sondern Feature |

### Refactoring

| Aufgabe | Priorität | Betroffene Dateien |
|---------|-----------|-------------------|
| **OfflineRepository: Side-Effects in Gettern entfernen** | Niedrig | `src/core/repositories/OfflineRepository.ts` – Getter-Methoden sollten keine Mutations-Queue triggern (Architecture Smell aus Review 2026-01-11) |
| ~~Wizard: ~35 hardcoded rgba() migrieren~~ | ✅ Erledigt | `features/tournament-creation/**` – Verifiziert: 0 rgba() gefunden (2026-01-11) |
| ~~Wizard: Neue Subtle/Border Tokens erstellen~~ | ✅ Erledigt | `design-tokens/colors/semantic.ts` – Tokens existieren bereits |
| ~~Live-Cockpit: LiveCockpit.tsx aufteilen~~ | ❌ Obsolet | `LiveCockpit.tsx` ist @deprecated – Produktion nutzt `LiveCockpitMockup.tsx` |
| Live-Cockpit: Dialog-Code extrahieren (~300 LOC) | Mittel | `live-cockpit/components/Dialogs/*.tsx` – DialogBase, TeamSelector, PlayerNumberInput |
| Live-Cockpit: ~22 hardcoded fontSize migrieren | Mittel | `live-cockpit/**/*.tsx` – zu fontSizes.* |
| Shared Dialog Styles extrahieren | Mittel | `live-cockpit/components/Dialogs/*.tsx` – ~70% Code-Duplikation zwischen Dialogen (~300 LOC Ersparnis) |
| Team Interface zentralisieren | Niedrig | `live-cockpit/types.ts` → 4× dupliziert in Dialogen |
| formatTime Utility extrahieren | Niedrig | `utils/time.ts` → 3× dupliziert |
| Keyboard-Support für Dialoge | Niedrig | Alle Dialoge – Escape/Enter Shortcuts |
| Focus-Trap für Dialoge | Niedrig | Alle Dialoge – echte Modal-Semantik |
| Design Token Migration | Niedrig | Verbleibende Komponenten (Screens erledigt) |
| ~~Live-Cockpit: Mode aus localStorage laden~~ | ❌ Obsolet | Betrifft deprecated `LiveCockpit.tsx` |
| Live-Cockpit: `LiveCockpit.tsx` löschen | Niedrig | 935 LOC deprecated Code entfernen – optional |

### Analyse

| Aufgabe | Priorität | Notizen |
|---------|-----------|---------|
| Themes analysieren | Mittel | Corporate Colors, Dark/Light Mode |
| PDF Creator analysieren | Mittel | pdfExporter.ts, Optimierungspotential |

### Dokumentation

| Aufgabe | Priorität |
|---------|-----------|
| - | - |

### Testing (Audit 2025-12-29)

> **Goldene Regel:** 1 Funktion = n Acceptance Criteria = n Tests

#### Schedule-Editor Editiermodus – FEHLENDE TESTS

**E2E Tests (Playwright):**

| Test | Priorität | Status |
|------|-----------|--------|
| AC-4: Drag & Drop tauscht Matches | Hoch | ⬜ Offen |
| Gesperrte Matches (mit Ergebnis) nicht ziehbar | Hoch | ⬜ Offen |
| Save persistiert Änderungen in localStorage | Mittel | ⬜ Offen |
| SR redistribution Button Funktion | Mittel | ⬜ Offen |
| Field redistribution Button Funktion | Mittel | ⬜ Offen |
| Mobile View Tests (iPhone) | Niedrig | ⬜ Offen (aktuell skipped) |

**Unit Tests (Vitest):**

| Test | Priorität | Status |
|------|-----------|--------|
| `useDragDrop` hook | Mittel | ⬜ Offen |
| `DraggableMatch` component | Niedrig | ⬜ Offen |
| `TimeSlot` component | Niedrig | ⬜ Offen |
| `ConflictDialog` component | Niedrig | ⬜ Offen |

**Vorhandene Tests (✅ Komplett):**
- `useScheduleEditor.test.ts` (~70 Tests)
- `useMatchConflicts.test.ts` (~20 Tests)
- `scheduleConflicts.test.ts` (~30 Tests)
- `autoReassign.test.ts` (~30 Tests)
- `schedule-editor.spec.ts` (14 E2E Tests)

---

## 🟡 Backlog: Dependency Updates (Major Upgrades)

> **Hinweis:** Diese PRs wurden von Dependabot erstellt, erfordern aber manuelle Prüfung wegen Breaking Changes.

| PR | Aufgabe | Priorität | Status | Notizen |
|----|---------|-----------|--------|---------|
| #60 | React 19 Upgrade evaluieren | Niedrig | ⬜ Offen | Build fehlgeschlagen - Breaking Changes (s.u.) |
| #59 | eslint-plugin-react-hooks 7.x | Niedrig | ⬜ Offen | Unit Tests fehlgeschlagen - React Compiler Rules (s.u.) |

**Empfehlung:** Nicht automatisch mergen. Breaking Changes zuerst analysieren.

### PR #60: React 18 → 19 Breaking Changes

**TypeScript-Fehler (Build schlägt fehl):**

| Fehler | Betroffene Dateien | Ursache |
|--------|-------------------|---------|
| `Cannot find namespace 'JSX'` | 8 Komponenten (SearchFilterBar, AudioActivationBanner, etc.) | React 19 entfernt globalen `JSX` Namespace → `React.JSX` nutzen |
| `RefObject<T \| null>` nicht kompatibel | ImportDialog, EditableMatchCard | Ref-Typen geändert in React 19 |
| `useRef()` erwartet 1 Argument | usePrevious.ts | `useRef()` ohne Initial-Wert nicht mehr erlaubt |
| Callback Ref Rückgabetyp | AdminSidebar | Cleanup-Funktion nicht mehr als Return erlaubt |

**Aufwand:** ~4-8h für Migration (viele Dateien betroffen)

### PR #59: eslint-plugin-react-hooks 5 → 7 Breaking Changes

**ESLint-Fehler (Unit Tests schlagen fehl):**

| Neue Rule | Problem | Betroffene Hooks |
|-----------|---------|------------------|
| `setState synchronously within an effect` | React Compiler Rule - verbietet `setState` direkt im useEffect Body | Mehrere Hooks |
| `Cannot call impure function during render` | `Math.random()` während Render | Dialog.tsx:117 |

**Ursache:** eslint-plugin-react-hooks 7.x enthält Rules vom React Compiler, die strenger sind.

**Aufwand:** ~2-4h für Refactoring (setState in Callbacks verschieben, Math.random() via useMemo cachen)

---

## Erledigt

| Aufgabe | Erledigt am | Commit |
|---------|-------------|--------|
| ESLint `prefer-nullish-coalescing` Warnings (170→0) | 2026-01-19 | PR #62 – `||` → `??` Migration in ~30 Dateien |
| ESLint 9 Flat Config Migration | 2026-01-19 | PR #58 – `eslint.config.js`, typescript-eslint v8 |
| jspdf Security Fix (CVE-2025-29529) | 2026-01-19 | PR #53 – Update 3.0.4 → 4.0.0 |
| ESLint Rule: `no-hardcoded-font-styles` | 2026-01-02 | `8d2aa0e` – Verhindert hardcoded px/font-family, erzwingt cssVars.fontSizes/fontFamilies |
| Typography + Settings + URL-Filter | 2026-01-02 | `f277bc0` – Inter Font, rem-Scaling, High-Contrast Theme, useURLFilterSync |
| Dashboard IST-Analyse | 2025-12-30 | [DASHBOARD-IST-ANALYSE.md](analysis/DASHBOARD-IST-ANALYSE.md) |
| User-Menu IST-Analyse | 2025-12-30 | [USER-MENU-IST-ANALYSE.md](analysis/USER-MENU-IST-ANALYSE.md) |
| Papierkorb-Konzept erstellt | 2025-12-30 | [PAPIERKORB-KONZEPT.md](concepts/PAPIERKORB-KONZEPT.md) |
| Usability-Fixes: H1 (Touch Targets), M3 (tap-delay) | 2025-12-30 | `Button.tsx` minHeight + touchAction |
| TODO.md Audit – veraltete Einträge korrigiert | 2025-12-29 | `useMatchTimer` ✅, BUG-009/010 ✅, LiveCockpit.tsx als @deprecated markiert |
| Testing & Konzept System v2 Setup | 2025-12-29 | TESTING.md, BROWSER_DEBUGGING.md, CLAUDE.md erweitert |
| Schedule-Editor Test-Audit | 2025-12-29 | ~150 Unit Tests + 14 E2E Tests dokumentiert, Gaps identifiziert |
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
