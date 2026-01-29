# Projekt-Status IST-Analyse

> **Stand:** 2026-01-29 | **Version:** v2.4.0 | **Branch:** main

---

## 1. Supabase-Status

| Aspekt | Status | Details |
|--------|--------|---------|
| **Tabellen** | Produktiv | tournaments, teams, matches, match_events, live_matches, monitors, sponsors, profiles, sync_queue, tournament_collaborators, tournament_templates |
| **Migrations** | 16 Dateien | Letzte: `20260128_004_cleanup_unused_indexes.sql` |
| **RLS Policies** | Optimiert (v3) | `user_owns_tournament()` SECURITY DEFINER, denormalized `owner_id` |
| **Auth** | Produktiv | Email/Password, Magic Link, Google OAuth, Guest-Mode + Migration |
| **Realtime** | Produktiv | Postgres Changes Subscriptions, Visibility-Aware |
| **E2E Tests** | 15+ Spec-Dateien | Playwright: Dashboard, Wizard, Cockpit, Public View, Auth, Monitor, Settings, Smoke |

### Repository-Architektur

```
OfflineRepository (Entry-Point)
  |- IndexedDB (Primary Storage) + localStorage (Fallback)
  |- MutationQueue (Offline-Sync, 5 Retries, Exponential Backoff)
  |- SupabaseRepository (Cloud Backend, Optimistic Locking)
  |- ConflictResolver (Field-Level Granularity)
  |- RealtimeService (Live-Updates)
```

**Offen:** E2E-Test mit authentifiziertem User gegen Supabase (TODO.md).

---

## 2. Feature-Status

| Feature | Status | Anmerkung |
|---------|--------|-----------|
| Tournament Wizard (5 Steps) | Fertig | 23+ Sub-Komponenten, Sport/Modus/Meta/Gruppen/Teams/Review |
| Live-Cockpit | Fertig | 33+ Komponenten, Penalties, Karten, Fouls, Wechsel, Event-Log |
| Public View (`/live/:shareCode`) | Fertig | 5 Phasen abgeschlossen, Mein-Team-Filter, Tabs, Themes, PWA |
| Monitor-Ansicht (TV) | Fertig | SlideConfigEditor, SlidePreview, MonitorDisplayPage, Animationen |
| PDF-Export | Fertig | Spielplan + Statistiken, jsPDF + autoTable |
| Import (JSON/CSV) | Fertig | Templates, partieller Import, Auto-Wizard-Route |
| Schedule Editor | In Arbeit | Core (DnD, Konflikte, Auto-Reassign) fertig, UI-Integration ausstehend |
| Offline-First | Fertig | IndexedDB + MutationQueue + StorageFactory + QuotaMonitor |
| Multi-Tab Sync | Fertig | BroadcastChannel + StorageEvent Fallback, 7 Message-Types |
| Design Token System | Fertig | 11 Token-Dateien, CSS Vars, WCAG AA |
| Auth + Rollen | Fertig | OWNER/MEMBER/COLLABORATOR, Guest-Migration, Invite-System |

---

## 3. Tech Stack

### Runtime

| Library | Version | Zweck |
|---------|---------|-------|
| React | 19.2.3 | UI Framework |
| TypeScript | 5.2.2 | Typisierung |
| Vite | 7.3.0 | Build + Dev Server |
| Node.js | >= 24 | Runtime |
| React Router | 7.13.0 | Client Routing |
| Supabase JS | 2.91.1 | Backend + Auth + Realtime |
| Zod | 4.3.6 | Schema-Validierung |

### Weitere Dependencies

| Library | Version | Zweck |
|---------|---------|-------|
| @dnd-kit | core 6.3.1, sortable 10.0.0 | Drag & Drop (Schedule Editor) |
| jsPDF | 4.0.0 | PDF-Erzeugung |
| qrcode.react | 4.2.0 | QR-Codes (Monitor/Sponsor) |
| @sentry/react | 10.36.0 | Error Tracking |
| idb-keyval | 6.2.2 | IndexedDB Wrapper |
| vite-plugin-pwa | 1.2.0 | Service Worker + Workbox |
| browser-image-compression | 2.0.2 | Logo-Kompression |
| react-colorful | 5.6.1 | Corporate Color Picker |

### Dev/Testing

| Tool | Version |
|------|---------|
| Playwright | 1.58.0 |
| Vitest | 4.0.18 |
| @testing-library/react | 16.3.2 |
| @axe-core/playwright | 4.11.0 |
| ESLint | 9.39.2 (Flat Config) |
| Husky + lint-staged | 9.1.7 / 16.2.7 |

---

## 4. Aktuelle Prioritaten

### Aus TODO.md

| Prio | Thema | Status |
|------|-------|--------|
| P0 (4x) | Enterprise Review Critical Issues | Alle erledigt |
| Quick Wins (6x) | Three-Agent Review Fixes | Alle erledigt (PR #77) |
| Supabase E2E | Test mit Auth-User | Offen |
| Schedule Editor | UI-Integration | In Arbeit |
| Monitor Phase 20b | textAlign + colorScheme Controls | Erledigt (heute) |

### Offene Backlog-Items (priorisiert)

1. **H2:** Papierkorb-Feature (Turnier-Loschung ruckgangig)
2. **M4-M8:** Usability-Issues (Focus-Outline, Altersklassen-Dropdown, Error Messages, Onboarding)
3. **CI/CD Phase 2:** Test-Tier-Separation, Bundle-Size-Check, CodeQL, Coverage
4. **Refactoring:** Dialog-Code-Extraktion, hardcoded fontSizes im Live-Cockpit

### Bekannte Bugs

Alle dokumentierten Bugs (BUG-004 bis BUG-012) sind gefixt oder geschlossen.

---

## 5. Architektur

```
src/
  core/           Pure Business Logic (kein React)
    generators/     fairScheduler, playoff, referee (7 Dateien)
    models/         Zod Schemas (TournamentSchema, SlideConfigSchema)
    realtime/       RealtimeService (Supabase Postgres Changes)
    repositories/   6 Repos + Interfaces + Mappers (13 Dateien)
    services/       MatchExecution, Tournament, Schedule, MutationQueue (7 Dateien)
    storage/        IndexedDB, localStorage, Factory, QuotaMonitor (8 Dateien)
    sync/           SyncService, ConflictResolver, QueueStore (5 Dateien)
  features/       Feature-Module
    auth/           60+ Dateien (Login, Register, OAuth, Guest-Migration)
    collaboration/  Multi-User, Invites, Membership
    monitor-display/  TV-Anzeige
    schedule-editor/  DnD-Editor + Konflikte
    settings/       App-Einstellungen
    sync/           Sync-Status-Anzeige
    tournament-admin/       Kategorien
    tournament-creation/    Wizard (Steps 1-5, 23+ Komponenten)
    tournament-management/  Dashboard, Monitor-Config, SlideEditor
  components/     Shared UI
    live-cockpit/   33+ Komponenten
    monitor/        TV-Display + Animationen
    schedule/       MatchCard, GoalList, MatchExpand
    ui/             Button, Input, Select, Dialog, Toast, BottomSheet
  hooks/          50+ React Hooks
  design-tokens/  11 Token-Dateien (colors, spacing, typography, motion...)
```

### Kritische Pfade

| Pfad | LOC | Beschreibung |
|------|-----|-------------|
| `core/services/MatchExecutionService.ts` | ~31KB | Live-Match-Logik |
| `hooks/useMatchExecution.ts` | ~29KB | Live-Match Controller |
| `core/generators/fairScheduler.ts` | ~24KB | Kern-Scheduling |
| `core/repositories/OfflineRepository.ts` | ~26KB | Local-First Data Access |
| `core/repositories/SupabaseRepository.ts` | ~24KB | Cloud Backend |

---

## Zusammenfassung

**Produktionsreife Features:** 10/11 (Schedule Editor noch in Arbeit)
**Architektur:** Local-First mit Supabase Cloud-Sync, 50+ Hooks, Design Token System
**Testing:** 100+ E2E Tests (Playwright), 336+ Unit Tests (Vitest), WCAG AA
**Tech:** React 19 + TypeScript 5.2 + Vite 7 + Supabase + Zod 4
**Offene Arbeit:** Schedule-Editor UI-Integration, Supabase E2E-Test, Usability-Backlog (5 Items), CI/CD Phase 2-3
