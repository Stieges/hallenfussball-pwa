/**
 * StatusMultiSelect - Multi-select chip group for match status
 *
 * Allows selecting multiple match statuses (scheduled, running, finished).
 * Uses chip pattern from SearchFilterBar.
 */

import { CSSProperties } from 'react';
import { MatchStatus } from '../../../../types/tournament';
import { cssVars } from '../../../../design-tokens';
import { Icons } from '../../../../components/ui/Icons';

interface StatusConfig {
  id: MatchStatus;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const STATUS_OPTIONS: StatusConfig[] = [
  {
    id: 'scheduled',
    label: 'Geplant',
    icon: <Icons.Calendar size={14} />,
    color: cssVars.colors.statusUpcoming,
  },
  {
    id: 'running',
    label: 'Laufend',
    icon: <Icons.Play size={14} />,
    color: cssVars.colors.statusLive,
  },
  {
    id: 'finished',
    label: 'Beendet',
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
  label = 'Status',
  'data-testid': testId,
}) => {
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
      <span style={labelStyle}>{label}</span>
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
              aria-label={`Status: ${config.label} ${isActive ? '(aktiv)' : ''}`}
              data-testid={testId ? `${testId}-${config.id}` : undefined}
            >
              {config.icon}
              <span>{config.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
