# Component Patterns - Hallenfußball PWA

## Komponenten-Hierarchie

```
App.tsx (Router, Provider)
├── Screens (Lazy-loaded)
│   ├── DashboardScreen
│   ├── TournamentCreationScreen
│   ├── TournamentManagementScreen
│   └── PublicTournamentViewScreen
├── Features (Domain-spezifisch)
│   ├── tournament-creation/
│   │   ├── Step1_SportAndType.tsx
│   │   ├── Step2_ModeAndSystem.tsx
│   │   └── ...
│   └── tournament-management/
│       ├── MonitorTab.tsx
│       ├── ScheduleTab.tsx
│       └── components/
└── Components (Wiederverwendbar)
    ├── ui/ (Design System)
    │   ├── Button.tsx
    │   ├── Card.tsx
    │   ├── Input.tsx
    │   └── index.ts (Barrel Export)
    └── schedule/ (Domain-Components)
        ├── GroupStageSchedule.tsx
        ├── FinalStageSchedule.tsx
        └── GroupTables.tsx
```

## Pattern: UI-Komponenten

### Basis-Struktur
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children
}) => {
  // ...
}
```

### Export über Barrel
```typescript
// components/ui/index.ts
export { Button } from './Button'
export { Card } from './Card'
export { Input } from './Input'
export { NumberStepper } from './NumberStepper'
```

## Pattern: Feature-Komponenten

### Container/Presenter
```typescript
// Container (Logik)
function MonitorTabContainer({ tournamentId }: Props) {
  const { tournament } = useTournament()
  const standings = useStandings(tournament)
  
  return (
    <MonitorTabView 
      standings={standings}
      nextMatch={getNextMatch(tournament)}
    />
  )
}

// Presenter (UI)
function MonitorTabView({ standings, nextMatch }: ViewProps) {
  return (
    <div>
      <NextMatchCard match={nextMatch} />
      <StandingsDisplay standings={standings} />
    </div>
  )
}
```

## Pattern: Wizard/Multi-Step

```typescript
// Step-Komponente
interface StepProps {
  tournament: Partial<Tournament>
  onUpdate: (updates: Partial<Tournament>) => void
  onNext: () => void
  onBack: () => void
}

function Step1_SportAndType({ tournament, onUpdate, onNext }: StepProps) {
  return (
    // Validierung im onNext
  )
}
```

## Pattern: Editable Tables

```typescript
interface EditableTableProps {
  data: Match[]
  editable?: boolean
  onFieldChange?: (matchId: string, field: number) => void
  onRefereeChange?: (matchId: string, referee: number) => void
}

function GroupStageSchedule({ 
  data, 
  editable = false,
  onFieldChange,
  onRefereeChange 
}: EditableTableProps) {
  // Render unterscheidet editable/readonly
}
```

## Pattern: Context Consumer

```typescript
// Einfacher Consumer
function MatchDisplay() {
  const { tournament, updateScore } = useTournament()
  // ...
}

// Optimierter Consumer (vermeidet Re-Renders)
function MatchMeta() {
  const { title, date } = useTournamentMeta() // Nur Metadaten
  // ...
}
```

## Anti-Patterns (VERMEIDEN)

### ❌ Props Drilling
```typescript
// SCHLECHT
<App tournament={t}>
  <Screen tournament={t}>
    <Tab tournament={t}>
      <Card tournament={t} />
    </Tab>
  </Screen>
</App>

// GUT
<TournamentProvider tournament={t}>
  <App>
    <Screen>
      <Tab>
        <Card /> {/* nutzt useTournament() */}
      </Tab>
    </Screen>
  </App>
</TournamentProvider>
```

### ❌ Inline Handler in JSX
```typescript
// SCHLECHT (neue Referenz bei jedem Render)
<Button onClick={() => handleClick(id)}>

// GUT
const handleItemClick = useCallback(() => handleClick(id), [id])
<Button onClick={handleItemClick}>
```

### ❌ God Components
```typescript
// SCHLECHT: 500+ Zeilen Komponente
// GUT: Aufteilen in:
// - Container (Logik)
// - View (Layout)
// - Sub-Components (wiederverwendbar)
```

## Komponenten-Größen-Richtlinien

| Typ | Max Zeilen | Wenn überschritten |
|-----|------------|-------------------|
| UI-Komponente | 100 | Aufteilen |
| Feature-Komponente | 200 | Container/Presenter |
| Screen | 150 | Logik in Hooks |
| Hook | 80 | Aufteilen |
