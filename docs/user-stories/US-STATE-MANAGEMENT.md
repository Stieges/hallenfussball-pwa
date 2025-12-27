# US-STATE-MANAGEMENT: TournamentContext einführen

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-STATE-MANAGEMENT |
| **Priorität** | High |
| **Status** | Done |
| **Erstellt** | 2025-12-25 |
| **Kategorie** | Architektur / State Management |
| **Impact** | Hoch - Reduziert Props Drilling, verbessert Performance |
| **Aufwand** | 2-3 Tage |

---

## User Story

**Als** Entwickler
**möchte ich** ein zentrales State-Management für Tournament-Daten haben
**damit** ich nicht Tournament-Objekte durch 5+ Komponenten-Ebenen durchreichen muss (Props Drilling)

---

## Kontext & Auswirkungen

### Aktueller Zustand ✅ IMPLEMENTIERT

**TournamentContext ist vollständig implementiert in `src/contexts/TournamentContext.tsx`:**

```typescript
// Implementierte Features:
├── TournamentProvider      ✓ Context Provider
├── useTournament()         ✓ Haupt-Hook
├── useTournamentMeta()     ✓ Selector für Metadaten
├── useMatch(matchId)       ✓ Selector für einzelne Matches
├── useTeams()              ✓ Selector für Teams
├── Actions                 ✓ loadTournament, updateMatch, updateScore, etc.
└── Selectors               ✓ getMatch, getTeam, getMatchesByGroup, etc.
```

**Stand: Dezember 2025 - Context API mit useReducer vollständig implementiert.**

### Historisch: Props Drilling (vorher)

```typescript
// Vorher: Tournament wurde durch viele Ebenen gereicht
<TournamentManagementScreen tournament={tournament}>
  <TabContent tournament={tournament}>
    <ScheduleTab tournament={tournament}>
      <GroupStageSchedule tournament={tournament}>
        <MatchRow tournament={tournament}>
          <TeamDisplay tournament={tournament}>
            // 6 Ebenen tief!
```

### Auswirkungen von Props Drilling

| Problem | Auswirkung | Schweregrad |
|---------|------------|-------------|
| Viele Props pro Komponente | GroupStageSchedule hat 11 Props | Hoch |
| Schwer zu refactoren | Änderung an Props erfordert Änderung in allen Ebenen | Hoch |
| Unnötige Re-Renders | Mittlere Komponenten rendern bei State-Change | Mittel |
| Schwer lesbar | Props-Ketten verschleiern Datenfluss | Mittel |

### State Management Optionen 2024 (Recherche)

| Lösung | Pros | Cons | Empfehlung |
|--------|------|------|------------|
| **Context API** | Built-in, einfach, kein Bundle-Size | Performance bei häufigen Updates | Für Tournament-State ideal |
| **Zustand** | Minimal, schnell, kein Provider | Kleiner Ecosystem | Gute Alternative |
| **Redux Toolkit** | Mächtig, DevTools, Middleware | Boilerplate, Lernkurve | Overkill für diese App |

**Empfehlung:** Context API mit `useReducer` für Tournament-State

---

## Acceptance Criteria

### Phase 1: Context Setup

1. **AC1:** Given ein TournamentContext, When ich ihn in der App bereitstelle, Then ist er in allen Kind-Komponenten verfügbar.

2. **AC2:** Given `useTournament()` Hook, When ich ihn aufrufe, Then erhalte ich Tournament-State und Dispatch-Funktionen.

3. **AC3:** Given der Context, When ich den Tournament-State ändere, Then werden nur betroffene Komponenten neu gerendert.

### Phase 2: Migration

4. **AC4:** Given TournamentManagementScreen, When ich Tournament-Props entferne, Then nutzen Kinder den Context.

5. **AC5:** Given GroupStageSchedule (11 Props), When migriert, Then hat sie max. 5 Props.

6. **AC6:** Given alle Management-Tabs, When migriert, Then nutzen sie `useTournament()`.

### Phase 3: Optimierung

7. **AC7:** Given häufig ändernde Daten (Timer, Scores), When ich sie aktualisiere, Then werden nicht alle Komponenten neu gerendert.

8. **AC8:** Given Performance-Tests, When ich Re-Renders messe, Then sind sie ≤ 50% weniger als vorher.

---

## Technische Hinweise

### 1. Tournament Context mit useReducer

```typescript
// src/contexts/TournamentContext.tsx
import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react'
import { Tournament, Match, Team, Schedule } from '../types/tournament'

// State Type
interface TournamentState {
  tournament: Tournament | null
  schedule: Schedule | null
  isLoading: boolean
  error: string | null
  isDirty: boolean
}

// Action Types
type TournamentAction =
  | { type: 'LOAD_TOURNAMENT'; payload: Tournament }
  | { type: 'SET_SCHEDULE'; payload: Schedule }
  | { type: 'UPDATE_SCORE'; payload: { matchId: string; homeScore: number; awayScore: number } }
  | { type: 'UPDATE_MATCH'; payload: { matchId: string; updates: Partial<Match> } }
  | { type: 'UPDATE_TEAM'; payload: { teamId: string; updates: Partial<Team> } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_CLEAN' }
  | { type: 'RESET' }

// Reducer
function tournamentReducer(state: TournamentState, action: TournamentAction): TournamentState {
  switch (action.type) {
    case 'LOAD_TOURNAMENT':
      return {
        ...state,
        tournament: action.payload,
        isLoading: false,
        error: null,
      }

    case 'SET_SCHEDULE':
      return {
        ...state,
        schedule: action.payload,
      }

    case 'UPDATE_SCORE': {
      if (!state.schedule) return state

      const { matchId, homeScore, awayScore } = action.payload
      const updatedMatches = state.schedule.matches.map(match =>
        match.id === matchId
          ? { ...match, homeScore, awayScore }
          : match
      )

      return {
        ...state,
        schedule: { ...state.schedule, matches: updatedMatches },
        isDirty: true,
      }
    }

    case 'UPDATE_MATCH': {
      if (!state.schedule) return state

      const { matchId, updates } = action.payload
      const updatedMatches = state.schedule.matches.map(match =>
        match.id === matchId
          ? { ...match, ...updates }
          : match
      )

      return {
        ...state,
        schedule: { ...state.schedule, matches: updatedMatches },
        isDirty: true,
      }
    }

    case 'UPDATE_TEAM': {
      if (!state.tournament) return state

      const { teamId, updates } = action.payload
      const updatedTeams = state.tournament.teams.map(team =>
        team.id === teamId
          ? { ...team, ...updates }
          : team
      )

      return {
        ...state,
        tournament: { ...state.tournament, teams: updatedTeams },
        isDirty: true,
      }
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }

    case 'MARK_DIRTY':
      return { ...state, isDirty: true }

    case 'MARK_CLEAN':
      return { ...state, isDirty: false }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

const initialState: TournamentState = {
  tournament: null,
  schedule: null,
  isLoading: true,
  error: null,
  isDirty: false,
}

// Context
interface TournamentContextValue {
  state: TournamentState
  dispatch: React.Dispatch<TournamentAction>
  // Convenience Actions
  loadTournament: (tournament: Tournament) => void
  updateScore: (matchId: string, homeScore: number, awayScore: number) => void
  updateMatch: (matchId: string, updates: Partial<Match>) => void
  updateTeam: (teamId: string, updates: Partial<Team>) => void
  save: () => Promise<void>
}

const TournamentContext = createContext<TournamentContextValue | null>(null)

// Provider
interface TournamentProviderProps {
  children: ReactNode
  tournamentId?: string
}

export function TournamentProvider({ children, tournamentId }: TournamentProviderProps) {
  const [state, dispatch] = useReducer(tournamentReducer, initialState)

  // Convenience Actions
  const loadTournament = useCallback((tournament: Tournament) => {
    dispatch({ type: 'LOAD_TOURNAMENT', payload: tournament })
  }, [])

  const updateScore = useCallback((matchId: string, homeScore: number, awayScore: number) => {
    dispatch({ type: 'UPDATE_SCORE', payload: { matchId, homeScore, awayScore } })
  }, [])

  const updateMatch = useCallback((matchId: string, updates: Partial<Match>) => {
    dispatch({ type: 'UPDATE_MATCH', payload: { matchId, updates } })
  }, [])

  const updateTeam = useCallback((teamId: string, updates: Partial<Team>) => {
    dispatch({ type: 'UPDATE_TEAM', payload: { teamId, updates } })
  }, [])

  const save = useCallback(async () => {
    if (!state.tournament) return

    // Save to localStorage
    localStorage.setItem(
      `tournament_${state.tournament.id}`,
      JSON.stringify({ tournament: state.tournament, schedule: state.schedule })
    )

    dispatch({ type: 'MARK_CLEAN' })
  }, [state.tournament, state.schedule])

  const value: TournamentContextValue = {
    state,
    dispatch,
    loadTournament,
    updateScore,
    updateMatch,
    updateTeam,
    save,
  }

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  )
}

// Hook
export function useTournament() {
  const context = useContext(TournamentContext)

  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider')
  }

  return context
}

// Selector Hooks für Performance-Optimierung
export function useTournamentMeta() {
  const { state } = useTournament()
  return {
    name: state.tournament?.name,
    date: state.tournament?.date,
    status: state.tournament?.status,
  }
}

export function useMatch(matchId: string) {
  const { state, updateScore, updateMatch } = useTournament()
  const match = state.schedule?.matches.find(m => m.id === matchId)

  return {
    match,
    updateScore: (home: number, away: number) => updateScore(matchId, home, away),
    updateMatch: (updates: Partial<Match>) => updateMatch(matchId, updates),
  }
}

export function useTeams() {
  const { state, updateTeam } = useTournament()
  return {
    teams: state.tournament?.teams ?? [],
    updateTeam,
  }
}
```

### 2. Provider Integration in App

```typescript
// src/App.tsx
import { TournamentProvider } from './contexts/TournamentContext'

function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardScreen />} />

      {/* Tournament-Routen mit Provider */}
      <Route
        path="/tournament/:id/*"
        element={
          <TournamentProvider>
            <TournamentManagementScreen />
          </TournamentProvider>
        }
      />
    </Routes>
  )
}
```

### 3. Komponenten-Migration

```typescript
// VORHER: GroupStageSchedule.tsx (11 Props!)
interface GroupStageScheduleProps {
  tournament: Tournament
  schedule: Schedule
  onScoreUpdate: (matchId: string, home: number, away: number) => void
  onMatchUpdate: (matchId: string, updates: Partial<Match>) => void
  onFieldChange: (matchId: string, fieldId: string) => void
  onRefereeChange: (matchId: string, refereeId: string) => void
  selectedField: string | null
  selectedGroup: string | null
  isReadonly: boolean
  showReferees: boolean
  showFields: boolean
}

// NACHHER: Mit Context (5 Props)
interface GroupStageScheduleProps {
  selectedField?: string | null
  selectedGroup?: string | null
  isReadonly?: boolean
  showReferees?: boolean
  showFields?: boolean
}

export function GroupStageSchedule({
  selectedField = null,
  selectedGroup = null,
  isReadonly = false,
  showReferees = true,
  showFields = true,
}: GroupStageScheduleProps) {
  // State aus Context
  const { state, updateScore, updateMatch } = useTournament()
  const { tournament, schedule } = state

  // Keine Props mehr für Tournament/Schedule/Callbacks!
  const handleScoreChange = (matchId: string, home: number, away: number) => {
    updateScore(matchId, home, away)
  }

  // ...
}
```

### 4. Performance-Optimierung mit Selektoren

```typescript
// Separate Contexts für unterschiedliche Update-Frequenzen
// src/contexts/LiveMatchContext.tsx (für Timer/Scores)

interface LiveMatchState {
  currentMatchId: string | null
  timerSeconds: number
  isTimerRunning: boolean
}

// Dieser Context updated häufig, aber beeinflusst nur wenige Komponenten
export function LiveMatchProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(liveMatchReducer, initialState)

  // Separater Context für häufige Updates
  return (
    <LiveMatchContext.Provider value={{ state, dispatch }}>
      {children}
    </LiveMatchContext.Provider>
  )
}
```

---

## Migrations-Plan

### Phase 1: Context erstellen (Tag 1)
1. TournamentContext.tsx erstellen
2. Types definieren
3. Reducer implementieren
4. Provider in App.tsx integrieren

### Phase 2: Management-Screen migrieren (Tag 1-2)
1. TournamentManagementScreen auf Context umstellen
2. Tabs einzeln migrieren
3. Props entfernen

### Phase 3: Schedule-Komponenten (Tag 2)
1. GroupStageSchedule migrieren
2. FinalStageSchedule migrieren
3. MatchRow/MatchCard migrieren

### Phase 4: Optimierung (Tag 3)
1. Re-Render-Analyse
2. Selector-Hooks erstellen
3. useMemo/useCallback wo nötig

---

## Definition of Done

- [ ] TournamentContext implementiert
- [ ] TournamentProvider in App.tsx
- [ ] useTournament Hook funktional
- [ ] TournamentManagementScreen migriert
- [ ] Alle Tabs migriert
- [ ] GroupStageSchedule: 11 Props → max. 5
- [ ] Keine Props-Durchreichung mehr für Tournament
- [ ] Performance-Test: Weniger Re-Renders
- [ ] TypeScript ohne Errors

---

## Quellen

- [State Management in 2025](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k)
- [React Context API vs Redux vs Zustand](https://medium.com/@mnnasik7/comparing-react-state-management-redux-zustand-and-context-api-449e983a19a2)
- [Zustand and React Context](https://tkdodo.eu/blog/zustand-and-react-context)
- [Redux vs Zustand](https://www.wisp.blog/blog/zustand-vs-redux-making-sense-of-react-state-management)
