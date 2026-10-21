/**
 * SyncFailedList - Liste gescheiterter Übertragungen (Dead-Letter-Queue)
 *
 * Zeigt je gescheitertem Eintrag den Grund (letzter Fehler) und bietet die
 * Aktionen "erneut versuchen" (sofort) und "verwerfen" (mit Rückfrage).
 * @FU-108 (Befund C-WIEDERHOLEN-NACH-KONFLIKT-ENDLOS): ein wegen eines Konflikts abgelehnter Eintrag (`conflict`)
 * zeigt den Konflikt-Hinweis und bietet statt "erneut versuchen" nur "Verwerfen und aktuellen Stand laden" an –
 * ein neuer Versuch schickte denselben veralteten Stand und scheiterte erneut.
 *
 * @see .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A4-brief.md (Teil 1, C-SYNC)
 */

import { CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { FailedMutationItem, MutationType } from '../../../core/services/MutationQueue';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useIsMobile } from '../../../hooks/useIsMobile';

export interface SyncFailedListProps {
    /** Failed mutations to show, newest last (dead-letter queue order) */
    items: FailedMutationItem[];
    /** Retry a single failed mutation (no confirmation) */
    onRetry: (id: string) => void;
    /** Discard a single failed mutation permanently (confirmed inside this component) */
    onDiscard: (id: string) => void;
    /** Close the list (e.g. click outside, Escape) */
    onClose: () => void;
}

const styles = {
    container: {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        zIndex: cssVars.zIndex.dropdown,
        width: 320,
        maxWidth: '90vw',
        maxHeight: 360,
        overflowY: 'auto',
        background: cssVars.colors.surfaceElevated,
        border: `1px solid ${cssVars.colors.border}`,
        borderRadius: cssVars.borderRadius.md,
        boxShadow: cssVars.shadows.lg,
        padding: cssVars.spacing.sm,
    } as CSSProperties,
    /** Schmaler Bildschirm: feste Lage mit Seitenrand statt rechtsbündig an der Anzeige. */
    narrow: {
        position: 'fixed',
        left: cssVars.spacing.md,
        right: cssVars.spacing.md,
        width: 'auto',
        maxWidth: 'none',
    } as CSSProperties,
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
        marginBottom: cssVars.spacing.xs,
    } as CSSProperties,
    title: {
        fontSize: cssVars.fontSizes.bodySm,
        fontWeight: cssVars.fontWeights.semibold,
        color: cssVars.colors.textPrimary,
    } as CSSProperties,
    closeButton: {
        background: 'transparent',
        border: 'none',
        color: cssVars.colors.textSecondary,
        cursor: 'pointer',
        minWidth: 44,
        minHeight: 44,
        fontSize: cssVars.fontSizes.md,
    } as CSSProperties,
    empty: {
        padding: cssVars.spacing.md,
        color: cssVars.colors.textMuted,
        fontSize: cssVars.fontSizes.bodySm,
        textAlign: 'center',
    } as CSSProperties,
    item: {
        display: 'flex',
        flexDirection: 'column',
        gap: cssVars.spacing.xs,
        padding: cssVars.spacing.sm,
        borderRadius: cssVars.borderRadius.sm,
        background: cssVars.colors.surfaceElevated,
        marginBottom: cssVars.spacing.xs,
    } as CSSProperties,
    itemType: {
        fontSize: cssVars.fontSizes.xs,
        fontWeight: cssVars.fontWeights.semibold,
        color: cssVars.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    } as CSSProperties,
    itemReason: {
        fontSize: cssVars.fontSizes.bodySm,
        color: cssVars.colors.error,
    } as CSSProperties,
    itemActions: {
        display: 'flex',
        gap: cssVars.spacing.sm,
        marginTop: cssVars.spacing.xs,
    } as CSSProperties,
    actionButton: {
        flex: 1,
        minHeight: 44,
        borderRadius: cssVars.borderRadius.sm,
        border: `1px solid ${cssVars.colors.borderControl}`,
        fontSize: cssVars.fontSizes.bodySm,
        fontWeight: cssVars.fontWeights.medium,
        cursor: 'pointer',
        background: 'transparent',
        color: cssVars.colors.textPrimary,
    } as CSSProperties,
    retryButton: {
        borderColor: cssVars.colors.primary,
        color: cssVars.colors.primary,
    } as CSSProperties,
    discardButton: {
        borderColor: cssVars.colors.error,
        color: cssVars.colors.error,
    } as CSSProperties,
};

/** @FU-108/@FU-109: ein neuer Versuch schickte denselben Stand und scheiterte erneut – nur Verwerfen hilft. */
const retryUseless = (item: FailedMutationItem): boolean => item.conflict === true || item.discardedCopy === true;

/** Grund je Eintrag: Konflikt mit anderem Gerät, verworfener Stand (eigener Text) oder der letzte Fehler. */
function reasonKey(item: FailedMutationItem): 'syncStatus.discardedCopyReason' | 'syncStatus.conflictReason' | null {
    if (item.discardedCopy) { return 'syncStatus.discardedCopyReason'; }
    return item.conflict ? 'syncStatus.conflictReason' : null;
}

export function SyncFailedList({ items, onRetry, onDiscard, onClose }: SyncFailedListProps) {
    const { t } = useTranslation('common');
    const [pendingDiscardId, setPendingDiscardId] = useState<string | null>(null);
    // Schmaler Bildschirm: die Anzeige sitzt mitten im Kopf, ein rechtsbündiges Popover liefe links aus dem Bild – dort
    // feste Lage über die Breite mit Seitenrand, oben direkt unter der Anzeige (Elternelement).
    const narrow = useIsMobile();
    const containerRef = useRef<HTMLDivElement>(null);
    const [narrowTop, setNarrowTop] = useState<number | null>(null);
    useLayoutEffect(() => {
        if (!narrow) { return; }
        setNarrowTop(containerRef.current?.parentElement?.getBoundingClientRect().bottom ?? 0);
    }, [narrow]);
    const containerStyle: CSSProperties = narrow
        ? { ...styles.container, ...styles.narrow, top: `calc(${narrowTop ?? 0}px + ${cssVars.spacing.sm})` }
        : styles.container;
    const reasonText = (item: FailedMutationItem): string => {
        const key = reasonKey(item);
        return key ? t(key) : (item.lastError ?? t('syncStatus.failedReasonUnknown'));
    };

    const mutationTypeLabel = (type: MutationType | string): string =>
        t(`syncStatus.mutationTypes.${type}`, { defaultValue: type });

    return (
        <div ref={containerRef} style={containerStyle} data-testid="sync-failed-list" role="dialog" aria-label={t('syncStatus.failedListTitle')}>
            <div style={styles.header}>
                <span style={styles.title}>{t('syncStatus.failedListTitle')}</span>
                <button
                    type="button"
                    style={styles.closeButton}
                    onClick={onClose}
                    aria-label={t('syncStatus.close')}
                >
                    ✕
                </button>
            </div>

            {items.length === 0 && (
                <div style={styles.empty}>{t('syncStatus.failedListEmpty')}</div>
            )}

            {items.map((item) => (
                <div style={styles.item} key={item.id}>
                    <span style={styles.itemType}>{mutationTypeLabel(item.type)}</span>
                    <span style={styles.itemReason} data-testid={`sync-failed-reason-${item.id}`}>
                        {reasonText(item)}
                    </span>
                    <div style={styles.itemActions}>
                        {!retryUseless(item) && (
                            <button
                                type="button"
                                style={{ ...styles.actionButton, ...styles.retryButton }}
                                onClick={() => onRetry(item.id)}
                                data-testid={`sync-retry-${item.id}`}
                                aria-label={t('syncStatus.retryAriaLabel')}
                            >
                                {t('syncStatus.retry')}
                            </button>
                        )}
                        <button
                            type="button"
                            style={{ ...styles.actionButton, ...styles.discardButton }}
                            onClick={() => setPendingDiscardId(item.id)}
                            data-testid={`sync-discard-${item.id}`}
                            aria-label={t(retryUseless(item) ? 'syncStatus.discardAndLoadAriaLabel' : 'syncStatus.discardAriaLabel')}
                        >
                            {t(retryUseless(item) ? 'syncStatus.discardAndLoad' : 'syncStatus.discard')}
                        </button>
                    </div>
                </div>
            ))}

            {pendingDiscardId && (
                <ConfirmDialog
                    title={t('syncStatus.discardConfirmTitle')}
                    message={t('syncStatus.discardConfirmMessage')} // @FU-106/@FU-107: ein Text für beide Fälle (Review Nachprüfung)
                    variant="danger"
                    confirmText={t('syncStatus.discard')}
                    onConfirm={() => {
                        onDiscard(pendingDiscardId);
                        setPendingDiscardId(null);
                    }}
                    onCancel={() => setPendingDiscardId(null)}
                />
            )}
        </div>
    );
}

export default SyncFailedList;
