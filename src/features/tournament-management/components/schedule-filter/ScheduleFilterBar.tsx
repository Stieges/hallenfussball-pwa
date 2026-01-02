/**
 * ScheduleFilterBar - Responsive filter bar for schedule view
 *
 * Automatically renders the appropriate variant:
 * - Desktop (≥768px): Inline dropdowns and inputs
 * - Mobile (<768px): Compact bar + BottomSheet
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md
 */

import { CSSProperties } from 'react';
import { ScheduleFilters } from '../../../../types/scheduleFilters';
import { Match, Team } from '../../../../types/tournament';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { ScheduleFilterBarDesktop } from './ScheduleFilterBarDesktop';
import { ScheduleFilterBarMobile } from './ScheduleFilterBarMobile';
import { ScheduleFilterSheet } from './ScheduleFilterSheet';
import type { FilterOptions } from '../../hooks/useScheduleFilters';

interface ScheduleFilterBarProps {
  // Filter State
  /** Current active filter values */
  filters: ScheduleFilters;
  /** Draft filters (only during sheet open) */
  draftFilters: ScheduleFilters | null;
  /** Number of active filters */
  activeFilterCount: number;

  // Actions
  /** Update active filters directly (desktop) */
  onFilterChange: (updates: Partial<ScheduleFilters>) => void;
  /** Reset all filters */
  onReset: () => void;

  // Sheet controls (mobile)
  /** Whether filter sheet is open */
  isSheetOpen: boolean;
  /** Open the filter sheet */
  onOpenSheet: () => void;
  /** Close sheet without applying */
  onCloseSheet: () => void;
  /** Apply draft and close sheet */
  onApplySheet: () => void;
  /** Reset draft to defaults */
  onResetDraft: () => void;
  /** Update draft filters */
  onDraftChange: (updates: Partial<ScheduleFilters>) => void;

  // Tournament data
  /** Available filter options based on tournament */
  filterOptions: FilterOptions;
  /** All matches (for count preview) */
  matches: Match[];
  /** All teams (for search) */
  teams: Team[];
  /** Get filtered match count */
  getMatchCount: (matches: Match[], teams: Team[], filters?: ScheduleFilters) => number;

  // Visibility (smart sticky)
  /** Whether bar is visible (mobile only) */
  isVisible?: boolean;

  /** Optional container style */
  style?: CSSProperties;

  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export const ScheduleFilterBar: React.FC<ScheduleFilterBarProps> = ({
  filters,
  draftFilters,
  activeFilterCount,
  onFilterChange,
  onReset,
  isSheetOpen,
  onOpenSheet,
  onCloseSheet,
  onApplySheet,
  onResetDraft,
  onDraftChange,
  filterOptions,
  matches,
  teams,
  getMatchCount,
  isVisible = true,
  style,
  'data-testid': testId,
}) => {
  const isMobile = useIsMobile();

  // Calculate match counts for preview
  const totalMatches = matches.length;
  const draftMatchCount = draftFilters
    ? getMatchCount(matches, teams, draftFilters)
    : totalMatches;

  const containerStyle: CSSProperties = {
    marginBottom: isMobile ? 0 : undefined,
    ...style,
  };

  return (
    <div style={containerStyle} data-testid={testId}>
      {isMobile ? (
        <>
          <ScheduleFilterBarMobile
            filters={filters}
            onFilterChange={onFilterChange}
            onOpenSheet={onOpenSheet}
            activeFilterCount={activeFilterCount}
            isVisible={isVisible}
            data-testid={testId ? `${testId}-mobile` : 'schedule-filter-mobile'}
          />
          <ScheduleFilterSheet
            isOpen={isSheetOpen}
            onClose={onCloseSheet}
            onApply={onApplySheet}
            onReset={onResetDraft}
            draftFilters={draftFilters}
            onDraftChange={onDraftChange}
            filterOptions={filterOptions}
            matchCount={draftMatchCount}
            totalMatches={totalMatches}
            data-testid={testId ? `${testId}-sheet` : 'schedule-filter-sheet'}
          />
        </>
      ) : (
        <ScheduleFilterBarDesktop
          filters={filters}
          onFilterChange={onFilterChange}
          onReset={onReset}
          activeFilterCount={activeFilterCount}
          filterOptions={filterOptions}
          data-testid={testId ? `${testId}-desktop` : 'schedule-filter-desktop'}
        />
      )}
    </div>
  );
};
