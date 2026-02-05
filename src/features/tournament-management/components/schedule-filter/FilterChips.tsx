/**
 * FilterChips - Display active filter badges
 *
 * Shows a compact row of active filters with remove buttons.
 * Used in both desktop and mobile views.
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ScheduleFilters } from '../../../../types/scheduleFilters';
import { cssVars } from '../../../../design-tokens';
import { Icons } from '../../../../components/ui/Icons';

interface FilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

interface FilterChipsProps {
  /** Current filter values */
  filters: ScheduleFilters;
  /** Called to update filters */
  onFilterChange: (updates: Partial<ScheduleFilters>) => void;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  filters,
  onFilterChange,
  'data-testid': testId,
}) => {
  const { t } = useTranslation('tournament');

  // Build list of active filter chips
  const chips: FilterChip[] = [];

  if (filters.phase !== 'all') {
    chips.push({
      key: 'phase',
      label: filters.phase === 'groupStage' ? t('filter.groupStage') : t('filter.finals'),
      onRemove: () => onFilterChange({ phase: 'all' }),
    });
  }

  if (filters.group) {
    chips.push({
      key: 'group',
      label: t('filter.groupLabel', { group: filters.group }),
      onRemove: () => onFilterChange({ group: null }),
    });
  }

  if (filters.field) {
    chips.push({
      key: 'field',
      label: t('filter.fieldLabel', { field: filters.field }),
      onRemove: () => onFilterChange({ field: null }),
    });
  }

  if (filters.status.length > 0) {
    const statusLabelKeys: Record<string, string> = {
      scheduled: 'filter.status.scheduled',
      waiting: 'filter.status.waiting',
      running: 'filter.status.running',
      finished: 'filter.status.finished',
      skipped: 'filter.status.skipped',
    };
    const labels = filters.status.map((s) => t((statusLabelKeys[s] || s) as never)).join(', ');
    chips.push({
      key: 'status',
      label: labels,
      onRemove: () => onFilterChange({ status: [] }),
    });
  }

  if (filters.teamSearch.trim().length >= 2) {
    chips.push({
      key: 'team',
      label: `"${filters.teamSearch}"`,
      onRemove: () => onFilterChange({ teamSearch: '' }),
    });
  }

  if (chips.length === 0) {
    return null;
  }

  const containerStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  };

  const chipStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: `${cssVars.colors.primary}15`,
    border: `1px solid ${cssVars.colors.primary}40`,
    borderRadius: cssVars.borderRadius.lg,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.primary,
    minHeight: '44px',
  };

  const removeButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '44px',
    minHeight: '44px',
    margin: `-${cssVars.spacing.sm}`,
    marginLeft: cssVars.spacing.xs,
    padding: cssVars.spacing.sm,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: cssVars.colors.primary,
    borderRadius: cssVars.borderRadius.sm,
    transition: 'background 0.2s',
  };

  return (
    <div style={containerStyle} data-testid={testId}>
      {chips.map((chip) => (
        <span key={chip.key} style={chipStyle}>
          <span>{chip.label}</span>
          <button
            style={removeButtonStyle}
            onClick={(e) => {
              e.stopPropagation();
              chip.onRemove();
            }}
            type="button"
            aria-label={t('filter.removeAriaLabel', { label: chip.label })}
            data-testid={testId ? `${testId}-remove-${chip.key}` : undefined}
          >
            <Icons.X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
};
