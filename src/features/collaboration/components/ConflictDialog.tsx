/**
 * ConflictDialog - Dialog for resolving sync conflicts
 *
 * Shows conflicts between local and remote versions and allows users
 * to choose which version to keep. Supports batch resolution and
 * individual conflict handling.
 *
 * @see docs/concepts/OFFLINE-KONZEPT.md Phase 3
 */

import { useState, CSSProperties, useCallback } from 'react';
import { Dialog } from '../../../components/dialogs/Dialog';
import { Button } from '../../../components/ui/Button';
import { cssVars } from '../../../design-tokens';
import { SyncConflict } from '../../../core/repositories/OfflineRepository';

// =============================================================================
// TYPES
// =============================================================================

export interface ConflictDialogProps {
    /** Whether the dialog is open */
    isOpen: boolean;
    /** Close handler */
    onClose: () => void;
    /** Array of conflicts to resolve */
    conflicts: SyncConflict[];
    /** Handler when user chooses to keep local version */
    onResolveLocal: () => void;
    /** Handler when user chooses to keep remote version */
    onResolveRemote: () => void;
    /** Tournament name for context */
    tournamentName?: string;
    /** Whether resolution is in progress */
    isResolving?: boolean;
}

// =============================================================================
// STYLES
// =============================================================================

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: cssVars.spacing.lg,
    } as CSSProperties,

    header: {
        display: 'flex',
        alignItems: 'center',
        gap: cssVars.spacing.sm,
        padding: cssVars.spacing.md,
        background: cssVars.colors.warningLight,
        borderRadius: cssVars.borderRadius.md,
        border: `1px solid ${cssVars.colors.warningBorder}`,
    } as CSSProperties,

    headerIcon: {
        fontSize: '1.5rem',
    } as CSSProperties,

    headerText: {
        flex: 1,
    } as CSSProperties,

    headerTitle: {
        fontSize: cssVars.fontSizes.titleSm,
        fontWeight: cssVars.fontWeights.semibold,
        color: cssVars.colors.warning,
        marginBottom: cssVars.spacing.xs,
    } as CSSProperties,

    headerDescription: {
        fontSize: cssVars.fontSizes.bodySm,
        color: cssVars.colors.textSecondary,
    } as CSSProperties,

    conflictList: {
        display: 'flex',
        flexDirection: 'column',
        gap: cssVars.spacing.md,
        maxHeight: '300px',
        overflowY: 'auto',
    } as CSSProperties,

    conflictItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: cssVars.spacing.sm,
        padding: cssVars.spacing.md,
        background: cssVars.colors.surface,
        borderRadius: cssVars.borderRadius.md,
        border: `1px solid ${cssVars.colors.border}`,
    } as CSSProperties,

    conflictHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    } as CSSProperties,

    conflictName: {
        fontSize: cssVars.fontSizes.bodyMd,
        fontWeight: cssVars.fontWeights.medium,
        color: cssVars.colors.textPrimary,
    } as CSSProperties,

    conflictField: {
        fontSize: cssVars.fontSizes.bodySm,
        color: cssVars.colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    } as CSSProperties,

    conflictValues: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: cssVars.spacing.md,
    } as CSSProperties,

    valueBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: cssVars.spacing.xs,
        padding: cssVars.spacing.sm,
        borderRadius: cssVars.borderRadius.sm,
    } as CSSProperties,

    localValueBox: {
        background: cssVars.colors.primaryLight,
        border: `1px solid ${cssVars.colors.primary}`,
    } as CSSProperties,

    remoteValueBox: {
        background: cssVars.colors.surfaceElevated,
        border: `1px solid ${cssVars.colors.border}`,
    } as CSSProperties,

    valueLabel: {
        fontSize: cssVars.fontSizes.xs,
        fontWeight: cssVars.fontWeights.medium,
        color: cssVars.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    } as CSSProperties,

    valueText: {
        fontSize: cssVars.fontSizes.titleMd,
        fontWeight: cssVars.fontWeights.bold,
        color: cssVars.colors.textPrimary,
        fontFamily: cssVars.fontFamilies.mono,
    } as CSSProperties,

    valueTimestamp: {
        fontSize: cssVars.fontSizes.xs,
        color: cssVars.colors.textMuted,
    } as CSSProperties,

    actions: {
        display: 'flex',
        flexDirection: 'column',
        gap: cssVars.spacing.sm,
    } as CSSProperties,

    actionButtons: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: cssVars.spacing.md,
    } as CSSProperties,

    helpText: {
        fontSize: cssVars.fontSizes.bodySm,
        color: cssVars.colors.textSecondary,
        textAlign: 'center',
        padding: cssVars.spacing.md,
        background: cssVars.colors.surface,
        borderRadius: cssVars.borderRadius.sm,
    } as CSSProperties,
} as const;

// =============================================================================
// HELPERS
// =============================================================================

function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function formatValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '-';
    }
    return String(value);
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ConflictDialog({
    isOpen,
    onClose,
    conflicts,
    onResolveLocal,
    onResolveRemote,
    tournamentName,
    isResolving = false,
}: ConflictDialogProps) {
    const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | null>(null);

    const handleResolve = useCallback(() => {
        if (selectedResolution === 'local') {
            onResolveLocal();
        } else if (selectedResolution === 'remote') {
            onResolveRemote();
        }
    }, [selectedResolution, onResolveLocal, onResolveRemote]);

    const handleLocalClick = useCallback(() => {
        setSelectedResolution('local');
    }, []);

    const handleRemoteClick = useCallback(() => {
        setSelectedResolution('remote');
    }, []);

    const conflictCount = conflicts.length;

    return (
        <Dialog
            isOpen={isOpen}
            onClose={onClose}
            title="Sync-Konflikt"
            maxWidth="560px"
        >
            <div style={styles.container}>
                {/* Warning Header */}
                <div style={styles.header}>
                    <span style={styles.headerIcon}>⚠️</span>
                    <div style={styles.headerText}>
                        <div style={styles.headerTitle}>
                            {conflictCount} {conflictCount === 1 ? 'Konflikt' : 'Konflikte'} gefunden
                        </div>
                        <div style={styles.headerDescription}>
                            {tournamentName && <><strong>{tournamentName}</strong> - </>}
                            Die lokalen und Cloud-Daten unterscheiden sich.
                            Wähle, welche Version behalten werden soll.
                        </div>
                    </div>
                </div>

                {/* Conflict List */}
                <div style={styles.conflictList}>
                    {conflicts.map((conflict) => (
                        <div key={conflict.id} style={styles.conflictItem}>
                            <div style={styles.conflictHeader}>
                                <span style={styles.conflictName}>
                                    {conflict.entityName}
                                </span>
                                <span style={styles.conflictField}>
                                    {conflict.field}
                                </span>
                            </div>

                            <div style={styles.conflictValues}>
                                {/* Local Value */}
                                <div
                                    style={{
                                        ...styles.valueBox,
                                        ...styles.localValueBox,
                                        ...(selectedResolution === 'local' ? {
                                            borderWidth: '2px',
                                            boxShadow: `0 0 0 2px ${cssVars.colors.primaryLight}`,
                                        } : {}),
                                    }}
                                    onClick={handleLocalClick}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && handleLocalClick()}
                                >
                                    <span style={styles.valueLabel}>Lokal (Dein Gerät)</span>
                                    <span style={styles.valueText}>
                                        {formatValue(conflict.localValue)}
                                    </span>
                                    <span style={styles.valueTimestamp}>
                                        {formatTimestamp(conflict.localTimestamp)}
                                    </span>
                                </div>

                                {/* Remote Value */}
                                <div
                                    style={{
                                        ...styles.valueBox,
                                        ...styles.remoteValueBox,
                                        ...(selectedResolution === 'remote' ? {
                                            borderWidth: '2px',
                                            borderColor: cssVars.colors.textSecondary,
                                            boxShadow: `0 0 0 2px ${cssVars.colors.surfaceElevated}`,
                                        } : {}),
                                    }}
                                    onClick={handleRemoteClick}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRemoteClick()}
                                >
                                    <span style={styles.valueLabel}>
                                        Cloud {conflict.remoteUser ? `(${conflict.remoteUser})` : ''}
                                    </span>
                                    <span style={styles.valueText}>
                                        {formatValue(conflict.remoteValue)}
                                    </span>
                                    <span style={styles.valueTimestamp}>
                                        {formatTimestamp(conflict.remoteTimestamp)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Help Text */}
                <p style={styles.helpText}>
                    Klicke auf eine Version um sie auszuwählen, dann bestätige deine Wahl.
                </p>

                {/* Action Buttons */}
                <div style={styles.actions}>
                    <div style={styles.actionButtons}>
                        <Button
                            variant={selectedResolution === 'local' ? 'primary' : 'secondary'}
                            onClick={() => {
                                setSelectedResolution('local');
                            }}
                            disabled={isResolving}
                        >
                            Lokal behalten
                        </Button>
                        <Button
                            variant={selectedResolution === 'remote' ? 'primary' : 'secondary'}
                            onClick={() => {
                                setSelectedResolution('remote');
                            }}
                            disabled={isResolving}
                        >
                            Cloud übernehmen
                        </Button>
                    </div>

                    {selectedResolution && (
                        <Button
                            variant="primary"
                            onClick={handleResolve}
                            disabled={isResolving}
                            fullWidth
                        >
                            {isResolving ? 'Wird gespeichert...' : 'Bestätigen'}
                        </Button>
                    )}
                </div>
            </div>
        </Dialog>
    );
}

export default ConflictDialog;
