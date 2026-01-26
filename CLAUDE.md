# Claude Code Instruktionen

## Projektübersicht

**Hallenfussball-PWA** - React/TypeScript PWA für Hallenfußball-Turnierorganisation.

## Architektur (Stand: Januar 2026)

```
src/
├── core/                    ← Pure Business Logic (KEIN React)
│   ├── models/              ← Datentypen, Zod-Schemas
│   ├── repositories/        ← Data Access (Local, Supabase, Hybrid, Offline)
│   ├── services/            ← Business Logic (MatchExecution, MutationQueue)
│   ├── generators/          ← Schedule/Playoff-Generierung
│   ├── storage/             ← IndexedDB/localStorage Adapter
│   ├── sync/                ← Conflict Resolution, SyncService
│   ├── realtime/            ← Supabase Realtime Integration
│   └── utils/               ← SingleFlight, safeStorage
│
├── features/                ← Feature-basierte Module
│   ├── auth/                ← Authentication (Supabase Auth)
│   ├── tournament-creation/ ← Wizard Steps 1-5
│   └── tournament-management/
│
├── hooks/                   ← React Hooks (Thin Controllers)
│   ├── useMatchExecution.ts ← Live-Spiel-Verwaltung
│   ├── useTournamentManager.ts
│   ├── useLiveMatches.ts
│   └── useMultiTabSync.ts
│
├── components/              ← Shared UI-Komponenten
│   ├── live-cockpit/        ← Live-Match-Steuerung
│   ├── monitor/             ← TV-Display-Komponenten
│   └── ui/                  ← Basis-Komponenten
│
├── design-tokens/           ← Single Source of Truth für Styling
├── lib/                     ← Supabase Client, externe Libs
└── types/                   ← TypeScript-Definitionen
```

## Wichtige Services & Repositories

| Komponente | Datei | Zweck |
|------------|-------|-------|
| `OfflineRepository` | `core/repositories/` | **Haupt-Repository** - Local-First mit Cloud-Sync |
| `MutationQueue` | `core/services/` | Offline-Queue für Änderungen |
| `MatchExecutionService` | `core/services/` | Live-Spiel-Logik |
| `HybridRepository` | `core/repositories/` | Kombiniert Local + Supabase |
| `StorageFactory` | `core/storage/` | IndexedDB mit localStorage-Fallback |

## Repository Pattern (Implementiert)

```typescript
// Haupt-Repository für authentifizierte User
import { OfflineRepository } from './core/repositories/OfflineRepository';

// Strategie: Local-First
// 1. Lesen: Erst lokal (instant), dann Background-Sync zu Cloud
// 2. Schreiben: Lokal speichern + MutationQueue für Cloud-Sync
```

## Datenfluss

```
┌─────────────────────────────────────────────────────────────────┐
│  UI (React)                                                     │
│    ↓ useRepository() / useTournamentManager()                   │
├─────────────────────────────────────────────────────────────────┤
│  OfflineRepository (Local-First Strategy)                       │
│    ├── LocalStorageRepository (IndexedDB Cache)                 │
│    ├── SupabaseRepository (Cloud)                               │
│    └── MutationQueue (Offline Changes)                          │
├─────────────────────────────────────────────────────────────────┤
│  Storage Layer                                                  │
│    ├── IndexedDBAdapter (Primary)                               │
│    └── LocalStorageAdapter (Fallback)                           │
└─────────────────────────────────────────────────────────────────┘
```

## Befehle

```bash
npm run dev       # Entwicklungsserver
npm run build     # Production Build (tsc + vite)
npm run lint      # ESLint (max-warnings 0)
npm test          # Vitest Unit Tests
npx playwright test  # E2E Tests
```

## Wichtige Konzepte

| Konzept | Datei | Status |
|---------|-------|--------|
| Fair Scheduler | `core/generators/fairScheduler.ts` | ✅ Implementiert |
| Offline-First | `core/repositories/OfflineRepository.ts` | ✅ Implementiert |
| Multi-Tab Sync | `hooks/useMultiTabSync.ts` | ✅ Implementiert |
| Supabase Auth | `features/auth/` | ✅ Implementiert |
| Live-Cockpit | `components/live-cockpit/` | ✅ Implementiert |

## Bekannte Einschränkungen

- Auth-Timeout bei Supabase Cold Start (~15s) - UI zeigt optimistisch Login-Buttons
- Safari Private Mode: Kein IndexedDB - Fallback zu localStorage/MemoryStorage
