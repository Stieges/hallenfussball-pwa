/**
 * Schedule Filter Types
 *
 * Type definitions for the schedule filter functionality.
 * Used to filter matches in the schedule view.
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md
 */

import { MatchStatus } from './tournament';

/**
 * Filter state for schedule view
 */
export interface ScheduleFilters {
  /** Phase filter: all, groupStage, or finals */
  phase: 'all' | 'groupStage' | 'finals';
  /** Group filter: 'A', 'B', 'C', 'D' or null for all */
  group: string | null;
  /** Field filter: 1-4 or null for all */
  field: number | null;
  /** Status filter: multi-select, empty array means all */
  status: MatchStatus[];
  /** Team search: free text search */
  teamSearch: string;
}

/**
 * Default filter values - shows all matches
 */
export const DEFAULT_FILTERS: ScheduleFilters = {
  phase: 'all',
  group: null,
  field: null,
  status: [],
  teamSearch: '',
};

/**
 * Filter action types for reducer
 */
export type FilterAction =
  | { type: 'OPEN_SHEET' }
  | { type: 'CLOSE_SHEET' }
  | { type: 'UPDATE_DRAFT'; payload: Partial<ScheduleFilters> }
  | { type: 'APPLY_DRAFT' }
  | { type: 'RESET_DRAFT' }
  | { type: 'UPDATE_ACTIVE'; payload: Partial<ScheduleFilters> };

/**
 * Filter state including draft state for BottomSheet
 */
export interface FilterState {
  /** Active filters (controls match list) */
  activeFilters: ScheduleFilters;
  /** Draft filters (only while BottomSheet is open) */
  draftFilters: ScheduleFilters | null;
  /** BottomSheet open state */
  isSheetOpen: boolean;
}

// ---------------------------------------------------------------------------
// Shared Constants
// ---------------------------------------------------------------------------

/**
 * Phase filter option type
 */
export interface PhaseOption {
  value: 'groupStage' | 'finals' | null;
  label: string;
}

/**
 * Static phase options for filter dropdowns
 */
export const PHASE_OPTIONS: PhaseOption[] = [
  { value: null, label: 'Alle Phasen' },
  { value: 'groupStage', label: 'Vorrunde' },
  { value: 'finals', label: 'Finalrunde' },
];
