/**
 * ScheduleFilterSheet - Mobile filter BottomSheet
 *
 * Full-screen filter panel with:
 * - All filter options in vertical layout
 * - Draft state pattern (changes only applied on "Anwenden")
 * - Reset button
 * - Match count preview
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md Section 6
 */

import { CSSProperties } from 'react';
import { ScheduleFilters, PHASE_OPTIONS } from '../../../../types/scheduleFilters';
import { MatchStatus } from '../../../../types/tournament';
import { cssVars } from '../../../../design-tokens';
import { Icons } from '../../../../components/ui/Icons';
import { BottomSheet } from '../../../../components/ui/BottomSheet';
import { FilterDropdown, FilterOption } from './FilterDropdown';
import { StatusMultiSelect } from './StatusMultiSelect';
import { TeamSearchInput } from './TeamSearchInput';

// FilterOptions is imported from useScheduleFilters to avoid duplication
import type { FilterOptions } from '../../hooks/useScheduleFilters';

interface ScheduleFilterSheetProps {
  /** Whether sheet is open */
  isOpen: boolean;
  /** Close sheet without applying changes */
  onClose: () => void;
  /** Apply changes and close sheet */
  onApply: () => void;
  /** Reset draft to defaults */
  onReset: () => void;
  /** Current draft filter values */
  draftFilters: ScheduleFilters | null;
  /** Update draft filters */
  onDraftChange: (updates: Partial<ScheduleFilters>) => void;
  /** Available filter options based on tournament */
  filterOptions: FilterOptions;
  /** Number of matches matching current draft filters */
  matchCount: number;
  /** Total number of matches (unfiltered) */
  totalMatches: number;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}


export const ScheduleFilterSheet: React.FC<ScheduleFilterSheetProps> = ({
  isOpen,
  onClose,
  onApply,
  onReset,
  draftFilters,
  onDraftChange,
  filterOptions,
  matchCount,
  totalMatches,
  'data-testid': testId,
}) => {
  if (!draftFilters) {
    return null;
  }

  // Build group options from tournament data
  const groupOptions: FilterOption[] = [
    { value: null, label: 'Alle Gruppen' },
    ...filterOptions.groups.map((g) => ({ value: g, label: `Gruppe ${g}` })),
  ];

  // Build field options from tournament data
  const fieldOptions: FilterOption[] = [
    { value: null, label: 'Alle Felder' },
    ...filterOptions.fields.map((f) => ({ value: f, label: `Feld ${f}` })),
  ];

  const sectionStyle: CSSProperties = {
    marginBottom: cssVars.spacing.lg,
  };

  const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.md,
    marginTop: cssVars.spacing.xl,
    paddingTop: cssVars.spacing.md,
    borderTop: `1px solid ${cssVars.colors.border}`,
  };

  const resetButtonStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    minHeight: '48px',
  };

  const applyButtonStyle: CSSProperties = {
    flex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    background: cssVars.colors.primary,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    minHeight: '48px',
  };

  const matchCountStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: cssVars.spacing.sm,
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.sm,
    color: matchCount === 0 ? cssVars.colors.error : cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.md,
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Filter"
    >
      <div data-testid={testId}>
        {/* Match Count Preview */}
        <div style={matchCountStyle}>
          <Icons.Filter size={14} />
          <span style={{ marginLeft: cssVars.spacing.xs }}>
            {matchCount} von {totalMatches} Spielen
          </span>
        </div>

        {/* Phase Filter */}
        {filterOptions.showPhaseFilter && (
          <div style={sectionStyle}>
            <FilterDropdown
              label="Phase"
              value={draftFilters.phase === 'all' ? null : draftFilters.phase}
              options={PHASE_OPTIONS}
              onChange={(value) => {
                const phase = value === null ? 'all' : (value as 'groupStage' | 'finals');
                onDraftChange({ phase });
              }}
              data-testid="filter-sheet-phase"
            />
          </div>
        )}

        {/* Group Filter */}
        {filterOptions.showGroupFilter && (
          <div style={sectionStyle}>
            <FilterDropdown
              label="Gruppe"
              value={draftFilters.group}
              options={groupOptions}
              onChange={(value) => onDraftChange({ group: value as string | null })}
              data-testid="filter-sheet-group"
            />
          </div>
        )}

        {/* Field Filter */}
        {filterOptions.showFieldFilter && (
          <div style={sectionStyle}>
            <FilterDropdown
              label="Feld"
              value={draftFilters.field}
              options={fieldOptions}
              onChange={(value) => onDraftChange({ field: value as number | null })}
              data-testid="filter-sheet-field"
            />
          </div>
        )}

        {/* Status Multi-Select */}
        <div style={sectionStyle}>
          <StatusMultiSelect
            value={draftFilters.status}
            onChange={(statuses: MatchStatus[]) => onDraftChange({ status: statuses })}
            data-testid="filter-sheet-status"
          />
        </div>

        {/* Team Search */}
        <div style={sectionStyle}>
          <TeamSearchInput
            value={draftFilters.teamSearch}
            onChange={(teamSearch) => onDraftChange({ teamSearch })}
            debounceMs={0}
            data-testid="filter-sheet-team-search"
          />
        </div>

        {/* Action Buttons */}
        <div style={buttonContainerStyle}>
          <button
            style={resetButtonStyle}
            onClick={onReset}
            type="button"
            data-testid="filter-sheet-reset"
          >
            <Icons.X size={18} />
            Zurücksetzen
          </button>
          <button
            style={applyButtonStyle}
            onClick={onApply}
            type="button"
            data-testid="filter-sheet-apply"
          >
            <Icons.Check size={18} />
            Anwenden ({matchCount})
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
