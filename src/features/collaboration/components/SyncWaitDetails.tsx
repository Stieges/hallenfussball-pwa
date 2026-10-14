/**
 * SyncWaitDetails - Detail-Feld zu wartenden Eintraegen (A-06j, Entscheidung E1)
 *
 * Erscheint im kompakten Indikator, wenn man ihn antippt: Klartext zum Wartegrund
 * ("kein Internet" bzw. "Übertragung gestört") plus letzter Fehlertext bei Problemen.
 * Schliessen per Klick ausserhalb (Logik im SyncStatusIndicator, wie bei SyncFailedList).
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { WaitReason } from './syncStatusDisplay';

export interface SyncWaitDetailsProps {
    /** Anzahl wartender Eintraege (> 0) */
    pendingCount: number;
    /** Wartegrund; null = neutraler Text ohne Ursache */
    waitReason: WaitReason | null;
    /** Letzter Fehlertext (nur bei 'disturbed' angezeigt) */
    detail?: string;
}

const styles = {
    container: {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        zIndex: cssVars.zIndex.dropdown,
        maxWidth: '90vw',
        background: cssVars.colors.surface,
        border: `1px solid ${cssVars.colors.border}`,
        borderRadius: cssVars.borderRadius.md,
        boxShadow: cssVars.shadows.lg,
        padding: cssVars.spacing.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: cssVars.spacing.xs,
    } as CSSProperties,
    summary: {
        fontSize: cssVars.fontSizes.bodySm,
        fontWeight: cssVars.fontWeights.semibold,
        color: cssVars.colors.textPrimary,
    } as CSSProperties,
    detail: {
        fontSize: cssVars.fontSizes.bodySm,
        color: cssVars.colors.warning,
        wordBreak: 'break-word',
    } as CSSProperties,
} as const;

export function SyncWaitDetails({ pendingCount, waitReason, detail }: SyncWaitDetailsProps) {
    const { t } = useTranslation('common');
    const summary = String(
        waitReason === 'noInternet'
            ? t('syncStatus.waitingNoInternet', { count: pendingCount })
            : waitReason === 'disturbed'
                ? t('syncStatus.waitingDisturbed', { count: pendingCount })
                : waitReason === 'storageFull'
                    ? t('syncStatus.waitingStorageFull')
                    : t('syncStatus.waiting', { count: pendingCount }),
    );
    const showDetail = waitReason === 'disturbed' && Boolean(detail);

    return (
        <div data-testid="sync-wait-details" role="status" style={styles.container}>
            <span style={styles.summary}>{summary}</span>
            {showDetail && <span style={styles.detail}>{detail}</span>}
        </div>
    );
}

export default SyncWaitDetails;
