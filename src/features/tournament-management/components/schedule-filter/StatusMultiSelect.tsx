/**
 * StatusMultiSelect - Multi-select chip group for match status
 *
 * Allows selecting multiple match statuses (scheduled, running, finished).
 * Uses chip pattern from SearchFilterBar.
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { MatchStatus } from '../../../../types/tournament';
import { cssVars } from '../../../../design-tokens';
import { Icons } from '../../../../components/ui/Icons';

interface StatusConfig {
  id: MatchStatus;
  labelKey: string;
  icon: React.ReactNode;
  color: string;
}

const STATUS_OPTIONS: StatusConfig[] = [
  {
    id: 'scheduled',
    labelKey: 'filter.status.scheduled',
    icon: <Icons.Calendar size={14} />,
    color: cssVars.colors.statusUpcoming,
  },
  {
    id: 'running',
    labelKey: 'filter.status.running',
    icon: <Icons.Play size={14} />,
    color: cssVars.colors.statusLive,
  },
  {
    id: 'finished',
    labelKey: 'filter.status.finished',
    icon: <Icons.Check size={14} />,
    color: cssVars.colors.statusFinished,
  },
];

interface StatusMultiSelectProps {
  /** Currently selected statuses */
  value: MatchStatus[];
  /** Called when selection changes */
  onChange: (statuses: MatchStatus[]) => void;
  /** Optional label */
  label?: string;
  /** Test ID prefix for E2E testing */
  'data-testid'?: string;
}

export const StatusMultiSelect: React.FC<StatusMultiSelectProps> = ({
  value,
  onChange,
  label,
  'data-testid': testId,
}) => {
  const { t } = useTranslation('tournament');
  const resolvedLabel = label ?? t('filter.status.label');
  const toggleStatus = (status: MatchStatus) => {
    if (value.includes(status)) {
      onChange(value.filter((s) => s !== status));
    } else {
      onChange([...value, status]);
    }
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
  };

  const chipsContainerStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    flexWrap: 'wrap',
  };

  const getChipStyle = (config: StatusConfig, isActive: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.lg,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: `1px solid ${isActive ? config.color : cssVars.colors.border}`,
    background: isActive ? `${config.color}15` : 'transparent',
    color: isActive ? config.color : cssVars.colors.textSecondary,
    whiteSpace: 'nowrap',
    minHeight: '44px',
  });

  return (
    <div style={containerStyle} data-testid={testId}>
      <span style={labelStyle}>{resolvedLabel}</span>
      <div style={chipsContainerStyle}>
        {STATUS_OPTIONS.map((config) => {
          const isActive = value.includes(config.id);
          return (
            <button
              key={config.id}
              onClick={() => toggleStatus(config.id)}
              style={getChipStyle(config, isActive)}
              type="button"
              aria-pressed={isActive}
              aria-label={`${t('filter.status.label')}: ${String(t(config.labelKey as never))} ${isActive ? t('filter.status.active') : ''}`}
              data-testid={testId ? `${testId}-${config.id}` : undefined}
            >
              {config.icon}
              <span>{t(config.labelKey as never)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
