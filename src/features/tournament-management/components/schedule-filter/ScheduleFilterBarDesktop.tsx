/**
 * ScheduleFilterBarDesktop - Desktop filter bar for schedule view
 *
 * Displays all filters inline in a horizontal row:
 * - Phase dropdown (Vorrunde/Finale)
 * - Group dropdown (A/B/C/D)
 * - Field dropdown (1-4)
 * - Status multi-select chips
 * - Team search input
 * - Reset button (when filters active)
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ScheduleFilters, PHASE_OPTIONS } from '../../../../types/scheduleFilters';
import { MatchStatus } from '../../../../types/tournament';
import { cssVars } from '../../../../design-tokens';
import { Icons } from '../../../../components/ui/Icons';
import { FilterDropdown, FilterOption } from './FilterDropdown';
import { StatusMultiSelect } from './StatusMultiSelect';
import { TeamSearchInput } from './TeamSearchInput';

// FilterOptions is imported from useScheduleFilters to avoid duplication
import type { FilterOptions } from '../../hooks/useScheduleFilters';

interface ScheduleFilterBarDesktopProps {
  /** Current filter values */
  filters: ScheduleFilters;
  /** Called when any filter changes */
  onFilterChange: (updates: Partial<ScheduleFilters>) => void;
  /** Reset all filters to defaults */
  onReset: () => void;
  /** Number of active filters (for badge) */
  activeFilterCount: number;
  /** Available filter options based on tournament */
  filterOptions: FilterOptions;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}


export const ScheduleFilterBarDesktop: React.FC<ScheduleFilterBarDesktopProps> = ({
  filters,
  onFilterChange,
  onReset,
  activeFilterCount,
  filterOptions,
  'data-testid': testId,
}) => {
  const { t } = useTranslation('tournament');

  // Build translated phase options
  const translatedPhaseOptions: FilterOption[] = PHASE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.value === null
      ? t('filter.allPhases')
      : opt.value === 'groupStage'
        ? t('filter.groupStage')
        : t('filter.finals'),
  }));

  // Build group options from tournament data
  const groupOptions: FilterOption[] = [
    { value: null, label: t('filter.allGroups') },
    ...filterOptions.groups.map((g) => ({ value: g, label: t('filter.groupLabel', { group: g }) })),
  ];

  // Build field options from tournament data
  const fieldOptions: FilterOption[] = [
    { value: null, label: t('filter.allFields') },
    ...filterOptions.fields.map((f) => ({ value: f, label: t('filter.fieldLabel', { field: f }) })),
  ];

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    flexWrap: 'wrap',
  };

  const filterGroupStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'flex-end',
    gap: cssVars.spacing.md,
    flexWrap: 'wrap',
  };

  const dividerStyle: CSSProperties = {
    width: '1px',
    height: '40px',
    background: cssVars.colors.border,
    alignSelf: 'flex-end',
  };

  const resetButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: activeFilterCount > 0 ? `${cssVars.colors.error}15` : 'transparent',
    border: `1px solid ${activeFilterCount > 0 ? cssVars.colors.error : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: activeFilterCount > 0 ? cssVars.colors.error : cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: activeFilterCount > 0 ? 'pointer' : 'not-allowed',
    opacity: activeFilterCount > 0 ? 1 : 0.5,
    transition: 'all 0.2s ease',
    minHeight: '44px',
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: `0 ${cssVars.spacing.xs}`,
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.bold,
    borderRadius: cssVars.borderRadius.full,
  };

  return (
    <div style={containerStyle} data-testid={testId}>
      {/* Dropdown Filters */}
      <div style={filterGroupStyle}>
        {/* Phase Filter */}
        {filterOptions.showPhaseFilter && (
          <FilterDropdown
            label={t('filter.phase')}
            value={filters.phase === 'all' ? null : filters.phase}
            options={translatedPhaseOptions}
            onChange={(value) => {
              const phase = value === null ? 'all' : (value as 'groupStage' | 'finals');
              onFilterChange({ phase });
            }}
            data-testid="filter-phase"
          />
        )}

        {/* Group Filter */}
        {filterOptions.showGroupFilter && (
          <FilterDropdown
            label={t('filter.group')}
            value={filters.group}
            options={groupOptions}
            onChange={(value) => onFilterChange({ group: value as string | null })}
            data-testid="filter-group"
          />
        )}

        {/* Field Filter */}
        {filterOptions.showFieldFilter && (
          <FilterDropdown
            label={t('filter.field')}
            value={filters.field}
            options={fieldOptions}
            onChange={(value) => onFilterChange({ field: value as number | null })}
            data-testid="filter-field"
          />
        )}
      </div>

      {/* Divider */}
      <div style={dividerStyle} />

      {/* Status Multi-Select */}
      <StatusMultiSelect
        value={filters.status}
        onChange={(statuses: MatchStatus[]) => onFilterChange({ status: statuses })}
        data-testid="filter-status"
      />

      {/* Divider */}
      <div style={dividerStyle} />

      {/* Team Search */}
      <TeamSearchInput
        value={filters.teamSearch}
        onChange={(teamSearch) => onFilterChange({ teamSearch })}
        data-testid="filter-team-search"
      />

      {/* Spacer */}
      <div style={{ flex: 1, minWidth: cssVars.spacing.md }} />

      {/* Reset Button with Badge */}
      <button
        style={resetButtonStyle}
        onClick={onReset}
        disabled={activeFilterCount === 0}
        type="button"
        aria-label={t('filter.resetAriaLabel', { count: activeFilterCount })}
        data-testid="filter-reset"
      >
        <Icons.X size={16} />
        <span>{t('filter.reset')}</span>
        {activeFilterCount > 0 && (
          <span style={badgeStyle}>{activeFilterCount}</span>
        )}
      </button>
    </div>
  );
};
