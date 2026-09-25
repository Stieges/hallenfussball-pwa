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
import { useTranslation } from 'react-i18next';
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
    /** Number of pending changes waiting to sync */
    pendingCount?: number;
    /** Number of failed mutations in dead-letter queue */
    failedCount?: number;
}

// =============================================================================
// STATUS CONFIG
// =============================================================================

// Fixrunde 1 (Review I2): nur Icon/Farbe sind statisch (React-Hook-frei, module-level) --
// der Label-TEXT kommt jetzt aus i18n (siehe LABEL_KEY_BY_STATUS unten, im Component-Body
// über useTranslation aufgelöst). Vorher stand hier "Synchronisiert"/"Fehler"/... hartkodiert.
interface StatusConfig {
    icon: string;
    color: string;
    bgColor: string;
}

const STATUS_CONFIG: Record<SyncStatus, StatusConfig> = {
    synced: {
        icon: '✓',
        color: cssVars.colors.success,
        bgColor: 'transparent',
    },
    updated: {
        icon: '↓',
        color: cssVars.colors.primary,
        bgColor: 'transparent',
    },
    conflict: {
        icon: '⚠',
        color: cssVars.colors.warning,
        bgColor: cssVars.colors.warningLight,
    },
    error: {
        icon: '✕',
        color: cssVars.colors.error,
        bgColor: cssVars.colors.errorLight,
    },
    offline: {
        icon: '○',
        color: cssVars.colors.textMuted,
        bgColor: cssVars.colors.surfaceElevated,
    },
};

const LABEL_KEY_BY_STATUS: Record<SyncStatus, string> = {
    synced: 'syncStatus.label.synced',
    updated: 'syncStatus.label.updated',
    conflict: 'syncStatus.label.conflict',
    error: 'syncStatus.label.error',
    offline: 'syncStatus.label.offline',
};

// =============================================================================
// STYLES
// =============================================================================

const createStyles = (config: StatusConfig, compact: boolean) => ({
    container: {
        position: 'relative',
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
        // Fixrunde 1 (Review I1): war 32px -- dieser Knopf ist jetzt der einzige Zugang zur
        // Fehlerliste (SyncFailedList), Touch-Target-Mindestmaß (WCAG 2.5.5) gilt daher.
        minWidth: cssVars.touchTargets.minimum,
        minHeight: cssVars.touchTargets.minimum,
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

    // Fixrunde 1 (Review C1): kleines Zahlen-Badge, sichtbar auch im Kompaktmodus (beide echten
    // Aufrufstellen -- AdminHeader, LiveCockpit -- nutzen compact). Vorher blendete `!compact` die
    // Anzahl komplett aus, im Kompaktmodus war weder "wartet" noch "gescheitert" sichtbar.
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: cssVars.borderRadius.full,
        fontSize: cssVars.fontSizes.labelSm,
        fontWeight: cssVars.fontWeights.semibold,
        lineHeight: 1,
    } as CSSProperties,
});

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
    pendingCount = 0,
    failedCount = 0,
}: SyncStatusBarProps) {
    const { t } = useTranslation('common');
    const hasPending = pendingCount > 0;
    const hasFailed = failedCount > 0;

    // Fixrunde 1 (Review C1): `failedCount > 0` muss die DARSTELLUNG selbst umschalten (Symbol,
    // Farbe, Hintergrund), nicht nur `data-state` (siehe testState unten). Vorher blieb
    // `effectiveStatus` bei `status` stehen, `useSyncStatus()` setzt `status` aber nie auf
    // 'error', wenn die MutationQueue passiv dead-lettert -- ein gescheiterter Eintrag zeigte
    // weiterhin ein grünes "✓".
    const effectiveStatus: SyncStatus = isSyncing ? 'synced' : hasFailed ? 'error' : status;
    const config = STATUS_CONFIG[effectiveStatus];
    const label = String(t(LABEL_KEY_BY_STATUS[effectiveStatus], { defaultValue: LABEL_KEY_BY_STATUS[effectiveStatus] }));
    const styles = useMemo(() => createStyles(config, compact), [config, compact]);

    function formatLastSync(timestamp?: string): string | null {
        if (!timestamp) {
            return null;
        }

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) {
            return t('syncStatus.lastSyncNow');
        }
        if (diffMins < 60) {
            return t('syncStatus.lastSyncMinutes', { count: diffMins });
        }

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) {
            return t('syncStatus.lastSyncHours', { count: diffHours });
        }

        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    const lastSyncText = formatLastSync(lastSyncedAt);

    // Test-Zustand (Task T3, data-state auf data-testid="sync-status"): bewusst eigenes,
    // schmaleres Vokabular ("idle" | "syncing" | "offline" | "error") statt des internen
    // `SyncStatus`-Unions -- E2E-Tests (tests/e2e/cloud/helpers.ts#waitForSync) sollen nicht an
    // die visuelle Unterscheidung "synced" vs. "updated" gekoppelt sein. "conflict" zählt hier
    // als "error" (erfordert genau wie ein Fehler eine Nutzeraktion, bevor sync wieder ruht).
    //
    // Fixrunde 1 (Review C1): dieses Attribut allein war NIE ausreichend, es ist ein
    // maschinenlesbares Zusatzsignal für E2E -- die eigentliche Anforderung ("deutlich bei
    // gescheiterten Einträgen") erfüllt jetzt `effectiveStatus`/`config` oben (sichtbares Symbol,
    // Farbe, Hintergrund) UND das Badge unten, nicht dieses Attribut.
    const testState: 'idle' | 'syncing' | 'offline' | 'error' = isSyncing
        ? 'syncing'
        : hasFailed
            ? 'error'
            : status === 'offline'
                ? 'offline'
                : status === 'error' || status === 'conflict'
                    ? 'error'
                    : 'idle';

    // Badge-Zahl: Fehler haben Vorrang vor wartenden Einträgen (dieselbe Priorität wie beim
    // Klick-Verhalten in SyncStatusIndicator -- ein Fehler verlangt zuerst eine Entscheidung).
    const badgeCount = hasFailed ? failedCount : hasPending ? pendingCount : null;

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

    const pendingSuffix = hasPending ? ` - ${String(t('syncStatus.pendingCountLabel', { count: pendingCount }))}` : '';
    const failedSuffix = hasFailed ? ` - ${String(t('syncStatus.failedCountLabel', { count: failedCount }))}` : '';
    const lastSyncSuffix = lastSyncText && !hasPending && !hasFailed ? ` - ${lastSyncText}` : '';

    const ariaLabel = isSyncing ? t('syncStatus.syncingAriaLabel') : label;
    const title = isSyncing
        ? t('syncStatus.syncingAriaLabel')
        : `${label}${pendingSuffix}${failedSuffix}${lastSyncSuffix}`;

    return (
        <>
            <button
                data-testid="sync-status"
                data-state={testState}
                data-pending={pendingCount}
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
                aria-label={ariaLabel}
                title={title}
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
                        {isSyncing ? t('syncStatus.syncingLabel') : label}
                    </span>
                )}

                {/* Show pending count if any */}
                {!compact && hasPending && !isSyncing && (
                    <span style={{
                        ...styles.label,
                        color: cssVars.colors.warning,
                        fontSize: cssVars.fontSizes.xs,
                    }}>
                        ({t('syncStatus.pendingCountLabel', { count: pendingCount })})
                    </span>
                )}

                {/* Show failed count if any */}
                {!compact && hasFailed && !isSyncing && (
                    <span style={{
                        ...styles.label,
                        color: cssVars.colors.error,
                        fontSize: cssVars.fontSizes.xs,
                    }}>
                        ({t('syncStatus.failedCountLabel', { count: failedCount })})
                    </span>
                )}

                {!compact && lastSyncText && !isSyncing && status === 'synced' && !hasPending && !hasFailed && (
                    <span style={styles.lastSync}>
                        {lastSyncText}
                    </span>
                )}

                {/* Fixrunde 1 (Review C1): sichtbares Badge, auch im Kompaktmodus. */}
                {compact && badgeCount !== null && !isSyncing && (
                    <span
                        data-testid="sync-status-badge"
                        style={{
                            ...styles.badge,
                            background: hasFailed ? cssVars.colors.error : cssVars.colors.warning,
                            color: hasFailed ? cssVars.colors.onError : cssVars.colors.onWarning,
                        }}
                        aria-hidden="true"
                    >
                        {badgeCount}
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
