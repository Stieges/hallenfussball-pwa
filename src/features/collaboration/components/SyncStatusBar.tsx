/**
 * SyncStatusBar - Visual indicator for synchronization status
 *
 * Shows the current sync status with:
 * - Icon indicating status (synced, syncing, offline, error, conflict)
 * - Optional text label
 * - Click to trigger manual sync
 *
 * @see docs/concepts/OFFLINE-KONZEPT.md Phase 2
 */

import { CSSProperties, useMemo } from 'react';
import { cssVars } from '../../../design-tokens';
import { SyncStatus } from '../../../core/repositories/OfflineRepository';

// =============================================================================
// TYPES
// =============================================================================

export interface SyncStatusBarProps {
    /** Current sync status */
    status: SyncStatus;
    /** Whether a sync operation is in progress */
    isSyncing?: boolean;
    /** Timestamp of last successful sync */
    lastSyncedAt?: string;
    /** Click handler for manual sync trigger */
    onSyncClick?: () => void;
    /** Show text label alongside icon */
    showLabel?: boolean;
    /** Compact mode (icon only) */
    compact?: boolean;
}

// =============================================================================
// STATUS CONFIG
// =============================================================================

interface StatusConfig {
    icon: string;
    label: string;
    color: string;
    bgColor: string;
}

const STATUS_CONFIG: Record<SyncStatus, StatusConfig> = {
    synced: {
        icon: '✓',
        label: 'Synchronisiert',
        color: cssVars.colors.success,
        bgColor: 'transparent',
    },
    updated: {
        icon: '↓',
        label: 'Aktualisiert',
        color: cssVars.colors.primary,
        bgColor: 'transparent',
    },
    conflict: {
        icon: '⚠',
        label: 'Konflikt',
        color: cssVars.colors.warning,
        bgColor: cssVars.colors.warningLight,
    },
    error: {
        icon: '✕',
        label: 'Fehler',
        color: cssVars.colors.error,
        bgColor: cssVars.colors.errorLight,
    },
    offline: {
        icon: '○',
        label: 'Offline',
        color: cssVars.colors.textMuted,
        bgColor: cssVars.colors.surfaceElevated,
    },
};

// =============================================================================
// STYLES
// =============================================================================

const createStyles = (config: StatusConfig, compact: boolean) => ({
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: cssVars.spacing.xs,
        padding: compact
            ? cssVars.spacing.xs
            : `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
        borderRadius: cssVars.borderRadius.md,
        background: config.bgColor,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        border: 'none',
        fontSize: cssVars.fontSizes.bodySm,
        minWidth: compact ? 32 : 'auto',
        minHeight: 32,
        justifyContent: 'center',
    } as CSSProperties,

    icon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        fontSize: cssVars.fontSizes.bodySm,
        color: config.color,
        fontWeight: cssVars.fontWeights.semibold,
    } as CSSProperties,

    spinningIcon: {
        animation: 'spin 1s linear infinite',
    } as CSSProperties,

    label: {
        color: config.color,
        fontWeight: cssVars.fontWeights.medium,
        whiteSpace: 'nowrap',
    } as CSSProperties,

    lastSync: {
        color: cssVars.colors.textMuted,
        fontSize: cssVars.fontSizes.xs,
        whiteSpace: 'nowrap',
    } as CSSProperties,
});

// =============================================================================
// HELPERS
// =============================================================================

function formatLastSync(timestamp?: string): string | null {
    if (!timestamp) {
        return null;
    }

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
        return 'Gerade eben';
    }
    if (diffMins < 60) {
        return `vor ${diffMins} Min.`;
    }

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
        return `vor ${diffHours} Std.`;
    }

    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SyncStatusBar({
    status,
    isSyncing = false,
    lastSyncedAt,
    onSyncClick,
    showLabel = false,
    compact = false,
}: SyncStatusBarProps) {
    const effectiveStatus: SyncStatus = isSyncing ? 'synced' : status;
    const config = STATUS_CONFIG[effectiveStatus];
    const styles = useMemo(() => createStyles(config, compact), [config, compact]);
    const lastSyncText = formatLastSync(lastSyncedAt);

    const handleClick = () => {
        if (onSyncClick && !isSyncing) {
            onSyncClick();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && onSyncClick && !isSyncing) {
            e.preventDefault();
            onSyncClick();
        }
    };

    return (
        <>
            <button
                style={styles.container}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onMouseEnter={(e) => {
                    if (!isSyncing) {
                        e.currentTarget.style.background = cssVars.colors.surfaceHover;
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = config.bgColor;
                }}
                disabled={isSyncing}
                aria-label={isSyncing ? 'Wird synchronisiert...' : config.label}
                title={isSyncing
                    ? 'Wird synchronisiert...'
                    : `${config.label}${lastSyncText ? ` - ${lastSyncText}` : ''}`
                }
            >
                <span
                    style={{
                        ...styles.icon,
                        ...(isSyncing ? styles.spinningIcon : {}),
                    }}
                >
                    {isSyncing ? '↻' : config.icon}
                </span>

                {showLabel && !compact && (
                    <span style={styles.label}>
                        {isSyncing ? 'Synchronisiere...' : config.label}
                    </span>
                )}

                {!compact && lastSyncText && !isSyncing && status === 'synced' && (
                    <span style={styles.lastSync}>
                        {lastSyncText}
                    </span>
                )}
            </button>

            {/* CSS Animation for spinning icon */}
            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}

export default SyncStatusBar;
