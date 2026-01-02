/**
 * useScheduleFilters Hook
 *
 * Manages filter state for the schedule view including:
 * - Active filters (controls match list)
 * - Draft filters (only while BottomSheet is open)
 * - BottomSheet open/close state
 * - URL synchronization for shareable filter links
 *
 * Implements Draft-State pattern to prevent data loss on accidental close.
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md Section 6
 */

import { useReducer, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ScheduleFilters,
  FilterState,
  FilterAction,
  DEFAULT_FILTERS,
} from '../../../types/scheduleFilters';
import { Match, Team, Tournament } from '../../../types/tournament';
import { filterMatches, countActiveFilters, hasActiveFilters } from '../../../utils/filterMatches';
import { useURLFilterSync } from '../../../hooks/useURLFilterSync';

// ---------------------------------------------------------------------------
// Storage Keys
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = 'schedule-filters';

function getStorageKey(tournamentId: string): string {
  return `${STORAGE_KEY_PREFIX}-${tournamentId}`;
}

// ---------------------------------------------------------------------------
// Storage Helpers (sessionStorage for tab persistence)
// ---------------------------------------------------------------------------

function loadFiltersFromStorage(tournamentId: string): ScheduleFilters | null {
  try {
    const stored = sessionStorage.getItem(getStorageKey(tournamentId));
    if (stored) {
      return JSON.parse(stored) as ScheduleFilters;
    }
  } catch {
    // Silent fail - storage operations are non-critical
  }
  return null;
}

function saveFiltersToStorage(tournamentId: string, filters: ScheduleFilters): void {
  try {
    sessionStorage.setItem(getStorageKey(tournamentId), JSON.stringify(filters));
  } catch {
    // Silent fail - storage operations are non-critical
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'OPEN_SHEET':
      // Copy active filters to draft when opening sheet
      return {
        ...state,
        isSheetOpen: true,
        draftFilters: { ...state.activeFilters },
      };

    case 'CLOSE_SHEET':
      // Discard draft when closing without apply
      return {
        ...state,
        isSheetOpen: false,
        draftFilters: null,
      };

    case 'UPDATE_DRAFT':
      // Update draft filters (only while sheet is open)
      if (!state.draftFilters) {
        return state;
      }
      return {
        ...state,
        draftFilters: {
          ...state.draftFilters,
          ...action.payload,
        },
      };

    case 'APPLY_DRAFT':
      // Apply draft to active and close sheet
      if (!state.draftFilters) {
        return state;
      }
      return {
        ...state,
        activeFilters: { ...state.draftFilters },
        isSheetOpen: false,
        draftFilters: null,
      };

    case 'RESET_DRAFT':
      // Reset draft to defaults (not active!)
      return {
        ...state,
        draftFilters: { ...DEFAULT_FILTERS },
      };

    case 'UPDATE_ACTIVE':
      // Direct update to active filters (for desktop inline changes)
      return {
        ...state,
        activeFilters: {
          ...state.activeFilters,
          ...action.payload,
        },
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook Interface
// ---------------------------------------------------------------------------

export interface UseScheduleFiltersOptions {
  /** Tournament ID for storage persistence */
  tournamentId: string;
  /** Enable sessionStorage persistence (default: true) */
  enablePersistence?: boolean;
  /** Enable URL query parameter sync (default: true) */
  enableURLSync?: boolean;
}

export interface UseScheduleFiltersReturn {
  /** Current active filters */
  filters: ScheduleFilters;
  /** Draft filters (only during sheet open) */
  draftFilters: ScheduleFilters | null;
  /** Whether BottomSheet is open */
  isSheetOpen: boolean;

  // Sheet actions
  /** Open the filter sheet (copies active to draft) */
  openSheet: () => void;
  /** Close sheet without applying (discards draft) */
  closeSheet: () => void;
  /** Apply draft filters and close sheet */
  applyDraft: () => void;
  /** Reset draft to defaults */
  resetDraft: () => void;

  // Filter updates
  /** Update draft filters (only while sheet open) */
  updateDraft: (updates: Partial<ScheduleFilters>) => void;
  /** Update active filters directly (for desktop) */
  updateFilters: (updates: Partial<ScheduleFilters>) => void;
  /** Reset all active filters to defaults */
  resetFilters: () => void;

  // Computed values
  /** Number of active filters (excluding phase) */
  activeFilterCount: number;
  /** Whether any filter is active */
  hasFilters: boolean;

  // Filter helpers
  /** Get filtered matches based on current (or draft) filters */
  getFilteredMatches: (matches: Match[], teams: Team[], useDraft?: boolean) => Match[];
  /** Get match count for given filters */
  getMatchCount: (matches: Match[], teams: Team[], filters?: ScheduleFilters) => number;
}

// ---------------------------------------------------------------------------
// Hook Implementation
// ---------------------------------------------------------------------------

export function useScheduleFilters(
  options: UseScheduleFiltersOptions
): UseScheduleFiltersReturn {
  const { tournamentId, enablePersistence = true, enableURLSync = true } = options;

  // URL sync hook
  const { getInitialFilters, syncToURL } = useURLFilterSync({
    enabled: enableURLSync,
  });

  // Track if initial URL filters have been applied
  const initializedFromURL = useRef(false);

  // Initialize state with filters from URL > sessionStorage > defaults
  const initialState: FilterState = useMemo(() => {
    // Priority: URL params > sessionStorage > defaults
    const urlFilters = enableURLSync ? getInitialFilters() : {};
    const hasURL = Object.keys(urlFilters).length > 0;

    if (hasURL) {
      initializedFromURL.current = true;
      return {
        activeFilters: { ...DEFAULT_FILTERS, ...urlFilters },
        draftFilters: null,
        isSheetOpen: false,
      };
    }

    const persisted = enablePersistence ? loadFiltersFromStorage(tournamentId) : null;
    return {
      activeFilters: persisted ?? { ...DEFAULT_FILTERS },
      draftFilters: null,
      isSheetOpen: false,
    };
  }, [tournamentId, enablePersistence, enableURLSync, getInitialFilters]);

  const [state, dispatch] = useReducer(filterReducer, initialState);

  // Sync filters to URL when they change
  useEffect(() => {
    if (enableURLSync) {
      syncToURL(state.activeFilters);
    }
  }, [enableURLSync, syncToURL, state.activeFilters]);

  // ---------------------------------------------------------------------------
  // Sheet Actions
  // ---------------------------------------------------------------------------

  const openSheet = useCallback(() => {
    dispatch({ type: 'OPEN_SHEET' });
  }, []);

  const closeSheet = useCallback(() => {
    dispatch({ type: 'CLOSE_SHEET' });
  }, []);

  const applyDraft = useCallback(() => {
    dispatch({ type: 'APPLY_DRAFT' });
    // Persist after applying
    if (enablePersistence && state.draftFilters) {
      saveFiltersToStorage(tournamentId, state.draftFilters);
    }
  }, [enablePersistence, tournamentId, state.draftFilters]);

  const resetDraft = useCallback(() => {
    dispatch({ type: 'RESET_DRAFT' });
  }, []);

  // ---------------------------------------------------------------------------
  // Filter Updates
  // ---------------------------------------------------------------------------

  const updateDraft = useCallback((updates: Partial<ScheduleFilters>) => {
    dispatch({ type: 'UPDATE_DRAFT', payload: updates });
  }, []);

  const updateFilters = useCallback(
    (updates: Partial<ScheduleFilters>) => {
      dispatch({ type: 'UPDATE_ACTIVE', payload: updates });
      // Persist after update
      if (enablePersistence) {
        saveFiltersToStorage(tournamentId, {
          ...state.activeFilters,
          ...updates,
        });
      }
    },
    [enablePersistence, tournamentId, state.activeFilters]
  );

  const resetFilters = useCallback(() => {
    dispatch({ type: 'UPDATE_ACTIVE', payload: DEFAULT_FILTERS });
    if (enablePersistence) {
      saveFiltersToStorage(tournamentId, DEFAULT_FILTERS);
    }
  }, [enablePersistence, tournamentId]);

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const activeFilterCount = useMemo(
    () => countActiveFilters(state.activeFilters),
    [state.activeFilters]
  );

  const hasFilters = useMemo(
    () => hasActiveFilters(state.activeFilters),
    [state.activeFilters]
  );

  // ---------------------------------------------------------------------------
  // Filter Helpers
  // ---------------------------------------------------------------------------

  const getFilteredMatches = useCallback(
    (matches: Match[], teams: Team[], useDraft = false): Match[] => {
      const filtersToUse = useDraft && state.draftFilters
        ? state.draftFilters
        : state.activeFilters;
      return filterMatches(matches, filtersToUse, teams);
    },
    [state.activeFilters, state.draftFilters]
  );

  const getMatchCount = useCallback(
    (matches: Match[], teams: Team[], filters?: ScheduleFilters): number => {
      const filtersToUse = filters ?? state.activeFilters;
      return filterMatches(matches, filtersToUse, teams).length;
    },
    [state.activeFilters]
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    filters: state.activeFilters,
    draftFilters: state.draftFilters,
    isSheetOpen: state.isSheetOpen,

    openSheet,
    closeSheet,
    applyDraft,
    resetDraft,

    updateDraft,
    updateFilters,
    resetFilters,

    activeFilterCount,
    hasFilters,

    getFilteredMatches,
    getMatchCount,
  };
}

// ---------------------------------------------------------------------------
// Helper: Get available filter options from tournament
// ---------------------------------------------------------------------------

export interface FilterOptions {
  /** Available groups (e.g., ['A', 'B', 'C', 'D']) */
  groups: string[];
  /** Available fields (e.g., [1, 2, 3, 4]) */
  fields: number[];
  /** Whether tournament has finals configured */
  hasFinals: boolean;
  /** Whether to show group filter */
  showGroupFilter: boolean;
  /** Whether to show field filter */
  showFieldFilter: boolean;
  /** Whether to show phase filter */
  showPhaseFilter: boolean;
}

export function getFilterOptions(tournament: Tournament): FilterOptions {
  // Get unique groups from matches
  const groups = [...new Set(
    tournament.matches
      .filter((m): m is typeof m & { group: string } => Boolean(m.group))
      .map((m) => m.group)
  )].sort();

  // Get unique fields
  const fields = [...new Set(
    tournament.matches.map((m) => m.field)
  )].sort((a, b) => a - b);

  // Check if tournament has finals
  const hasFinals = tournament.matches.some((m) => m.isFinal);

  return {
    groups,
    fields,
    hasFinals,
    showGroupFilter: groups.length > 1,
    showFieldFilter: fields.length > 1,
    showPhaseFilter: hasFinals,
  };
}

export default useScheduleFilters;
