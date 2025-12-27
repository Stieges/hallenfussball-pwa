# US-GOD-COMPONENTS: Restliche God Components refaktorisieren

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-GOD-COMPONENTS |
| **Priorität** | High |
| **Status** | Open |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Code-Qualität / Refactoring |
| **Impact** | Hoch - Wartbarkeit & Testbarkeit |
| **Aufwand** | 3-4 Tage |
| **Abhängigkeit** | Nach US-REFACTOR-MONITOR |

---

## User Story

**Als** Entwickler
**möchte ich** alle God Components (>300 Zeilen) in kleinere, fokussierte Module aufteilen
**damit** der gesamte Code wartbar, testbar und verständlich wird

---

## Kontext & Auswirkungen

### Aktueller Zustand - God Components

| Datei | Zeilen | Verantwortlichkeiten | Priorität |
|-------|--------|---------------------|-----------|
| MonitorTab.tsx | 1.206 | Timer, Score, TV, Navigation, Sound | Critical (eigene Story) |
| scheduleGenerator.ts | 953 | Scheduling, Gruppen, Playoffs, Bye-Runden | High |
| playoffResolver.ts | 584 | Playoff-Logik, Bracket-Generierung | High |
| TournamentManagementScreen.tsx | 467 | Alle Management-Tabs, State | Medium |
| GroupStageSchedule.tsx | 398 | Spielplan, Gruppen, Matches | Medium |
| Step4_Teams.tsx | 380 | Team-Verwaltung, Validierung | Medium |

### Metrik-Empfehlungen

| Metrik | Empfohlen | Aktuell | Status |
|--------|-----------|---------|--------|
| Max. Zeilen/Datei | 250-300 | 1.206 | Überschritten |
| Max. Funktionen/Datei | 10-15 | 30+ | Überschritten |
| Cyclomatic Complexity | <10 | ~25 | Überschritten |
| Anzahl useState | <5 | 15+ | Überschritten |

### Auswirkungen von God Components

| Problem | Auswirkung |
|---------|------------|
| Kognitive Last | Schwer zu verstehen und zu navigieren |
| Merge-Konflikte | Mehrere Entwickler ändern dieselbe Datei |
| Testbarkeit | Zu viele Abhängigkeiten für Unit-Tests |
| Wiederverwendung | Logik kann nicht woanders genutzt werden |
| Performance | Jeder State-Change rendert alles neu |

---

## Acceptance Criteria

### scheduleGenerator.ts (953 → ~4 Dateien)

1. **AC1:** Given scheduleGenerator.ts, When refaktorisiert, Then sind es max. 4 Dateien mit je <250 Zeilen.

2. **AC2:** Given Gruppenphase-Logik, When extrahiert, Then ist sie in `groupStageScheduler.ts`.

3. **AC3:** Given Playoff-Scheduling, When extrahiert, Then ist sie in `playoffScheduler.ts`.

4. **AC4:** Given Bye-Runden-Logik, When extrahiert, Then ist sie in `byeRoundHandler.ts`.

### playoffResolver.ts (584 → ~3 Dateien)

5. **AC5:** Given playoffResolver.ts, When refaktorisiert, Then sind es max. 3 Dateien mit je <200 Zeilen.

6. **AC6:** Given Bracket-Generierung, When extrahiert, Then ist sie in `bracketGenerator.ts`.

### TournamentManagementScreen.tsx (467 → Container + Hooks)

7. **AC7:** Given TournamentManagementScreen, When refaktorisiert, Then hat der Container max. 150 Zeilen.

8. **AC8:** Given Tab-State-Logik, When extrahiert, Then ist sie in `useTournamentTabs` Hook.

### Weitere Komponenten

9. **AC9:** Given GroupStageSchedule (398 Zeilen), When refaktorisiert, Then max. 200 Zeilen.

10. **AC10:** Given Step4_Teams (380 Zeilen), When refaktorisiert, Then max. 200 Zeilen.

---

## Technische Hinweise

### 1. scheduleGenerator.ts Refactoring

```
Aktuell:
src/lib/scheduleGenerator.ts (953 Zeilen)

Ziel:
src/lib/schedule/
├── index.ts              # Exports & Orchestrierung (~50 Zeilen)
├── groupStageScheduler.ts    # Gruppen-Scheduling (~200 Zeilen)
├── playoffScheduler.ts       # Playoff-Scheduling (~200 Zeilen)
├── byeRoundHandler.ts        # Bye-Runden-Logik (~100 Zeilen)
├── timeSlotCalculator.ts     # Zeit-Berechnung (~150 Zeilen)
├── matchFactory.ts           # Match-Erstellung (~100 Zeilen)
└── types.ts              # Shared Types (~50 Zeilen)
```

```typescript
// src/lib/schedule/index.ts
import { generateGroupStageSchedule } from './groupStageScheduler'
import { generatePlayoffSchedule } from './playoffScheduler'
import { handleByeRounds } from './byeRoundHandler'
import { calculateTimeSlots } from './timeSlotCalculator'
import { Tournament, Schedule } from './types'

export function generateSchedule(tournament: Tournament): Schedule {
  // 1. Zeit-Slots berechnen
  const timeSlots = calculateTimeSlots(tournament)

  // 2. Gruppenphase generieren
  const groupMatches = generateGroupStageSchedule(tournament, timeSlots)

  // 3. Bye-Runden handhaben (wenn ungerade Teamanzahl)
  const matchesWithByes = handleByeRounds(groupMatches, tournament.teams)

  // 4. Playoff-Schedule generieren
  const playoffMatches = generatePlayoffSchedule(tournament, timeSlots)

  return {
    matches: [...matchesWithByes, ...playoffMatches],
    timeSlots,
  }
}

export * from './types'
```

### 2. playoffResolver.ts Refactoring

```
Aktuell:
src/utils/playoffResolver.ts (584 Zeilen)

Ziel:
src/utils/playoff/
├── index.ts              # Exports (~30 Zeilen)
├── bracketGenerator.ts       # Bracket-Struktur (~150 Zeilen)
├── matchupResolver.ts        # Gegner-Ermittlung (~150 Zeilen)
├── placementCalculator.ts    # Platzierung (~100 Zeilen)
└── types.ts              # Shared Types (~50 Zeilen)
```

### 3. TournamentManagementScreen Refactoring

```typescript
// VORHER: TournamentManagementScreen.tsx (467 Zeilen)
// NACHHER: TournamentManagementScreen.tsx (~150 Zeilen)

import { useTournamentData } from './hooks/useTournamentData'
import { useTournamentTabs } from './hooks/useTournamentTabs'
import { TournamentHeader } from './components/TournamentHeader'
import { TabNavigation } from './components/TabNavigation'

export function TournamentManagementScreen() {
  const { id } = useParams()
  const { tournament, schedule, isLoading, error } = useTournamentData(id)
  const { activeTab, setActiveTab, tabs } = useTournamentTabs()

  if (isLoading) return <LoadingScreen />
  if (error) return <ErrorScreen error={error} />
  if (!tournament) return <NotFoundScreen />

  const ActiveTabComponent = tabs[activeTab].component

  return (
    <div className="tournament-management">
      <TournamentHeader tournament={tournament} />
      <TabNavigation
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="tab-content">
        <ActiveTabComponent tournament={tournament} schedule={schedule} />
      </main>
    </div>
  )
}
```

```typescript
// src/features/tournament-management/hooks/useTournamentTabs.ts
import { useState, useMemo } from 'react'
import { ScheduleTab } from '../ScheduleTab'
import { TeamsTab } from '../TeamsTab'
import { MonitorTab } from '../MonitorTab'
import { RankingTab } from '../RankingTab'
import { SettingsTab } from '../SettingsTab'

interface Tab {
  id: string
  label: string
  icon: React.ComponentType
  component: React.ComponentType<TabProps>
}

export function useTournamentTabs() {
  const [activeTab, setActiveTab] = useState('schedule')

  const tabs = useMemo<Record<string, Tab>>(() => ({
    schedule: {
      id: 'schedule',
      label: 'Spielplan',
      icon: CalendarIcon,
      component: ScheduleTab,
    },
    teams: {
      id: 'teams',
      label: 'Teams',
      icon: UsersIcon,
      component: TeamsTab,
    },
    monitor: {
      id: 'monitor',
      label: 'Live',
      icon: PlayIcon,
      component: MonitorTab,
    },
    ranking: {
      id: 'ranking',
      label: 'Rangliste',
      icon: TrophyIcon,
      component: RankingTab,
    },
    settings: {
      id: 'settings',
      label: 'Einstellungen',
      icon: SettingsIcon,
      component: SettingsTab,
    },
  }), [])

  return { activeTab, setActiveTab, tabs }
}
```

### 4. GroupStageSchedule Refactoring

```
Aktuell:
GroupStageSchedule.tsx (398 Zeilen)

Ziel:
src/components/schedule/
├── GroupStageSchedule.tsx    # Container (~100 Zeilen)
├── MatchList.tsx             # Match-Liste (~80 Zeilen)
├── MatchRow.tsx              # Einzelnes Match (~60 Zeilen)
├── GroupFilter.tsx           # Gruppen-Filter (~40 Zeilen)
└── FieldFilter.tsx           # Feld-Filter (~40 Zeilen)
```

### 5. Step4_Teams Refactoring

```
Aktuell:
Step4_Teams.tsx (380 Zeilen)

Ziel:
src/features/tournament-creation/
├── Step4_Teams.tsx           # Container (~100 Zeilen)
├── components/
│   ├── TeamList.tsx          # Team-Liste (~80 Zeilen)
│   ├── TeamRow.tsx           # Team-Zeile mit Actions (~60 Zeilen)
│   ├── AddTeamForm.tsx       # Team hinzufügen (~80 Zeilen)
│   └── TeamValidation.tsx    # Validierungsanzeige (~40 Zeilen)
```

---

## Refactoring-Strategie

### 1. Extract Method → Extract Function/Hook

```typescript
// VORHER: Inline-Logik
function Component() {
  const [data, setData] = useState([])

  const processedData = data
    .filter(item => item.active)
    .map(item => ({ ...item, processed: true }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // ... 50 weitere Zeilen
}

// NACHHER: Extrahierte Funktion
function processData(data: Item[]): ProcessedItem[] {
  return data
    .filter(item => item.active)
    .map(item => ({ ...item, processed: true }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function Component() {
  const [data, setData] = useState([])
  const processedData = useMemo(() => processData(data), [data])
}
```

### 2. Extract Component

```typescript
// VORHER: Inline JSX
function Parent() {
  return (
    <div>
      <div className="header">
        <h1>{title}</h1>
        <div className="actions">
          <button onClick={handleEdit}>Edit</button>
          <button onClick={handleDelete}>Delete</button>
        </div>
      </div>
      {/* ... mehr JSX */}
    </div>
  )
}

// NACHHER: Extrahierte Komponente
function Header({ title, onEdit, onDelete }: HeaderProps) {
  return (
    <div className="header">
      <h1>{title}</h1>
      <div className="actions">
        <button onClick={onEdit}>Edit</button>
        <button onClick={onDelete}>Delete</button>
      </div>
    </div>
  )
}

function Parent() {
  return (
    <div>
      <Header title={title} onEdit={handleEdit} onDelete={handleDelete} />
      {/* ... mehr JSX */}
    </div>
  )
}
```

---

## Priorisierte Reihenfolge

1. **MonitorTab.tsx** → Eigene Story (US-REFACTOR-MONITOR)
2. **scheduleGenerator.ts** → Kernlogik, viele Abhängigkeiten
3. **playoffResolver.ts** → Komplexe Logik
4. **TournamentManagementScreen.tsx** → Container-Pattern
5. **GroupStageSchedule.tsx** → UI-Komponente
6. **Step4_Teams.tsx** → Wizard-Step

---

## Definition of Done

- [ ] Alle Dateien >300 Zeilen identifiziert
- [ ] scheduleGenerator.ts in 4+ Dateien aufgeteilt
- [ ] playoffResolver.ts in 3+ Dateien aufgeteilt
- [ ] TournamentManagementScreen auf 150 Zeilen reduziert
- [ ] GroupStageSchedule auf 200 Zeilen reduziert
- [ ] Step4_Teams auf 200 Zeilen reduziert
- [ ] Keine Datei >300 Zeilen
- [ ] Alle Tests bestehen (keine Regression)
- [ ] TypeScript ohne Errors
- [ ] Code-Review abgeschlossen

---

## Metriken nach Refactoring

| Metrik | Vorher | Nachher (Ziel) |
|--------|--------|----------------|
| Dateien >300 Zeilen | 6 | 0 |
| Durchschnitt Zeilen/Datei | 480 | <200 |
| Max Funktionen/Datei | 30+ | <15 |
| Testbare Units | ~10 | ~40 |

---

## Quellen

- [Common Sense Refactoring of a Messy React Component](https://alexkondov.com/refactoring-a-messy-react-component/)
- [Modularizing React Applications](https://martinfowler.com/articles/modularizing-react-apps.html)
- [Refactoring Guru - Extract Method](https://refactoring.guru/extract-method)
- [Clean Code - Functions](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)
