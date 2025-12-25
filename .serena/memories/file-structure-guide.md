# File Structure Guide - Hallenfußball PWA

## Ordner-Struktur

```
src/
├── components/           # Wiederverwendbare Komponenten
│   ├── ui/              # Design System (Button, Card, Input, etc.)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── NumberStepper.tsx
│   │   ├── Toast.tsx
│   │   ├── Icons.tsx
│   │   └── index.ts     # Barrel Export
│   ├── schedule/        # Spielplan-Komponenten
│   │   ├── GroupStageSchedule.tsx
│   │   ├── FinalStageSchedule.tsx
│   │   ├── GroupTables.tsx
│   │   └── ParticipantsAndGroups.tsx
│   ├── dialogs/         # Modal/Dialog Komponenten
│   └── match-cockpit/   # Live-Spielverwaltung
│
├── contexts/            # React Context Provider
│   └── TournamentContext.tsx
│
├── features/            # Feature-basierte Organisation
│   ├── tournament-creation/
│   │   ├── Step1_SportAndType.tsx
│   │   ├── Step2_ModeAndSystem.tsx
│   │   ├── Step3_Metadata.tsx
│   │   ├── Step4_Teams.tsx
│   │   ├── Step5_Overview.tsx
│   │   ├── TournamentPreview.tsx
│   │   ├── components/   # Feature-spezifische Sub-Components
│   │   └── index.ts
│   └── tournament-management/
│       ├── MonitorTab.tsx
│       ├── ScheduleTab.tsx
│       ├── RankingTab.tsx
│       ├── SettingsTab.tsx
│       └── components/   # Extrahierte Sub-Components
│
├── hooks/               # Custom React Hooks
│   ├── useDebounce.ts
│   ├── useClickOutside.ts
│   ├── usePrevious.ts
│   ├── useTournaments.ts
│   └── index.ts         # Barrel Export
│
├── lib/                 # Business Logic & Utilities
│   ├── scheduleGenerator.ts   # Haupt-Orchestration
│   ├── scheduleTypes.ts       # Type Definitions
│   ├── scheduleHelpers.ts     # Utility Functions
│   ├── scheduleRenderer.ts    # Export/Print
│   ├── pdfExporter.ts         # PDF Generation
│   ├── refereeAssigner.ts     # SR-Zuweisung
│   └── playoffGenerator.ts    # Playoff-Matches
│
├── screens/             # Top-Level Screens (Lazy-loaded)
│   ├── DashboardScreen.tsx
│   ├── TournamentCreationScreen.tsx
│   ├── TournamentManagementScreen.tsx
│   └── PublicTournamentViewScreen.tsx
│
├── styles/              # Globale Styles & Theme
│   ├── theme.ts         # Design Tokens
│   └── global.css       # CSS Reset & Globals
│
├── test/                # Test-Infrastruktur
│   ├── setup.ts         # Test Setup
│   ├── testUtils.tsx    # Custom Render
│   └── factories.ts     # Mock Data Factories
│
├── types/               # TypeScript Type Definitions
│   └── tournament.ts    # Alle Turnier-bezogenen Types
│
├── utils/               # Reine Utility-Funktionen
│   ├── calculations.ts  # Tabellen-Berechnung
│   ├── fairScheduler.ts # Spielplan-Algorithmus
│   ├── playoffScheduler.ts
│   ├── groupHelpers.ts
│   └── displayNames.ts  # Anzeige-Formatierung
│
└── App.tsx              # Root Component
```

## Entscheidungs-Matrix: Wo gehört Code hin?

| Code-Art | Ziel-Ordner | Beispiel |
|----------|-------------|----------|
| UI-Komponente (überall nutzbar) | `components/ui/` | Button, Card |
| Feature-spezifische UI | `features/[feature]/components/` | NextMatchCard |
| Domain-Logik | `lib/` | scheduleGenerator |
| Reine Berechnung | `utils/` | calculateStandings |
| React Hook | `hooks/` | useDebounce |
| Context + Provider | `contexts/` | TournamentContext |
| Type Definitions | `types/` | Tournament, Match |
| Full-Screen Page | `screens/` | DashboardScreen |
| Wizard-Step | `features/tournament-creation/` | Step1_SportAndType |

## Namens-Konventionen

| Typ | Pattern | Beispiel |
|-----|---------|----------|
| Screen | `[Name]Screen.tsx` | `DashboardScreen.tsx` |
| Tab | `[Name]Tab.tsx` | `MonitorTab.tsx` |
| Wizard-Step | `Step[N]_[Name].tsx` | `Step1_SportAndType.tsx` |
| UI-Component | `[Name].tsx` | `Button.tsx` |
| Hook | `use[Name].ts` | `useDebounce.ts` |
| Context | `[Name]Context.tsx` | `TournamentContext.tsx` |
| Types | `[domain].ts` | `tournament.ts` |
| CSS Module | `[Name].module.css` | `GroupTables.module.css` |
| Test | `[Name].test.tsx` | `Button.test.tsx` |

## Import-Regeln

### Relative Imports innerhalb Features
```typescript
// In features/tournament-creation/Step2_ModeAndSystem.tsx
import { ModeSelection } from './components/ModeSelection'
```

### Absolute-ähnliche Imports zwischen Modulen
```typescript
// In features/tournament-management/MonitorTab.tsx
import { Button, Card } from '../../components/ui'
import { useTournament } from '../../contexts/TournamentContext'
import { calculateStandings } from '../../utils/calculations'
```

### Barrel Exports für UI-Komponenten
```typescript
// IMMER über Barrel importieren
import { Button, Card, Input } from '../components/ui'

// NIE direkt
import { Button } from '../components/ui/Button' // ❌
```

## Neue Datei erstellen - Checkliste

1. ✅ Korrekter Ordner (siehe Matrix)
2. ✅ Korrekte Namens-Konvention
3. ✅ Barrel Export aktualisieren (wenn nötig)
4. ✅ Types in `types/` oder lokal (wenn nur hier verwendet)
5. ✅ CODE_INDEX.md aktualisieren (wenn signifikant)
