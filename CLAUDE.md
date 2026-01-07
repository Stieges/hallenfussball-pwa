# Claude Code Instruktionen

## Projektübersicht

**Hallenfussball-PWA** - React/TypeScript PWA für Hallenfußball-Turnierorganisation.

## Architektur (Stand: Januar 2026)

```
src/
├── core/                    ← Pure Business Logic (KEIN React)
│   ├── models/              ← Datentypen, Zod-Schemas
│   ├── repositories/        ← Data Access Interfaces + localStorage
│   ├── services/            ← Business Logic Services
│   └── generators/          ← Schedule/Playoff-Generierung
│
├── hooks/                   ← React Hooks (Thin Controllers)
│   ├── useMatchExecution.ts ← Live-Spiel-Verwaltung (NEU)
│   ├── useTournamentManager.ts
│   └── useTournamentWizard.ts
│
├── features/                ← Feature-basierte UI-Komponenten
├── components/              ← Shared UI-Komponenten
├── lib/                     ← Legacy Generatoren (→ core/generators/)
├── utils/                   ← Utility-Funktionen
└── types/                   ← TypeScript-Definitionen
```

## Wichtige Services

| Service | Datei | Zweck |
|---------|-------|-------|
| `MatchExecutionService` | `core/services/` | Live-Spiel-Logik (Start/Pause/Goal/Finish) |
| `TournamentCreationService` | `core/services/` | Wizard-Validierung, Publish |
| `TournamentService` | `core/services/` | Tournament CRUD |
| `ScheduleService` | `core/services/` | Match Updates |

## Repository Pattern

```typescript
// Interface
import { ITournamentRepository } from './core/repositories';

// localStorage-Implementierung (aktuell)
import { LocalStorageRepository } from './core/repositories';

// Supabase (Zukunft) - gleiche Signatur
// import { SupabaseRepository } from './core/repositories';
```

## Datenvalidierung (Zod)

```typescript
import { TournamentSchema, parseTournament } from './core/models/schemas/TournamentSchema';

const tournament = parseTournament(rawData);
if (!tournament) {
  // Validierung fehlgeschlagen
}
```

## Dokumentation

Alle Architektur-Docs: `docs/architecture/`

| Datei | Inhalt |
|-------|--------|
| `deep_analysis.md` | Tiefe Codebase-Analyse |
| `migration_plan.md` | Umgesetzer Refactoring-Plan |
| `final_review.md` | Abschluss-Review |

## Befehle

```bash
npm run dev       # Entwicklungsserver
npm run build     # Production Build
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript Check
```

## Bekannte Probleme

- `SlideConfigEditor.tsx` hat pre-existing TypeScript-Fehler (unrelated zu Migration)
