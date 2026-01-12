import React, { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';

export type ConnectionStatus = 'connected' | 'polling' | 'stale' | 'offline' | 'refreshing';

export interface ConnectionStatusBarProps {
  /** Current connection status */
  status: ConnectionStatus;
  /** Last successful data update timestamp */
  lastUpdate: Date | null;
  /** Callback for manual refresh button */
  onManualRefresh?: () => void;
  /** Hide the manual refresh button */
  hideRefreshButton?: boolean;
}

/**
 * ConnectionStatusBar - Shows real-time connection status and last update time
 *
 * Used in Public View / Live View to indicate data freshness.
 */
export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  status,
  lastUpdate,
  onManualRefresh,
  hideRefreshButton = false,
}) => {
  // Format timestamp as HH:MM:SS
  const formatTime = (date: Date | null): string => {
    if (!date) {return '--:--:--';}
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Status configuration
  const statusConfig: Record<ConnectionStatus, {
    label: string;
    dotColor: string;
    textColor: string;
    animate: boolean;
  }> = {
    connected: {
      label: 'Live',
      dotColor: cssVars.colors.primary,
      textColor: cssVars.colors.primary,
      animate: true,
    },
    polling: {
      label: 'Aktualisiert',
      dotColor: cssVars.colors.secondary,
      textColor: cssVars.colors.textSecondary,
      animate: true,
    },
    stale: {
      label: 'Stand',
      dotColor: cssVars.colors.textMuted,
      textColor: cssVars.colors.textMuted,
      animate: false,
    },
    offline: {
      label: 'Offline',
      dotColor: cssVars.colors.error,
      textColor: cssVars.colors.error,
      animate: false,
    },
    refreshing: {
      label: 'Laden',
      dotColor: cssVars.colors.secondary,
      textColor: cssVars.colors.textSecondary,
      animate: true,
    },
  };

  const config = statusConfig[status];
  const timeLabel = status === 'offline' ? 'Zuletzt' : '';

  // Styles
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    backgroundColor: cssVars.colors.surfaceSubtle,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    fontSize: cssVars.fontSizes.sm,
    minHeight: '32px',
  };

  const statusContainerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const dotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: config.dotColor,
    flexShrink: 0,
    animation: config.animate ? 'pulse-status 2s ease-in-out infinite' : 'none',
  };

  const labelStyle: CSSProperties = {
    color: config.textColor,
    fontWeight: cssVars.fontWeights.medium,
  };

  const timeStyle: CSSProperties = {
    color: cssVars.colors.textSecondary,
  };

  const refreshButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    padding: 0,
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    backgroundColor: 'transparent',
    color: cssVars.colors.textSecondary,
    cursor: onManualRefresh ? 'pointer' : 'default',
    transition: 'all 0.15s ease',
    animation: status === 'refreshing' ? 'spin 1s linear infinite' : 'none',
  };

  return (
    <div style={containerStyle} data-testid="connection-status-bar">
      <div style={statusContainerStyle}>
        <span style={dotStyle} />
        <span style={labelStyle}>{config.label}</span>
        <span style={timeStyle}>
          {timeLabel && `${timeLabel} `}
          {formatTime(lastUpdate)}
        </span>
      </div>

      {!hideRefreshButton && onManualRefresh && (
        <button
          style={refreshButtonStyle}
          onClick={onManualRefresh}
          disabled={status === 'refreshing'}
          title="Manuell aktualisieren"
          data-testid="manual-refresh-btn"
        >
          <RefreshIcon size={16} />
        </button>
      )}

      <style>{`
        @keyframes pulse-status {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        [data-testid="manual-refresh-btn"]:hover:not(:disabled) {
          background-color: ${cssVars.colors.surfaceHover};
          color: ${cssVars.colors.textPrimary};
        }
        [data-testid="manual-refresh-btn"]:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

// Inline Refresh Icon (proper circular arrow)
const RefreshIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path
      d="M14.5 5.5A6 6 0 1 0 16 10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M14 2v4h4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default ConnectionStatusBar;
