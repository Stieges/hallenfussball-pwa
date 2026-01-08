/* eslint-disable react-refresh/only-export-components -- Context pattern requires exporting hooks alongside provider */
import { createContext, useContext, useReducer, useCallback, ReactNode, useMemo } from 'react'
import { Tournament, Match, Team } from '../types/tournament'

// ============================================================================
// State Types
// ============================================================================

interface TournamentState {
  tournament: Tournament | null
  isLoading: boolean
  error: string | null
  isDirty: boolean
  lastSaved: string | null
}

// ============================================================================
// Action Types
// ============================================================================

type TournamentAction =
  | { type: 'LOAD_TOURNAMENT'; payload: Tournament }
  | { type: 'UPDATE_TOURNAMENT'; payload: Partial<Tournament> }
  | { type: 'UPDATE_MATCH'; payload: { matchId: string; updates: Partial<Match> } }
  | { type: 'UPDATE_SCORE'; payload: { matchId: string; scoreA: number; scoreB: number } }
  | { type: 'UPDATE_TEAM'; payload: { teamId: string; updates: Partial<Team> } }
  | { type: 'ADD_TEAM'; payload: Team }
  | { type: 'REMOVE_TEAM'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_SAVED' }
  | { type: 'RESET' }

// ============================================================================
// Initial State
// ============================================================================

const initialState: TournamentState = {
  tournament: null,
  isLoading: false,
  error: null,
  isDirty: false,
  lastSaved: null,
}

// ============================================================================
// Reducer
// ============================================================================

function tournamentReducer(state: TournamentState, action: TournamentAction): TournamentState {
  switch (action.type) {
    case 'LOAD_TOURNAMENT':
      return {
        ...state,
        tournament: action.payload,
        isLoading: false,
        error: null,
        isDirty: false,
      }

    case 'UPDATE_TOURNAMENT':
      if (!state.tournament) {return state}
      return {
        ...state,
        tournament: {
          ...state.tournament,
          ...action.payload,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      }

    case 'UPDATE_MATCH': {
      if (!state.tournament) {return state}
      const { matchId, updates } = action.payload
      const updatedMatches = state.tournament.matches.map((match) =>
        match.id === matchId ? { ...match, ...updates } : match
      )
      return {
        ...state,
        tournament: {
          ...state.tournament,
          matches: updatedMatches,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      }
    }

    case 'UPDATE_SCORE': {
      if (!state.tournament) {return state}
      const { matchId, scoreA, scoreB } = action.payload
      const updatedMatches = state.tournament.matches.map((match) =>
        match.id === matchId ? { ...match, scoreA, scoreB } : match
      )
      return {
        ...state,
        tournament: {
          ...state.tournament,
          matches: updatedMatches,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      }
    }

    case 'UPDATE_TEAM': {
      if (!state.tournament) {return state}
      const { teamId, updates } = action.payload
      const updatedTeams = state.tournament.teams.map((team) =>
        team.id === teamId ? { ...team, ...updates } : team
      )
      return {
        ...state,
        tournament: {
          ...state.tournament,
          teams: updatedTeams,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      }
    }

    case 'ADD_TEAM':
      if (!state.tournament) {return state}
      return {
        ...state,
        tournament: {
          ...state.tournament,
          teams: [...state.tournament.teams, action.payload],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      }

    case 'REMOVE_TEAM':
      if (!state.tournament) {return state}
      return {
        ...state,
        tournament: {
          ...state.tournament,
          teams: state.tournament.teams.filter((t) => t.id !== action.payload),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      }

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }

    case 'MARK_DIRTY':
      return { ...state, isDirty: true }

    case 'MARK_SAVED':
      return {
        ...state,
        isDirty: false,
        lastSaved: new Date().toISOString(),
      }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

// ============================================================================
// Context
// ============================================================================

interface TournamentContextValue {
  // State
  state: TournamentState
  tournament: Tournament | null
  isLoading: boolean
  isDirty: boolean
  error: string | null

  // Actions
  loadTournament: (tournament: Tournament) => void
  updateTournament: (updates: Partial<Tournament>) => void
  updateMatch: (matchId: string, updates: Partial<Match>) => void
  updateScore: (matchId: string, scoreA: number, scoreB: number) => void
  updateTeam: (teamId: string, updates: Partial<Team>) => void
  addTeam: (team: Team) => void
  removeTeam: (teamId: string) => void
  setError: (error: string | null) => void
  reset: () => void
  save: () => Promise<void>

  // Selectors
  getMatch: (matchId: string) => Match | undefined
  getTeam: (teamId: string) => Team | undefined
  getMatchesByGroup: (group: string) => Match[]
  getMatchesByField: (field: number) => Match[]
  getMatchesByRound: (round: number) => Match[]
}

const TournamentContext = createContext<TournamentContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface TournamentProviderProps {
  children: ReactNode
  initialTournament?: Tournament
  onSave?: (tournament: Tournament) => Promise<void>
}

export function TournamentProvider({
  children,
  initialTournament,
  onSave,
}: TournamentProviderProps) {
  const [state, dispatch] = useReducer(
    tournamentReducer,
    initialTournament
      ? { ...initialState, tournament: initialTournament }
      : initialState
  )

  // ========== Actions ==========

  const loadTournament = useCallback((tournament: Tournament) => {
    dispatch({ type: 'LOAD_TOURNAMENT', payload: tournament })
  }, [])

  const updateTournament = useCallback((updates: Partial<Tournament>) => {
    dispatch({ type: 'UPDATE_TOURNAMENT', payload: updates })
  }, [])

  const updateMatch = useCallback((matchId: string, updates: Partial<Match>) => {
    dispatch({ type: 'UPDATE_MATCH', payload: { matchId, updates } })
  }, [])

  const updateScore = useCallback((matchId: string, scoreA: number, scoreB: number) => {
    dispatch({ type: 'UPDATE_SCORE', payload: { matchId, scoreA, scoreB } })
  }, [])

  const updateTeam = useCallback((teamId: string, updates: Partial<Team>) => {
    dispatch({ type: 'UPDATE_TEAM', payload: { teamId, updates } })
  }, [])

  const addTeam = useCallback((team: Team) => {
    dispatch({ type: 'ADD_TEAM', payload: team })
  }, [])

  const removeTeam = useCallback((teamId: string) => {
    dispatch({ type: 'REMOVE_TEAM', payload: teamId })
  }, [])

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const save = useCallback(async () => {
    if (!state.tournament) {return}

    try {
      if (onSave) {
        await onSave(state.tournament)
      } else {
        // No onSave callback provided - this is a configuration error
        throw new Error('TournamentProvider: onSave callback is required for persistence')
      }
      dispatch({ type: 'MARK_SAVED' })
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Speichern fehlgeschlagen',
      })
    }
  }, [state.tournament, onSave])

  // ========== Selectors ==========

  const getMatch = useCallback(
    (matchId: string) => state.tournament?.matches.find((m) => m.id === matchId),
    [state.tournament?.matches]
  )

  const getTeam = useCallback(
    (teamId: string) => state.tournament?.teams.find((t) => t.id === teamId),
    [state.tournament?.teams]
  )

  const getMatchesByGroup = useCallback(
    (group: string) =>
      state.tournament?.matches.filter((m) => m.group === group) ?? [],
    [state.tournament?.matches]
  )

  const getMatchesByField = useCallback(
    (field: number) =>
      state.tournament?.matches.filter((m) => m.field === field) ?? [],
    [state.tournament?.matches]
  )

  const getMatchesByRound = useCallback(
    (round: number) =>
      state.tournament?.matches.filter((m) => m.round === round) ?? [],
    [state.tournament?.matches]
  )

  // ========== Context Value ==========

  const value = useMemo<TournamentContextValue>(
    () => ({
      state,
      tournament: state.tournament,
      isLoading: state.isLoading,
      isDirty: state.isDirty,
      error: state.error,
      loadTournament,
      updateTournament,
      updateMatch,
      updateScore,
      updateTeam,
      addTeam,
      removeTeam,
      setError,
      reset,
      save,
      getMatch,
      getTeam,
      getMatchesByGroup,
      getMatchesByField,
      getMatchesByRound,
    }),
    [
      state,
      loadTournament,
      updateTournament,
      updateMatch,
      updateScore,
      updateTeam,
      addTeam,
      removeTeam,
      setError,
      reset,
      save,
      getMatch,
      getTeam,
      getMatchesByGroup,
      getMatchesByField,
      getMatchesByRound,
    ]
  )

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useTournament() {
  const context = useContext(TournamentContext)

  if (!context) {
    throw new Error('useTournament must be used within a TournamentProvider')
  }

  return context
}

// ============================================================================
// Selector Hooks (for performance optimization)
// ============================================================================

/**
 * Hook to get only tournament metadata (prevents re-renders on match updates)
 */
export function useTournamentMeta() {
  const { tournament } = useTournament()

  return useMemo(
    () => ({
      id: tournament?.id,
      title: tournament?.title,
      date: tournament?.date,
      location: tournament?.location,
      status: tournament?.status,
      sport: tournament?.sport,
      numberOfTeams: tournament?.numberOfTeams,
      numberOfGroups: tournament?.numberOfGroups,
    }),
    [
      tournament?.id,
      tournament?.title,
      tournament?.date,
      tournament?.location,
      tournament?.status,
      tournament?.sport,
      tournament?.numberOfTeams,
      tournament?.numberOfGroups,
    ]
  )
}

/**
 * Hook to get a specific match with update function
 */
export function useMatch(matchId: string) {
  const { getMatch, updateScore, updateMatch } = useTournament()
  const match = getMatch(matchId)

  return {
    match,
    updateScore: (scoreA: number, scoreB: number) => updateScore(matchId, scoreA, scoreB),
    updateMatch: (updates: Partial<Match>) => updateMatch(matchId, updates),
  }
}

/**
 * Hook to get teams with update function
 */
export function useTeams() {
  const { tournament, updateTeam, addTeam, removeTeam } = useTournament()

  return {
    teams: tournament?.teams ?? [],
    updateTeam,
    addTeam,
    removeTeam,
  }
}
