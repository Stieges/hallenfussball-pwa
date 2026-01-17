/**
 * SyncIndicator - Visual indicator for offline sync queue status
 *
 * Part of Phase 1.4: Shows users the state of their offline changes.
 *
 * States:
 * - Synced: "✓ Synchronisiert"
 * - Pending: "X Änderungen warten"
 * - Syncing: "Synchronisiere..."
 * - Offline: "Offline - X Änderungen lokal"
 * - Error: "X fehlgeschlagen"
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';
import { useSyncQueue } from '../../hooks/useSyncQueue';

export type SyncIndicatorVariant = 'badge' | 'bar' | 'compact';

export interface SyncIndicatorProps {
  /** Display variant */
  variant?: SyncIndicatorVariant;
  /** Show manual sync button */
  showSyncButton?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * SyncIndicator - Shows sync queue status
 *
 * @example
 * ```tsx
 * // In header as compact badge
 * <SyncIndicator variant="compact" />
 *
 * // As full status bar
 * <SyncIndicator variant="bar" showSyncButton />
 * ```
 */
export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  variant = 'compact',
  showSyncButton = false,
  className,
}) => {
  const {
    queueSize,
    isProcessing,
    lastSyncAt,
    isOnline,
    failedCount,
    processNow,
  } = useSyncQueue();

  // Determine display state
  type DisplayState = 'synced' | 'pending' | 'syncing' | 'offline' | 'error';

  const getState = (): DisplayState => {
    if (!isOnline) {
      return 'offline';
    }
    if (isProcessing) {
      return 'syncing';
    }
    if (failedCount > 0) {
      return 'error';
    }
    if (queueSize > 0) {
      return 'pending';
    }
    return 'synced';
  };

  const state = getState();

  // State configurations
  const stateConfig: Record<
    DisplayState,
    {
      label: string;
      dotColor: string;
      textColor: string;
      bgColor: string;
      animate: boolean;
      icon: string;
    }
  > = {
    synced: {
      label: 'Synchronisiert',
      dotColor: cssVars.colors.primary,
      textColor: cssVars.colors.primary,
      bgColor: 'transparent',
      animate: false,
      icon: '✓',
    },
    pending: {
      label: `${queueSize} Änderung${queueSize !== 1 ? 'en' : ''} warten`,
      dotColor: cssVars.colors.secondary,
      textColor: cssVars.colors.textSecondary,
      bgColor: cssVars.colors.surfaceSubtle,
      animate: true,
      icon: '↻',
    },
    syncing: {
      label: 'Synchronisiere...',
      dotColor: cssVars.colors.primary,
      textColor: cssVars.colors.primary,
      bgColor: cssVars.colors.surfaceSubtle,
      animate: true,
      icon: '⟳',
    },
    offline: {
      label: queueSize > 0 ? `Offline - ${queueSize} lokal` : 'Offline',
      dotColor: cssVars.colors.textMuted,
      textColor: cssVars.colors.textMuted,
      bgColor: cssVars.colors.surfaceSubtle,
      animate: false,
      icon: '○',
    },
    error: {
      label: `${failedCount} fehlgeschlagen`,
      dotColor: cssVars.colors.error,
      textColor: cssVars.colors.error,
      bgColor: `${cssVars.colors.error}15`,
      animate: false,
      icon: '!',
    },
  };

  const config = stateConfig[state];

  // Format last sync time
  const formatLastSync = (): string => {
    if (!lastSyncAt) {
      return '';
    }
    return lastSyncAt.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle sync button click
  const handleSyncClick = () => {
    if (isOnline && !isProcessing && queueSize > 0) {
      void processNow();
    }
  };

  // Render based on variant
  if (variant === 'compact') {
    return (
      <CompactIndicator
        config={config}
        state={state}
        className={className}
      />
    );
  }

  if (variant === 'badge') {
    return (
      <BadgeIndicator
        config={config}
        state={state}
        queueSize={queueSize}
        className={className}
      />
    );
  }

  // variant === 'bar'
  return (
    <BarIndicator
      config={config}
      state={state}
      lastSync={formatLastSync()}
      showSyncButton={showSyncButton}
      canSync={isOnline && !isProcessing && queueSize > 0}
      onSyncClick={handleSyncClick}
      className={className}
    />
  );
};

// Compact variant - just a colored dot
interface CompactIndicatorProps {
  config: {
    dotColor: string;
    animate: boolean;
  };
  state: string;
  className?: string;
}

const CompactIndicator: React.FC<CompactIndicatorProps> = ({
  config,
  state,
  className,
}) => {
  const dotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: config.dotColor,
    animation: config.animate ? 'pulse-sync 2s ease-in-out infinite' : 'none',
  };

  return (
    <span
      className={className}
      style={dotStyle}
      title={state}
      data-testid="sync-indicator-compact"
    >
      <style>{`
        @keyframes pulse-sync {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </span>
  );
};

// Badge variant - dot + count
interface BadgeIndicatorProps {
  config: {
    dotColor: string;
    bgColor: string;
    animate: boolean;
  };
  state: string;
  queueSize: number;
  className?: string;
}

const BadgeIndicator: React.FC<BadgeIndicatorProps> = ({
  config,
  state,
  queueSize,
  className,
}) => {
  const containerStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.full,
    backgroundColor: config.bgColor,
    fontSize: cssVars.fontSizes.xs,
  };

  const dotStyle: CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: config.dotColor,
    animation: config.animate ? 'pulse-sync 2s ease-in-out infinite' : 'none',
  };

  // Don't show badge if synced with no pending
  if (state === 'synced') {
    return null;
  }

  return (
    <span
      className={className}
      style={containerStyle}
      data-testid="sync-indicator-badge"
    >
      <span style={dotStyle} />
      {queueSize > 0 && <span>{queueSize}</span>}
      <style>{`
        @keyframes pulse-sync {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </span>
  );
};

// Bar variant - full status bar
interface BarIndicatorProps {
  config: {
    label: string;
    dotColor: string;
    textColor: string;
    bgColor: string;
    animate: boolean;
    icon: string;
  };
  state: string;
  lastSync: string;
  showSyncButton: boolean;
  canSync: boolean;
  onSyncClick: () => void;
  className?: string;
}

const BarIndicator: React.FC<BarIndicatorProps> = ({
  config,
  state,
  lastSync,
  showSyncButton,
  canSync,
  onSyncClick,
  className,
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    backgroundColor: config.bgColor,
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
    animation: config.animate ? 'pulse-sync 2s ease-in-out infinite' : 'none',
  };

  const labelStyle: CSSProperties = {
    color: config.textColor,
    fontWeight: cssVars.fontWeights.medium,
  };

  const timeStyle: CSSProperties = {
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.xs,
  };

  const buttonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    backgroundColor: canSync ? cssVars.colors.primary : 'transparent',
    color: canSync ? cssVars.colors.onPrimary : cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    cursor: canSync ? 'pointer' : 'default',
    opacity: canSync ? 1 : 0.5,
    transition: 'all 0.15s ease',
  };

  return (
    <div
      className={className}
      style={containerStyle}
      data-testid="sync-indicator-bar"
    >
      <div style={statusContainerStyle}>
        <span style={dotStyle} />
        <span style={labelStyle}>
          {config.icon} {config.label}
        </span>
        {lastSync && state === 'synced' && (
          <span style={timeStyle}>• {lastSync}</span>
        )}
      </div>

      {showSyncButton && (
        <button
          style={buttonStyle}
          onClick={onSyncClick}
          disabled={!canSync}
          title={canSync ? 'Jetzt synchronisieren' : 'Keine Änderungen'}
          data-testid="sync-now-btn"
        >
          Sync
        </button>
      )}

      <style>{`
        @keyframes pulse-sync {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        [data-testid="sync-now-btn"]:hover:not(:disabled) {
          filter: brightness(1.1);
        }
      `}</style>
    </div>
  );
};

export default SyncIndicator;
