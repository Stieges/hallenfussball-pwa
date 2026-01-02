/**
 * ScheduleFilterBarMobile - Mobile filter bar for schedule view
 *
 * Compact bar showing:
 * - Filter button with badge count
 * - Active filter chips (scrollable)
 * - Smart sticky behavior (hides on scroll down)
 *
 * @see docs/concepts/SPIELPLAN-FILTER-KONZEPT.md
 */

import { CSSProperties } from 'react';
import { ScheduleFilters } from '../../../../types/scheduleFilters';
import { cssVars } from '../../../../design-tokens';
import { Icons } from '../../../../components/ui/Icons';
import { FilterChips } from './FilterChips';

interface ScheduleFilterBarMobileProps {
  /** Current filter values */
  filters: ScheduleFilters;
  /** Called when filter chips are removed */
  onFilterChange: (updates: Partial<ScheduleFilters>) => void;
  /** Open the filter sheet */
  onOpenSheet: () => void;
  /** Number of active filters */
  activeFilterCount: number;
  /** Whether the bar should be visible (smart sticky) */
  isVisible?: boolean;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export const ScheduleFilterBarMobile: React.FC<ScheduleFilterBarMobileProps> = ({
  filters,
  onFilterChange,
  onOpenSheet,
  activeFilterCount,
  isVisible = true,
  'data-testid': testId,
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.sm,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    transition: 'transform 0.3s ease, opacity 0.3s ease',
    transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
    opacity: isVisible ? 1 : 0,
    pointerEvents: isVisible ? 'auto' : 'none',
  };

  const filterButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    padding: cssVars.spacing.sm,
    background: activeFilterCount > 0 ? `${cssVars.colors.primary}15` : cssVars.colors.surfaceLight,
    border: `1px solid ${activeFilterCount > 0 ? cssVars.colors.primary : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: activeFilterCount > 0 ? cssVars.colors.primary : cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    minHeight: '44px',
    minWidth: '44px',
    flexShrink: 0,
    transition: 'all 0.2s ease',
  };

  const badgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '18px',
    height: '18px',
    padding: `0 ${cssVars.spacing.xs}`,
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.bold,
    borderRadius: cssVars.borderRadius.full,
    marginLeft: cssVars.spacing.xs,
  };

  const chipsContainerStyle: CSSProperties = {
    flex: 1,
    overflow: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  };

  const placeholderStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textDisabled,
    fontStyle: 'italic',
    padding: `0 ${cssVars.spacing.sm}`,
  };

  return (
    <div style={containerStyle} data-testid={testId}>
      {/* Filter Button */}
      <button
        style={filterButtonStyle}
        onClick={onOpenSheet}
        type="button"
        aria-label={`Filter öffnen (${activeFilterCount} aktiv)`}
        data-testid={testId ? `${testId}-button` : 'filter-button-mobile'}
      >
        <Icons.Filter size={18} />
        <span>Filter</span>
        {activeFilterCount > 0 && (
          <span style={badgeStyle}>{activeFilterCount}</span>
        )}
      </button>

      {/* Active Filter Chips or Placeholder */}
      <div style={chipsContainerStyle}>
        {activeFilterCount > 0 ? (
          <FilterChips
            filters={filters}
            onFilterChange={onFilterChange}
            data-testid={testId ? `${testId}-chips` : 'filter-chips-mobile'}
          />
        ) : (
          <span style={placeholderStyle}>Keine Filter aktiv</span>
        )}
      </div>
    </div>
  );
};
