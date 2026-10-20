/**
 * useScheduleFilters Hook
 *
 * Manages filter state for the schedule view including:
 * - Active filters (controls match list)
 * - Draft filters (only while BottomSheet is open)
 * - BottomSheet open/close state
 * - Adresse als Quelle der aktiven Filter (useSearchParams, @OB-029): Link teilen, neu laden, Zurück
 *
 * Implements Draft-State pattern to prevent data loss on accidental close.
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md Section 6
 */

import { useReducer, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ScheduleFilters,
  FilterState,
  DEFAULT_FILTERS,
} from '../../../types/scheduleFilters';
import { Match, Team, Tournament } from '../../../types/tournament';
import { filterMatches, countActiveFilters, hasActiveFilters } from '../../../utils/filterMatches';
import {
  applyScheduleFiltersToParams,
  parseScheduleFilterParams,
} from './scheduleFilterParams';

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/** Die aktiven Filter stehen in der Adresse; der Reducer hält nur Entwurf und Sheet-Zustand. */
type SheetState = Pick<FilterState, 'draftFilters' | 'isSheetOpen'>;
type SheetAction =
  | { type: 'OPEN_SHEET'; active: ScheduleFilters }
  | { type: 'CLOSE_SHEET' }
  | { type: 'UPDATE_DRAFT'; payload: Partial<ScheduleFilters> }
  | { type: 'RESET_DRAFT' };

function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case 'OPEN_SHEET':
      // Aktive Filter beim Öffnen in den Entwurf kopieren
      return { isSheetOpen: true, draftFilters: { ...action.active } };
    case 'CLOSE_SHEET':
      // Entwurf beim Schließen ohne Übernehmen verwerfen
      return { isSheetOpen: false, draftFilters: null };
    case 'UPDATE_DRAFT':
      if (!state.draftFilters) {
        return state;
      }
      return { ...state, draftFilters: { ...state.draftFilters, ...action.payload } };
    case 'RESET_DRAFT':
      // Entwurf auf Standard (nicht die aktiven Filter)
      return { ...state, draftFilters: { ...DEFAULT_FILTERS } };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook Interface
// ---------------------------------------------------------------------------

export interface UseScheduleFiltersOptions {
  /** Wertebereich des Turniers: unbekannte gruppe/field-Werte aus der Adresse werden ignoriert */
  filterOptions?: FilterOptions;
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
  options: UseScheduleFiltersOptions = {}
): UseScheduleFiltersReturn {
  const { filterOptions } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const [sheet, dispatch] = useReducer(sheetReducer, { draftFilters: null, isSheetOpen: false });

  // Aktive Filter = Adresse (einzige Quelle): Direktaufruf, Neu laden und Zurück ergeben sich daraus.
  const paramString = searchParams.toString();
  const filters = useMemo(
    () => parseScheduleFilterParams(new URLSearchParams(paramString), filterOptions),
    [paramString, filterOptions]
  );

  // Jede Änderung ist ein Verlaufseintrag (Zurück stellt den vorigen Filter wieder her).
  const writeFilters = useCallback(
    (update: (current: ScheduleFilters) => ScheduleFilters) => {
      setSearchParams((prev) => {
        const next = applyScheduleFiltersToParams(prev, update(parseScheduleFilterParams(prev, filterOptions)));
        return next.toString() === prev.toString() ? prev : next;
      });
    },
    [setSearchParams, filterOptions]
  );

  // ---------------------------------------------------------------------------
  // Sheet Actions
  // ---------------------------------------------------------------------------

  const openSheet = useCallback(() => {
    dispatch({ type: 'OPEN_SHEET', active: filters });
  }, [filters]);

  const closeSheet = useCallback(() => {
    dispatch({ type: 'CLOSE_SHEET' });
  }, []);

  const applyDraft = useCallback(() => {
    const draft = sheet.draftFilters;
    if (draft) {
      writeFilters(() => draft);
    }
    dispatch({ type: 'CLOSE_SHEET' });
  }, [sheet.draftFilters, writeFilters]);

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
    (updates: Partial<ScheduleFilters>) => writeFilters((current) => ({ ...current, ...updates })),
    [writeFilters]
  );

  const resetFilters = useCallback(
    () => writeFilters(() => ({ ...DEFAULT_FILTERS, status: [] })),
    [writeFilters]
  );

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const activeFilterCount = useMemo(
    () => countActiveFilters(filters),
    [filters]
  );

  const hasFilters = useMemo(
    () => hasActiveFilters(filters),
    [filters]
  );

  // ---------------------------------------------------------------------------
  // Filter Helpers
  // ---------------------------------------------------------------------------

  const getFilteredMatches = useCallback(
    (matches: Match[], teams: Team[], useDraft = false): Match[] => {
      const filtersToUse = useDraft && sheet.draftFilters
        ? sheet.draftFilters
        : filters;
      return filterMatches(matches, filtersToUse, teams);
    },
    [filters, sheet.draftFilters]
  );

  const getMatchCount = useCallback(
    (matches: Match[], teams: Team[], override?: ScheduleFilters): number => {
      const filtersToUse = override ?? filters;
      return filterMatches(matches, filtersToUse, teams).length;
    },
    [filters]
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    filters,
    draftFilters: sheet.draftFilters,
    isSheetOpen: sheet.isSheetOpen,

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
