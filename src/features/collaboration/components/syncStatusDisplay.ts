/**
 * Anzeige-Konfiguration und Wartegrund fuer SyncStatusBar (A-06i, Brief A10).
 *
 * STATUS_CONFIG / LABEL_KEY_BY_STATUS wurden aus SyncStatusBar.tsx hierher verschoben,
 * damit die Bar schlank bleibt (Obergrenze 430 Zeilen).
 */

import { cssVars } from '../../../design-tokens';
import type { SyncStatus } from '../../../core/repositories/OfflineRepository';
import type { OutboxStatus } from '../../../core/match/client/outboxTypes';

// =============================================================================
// TYPES
// =============================================================================

export interface StatusConfig {
    icon: string;
    color: string;
    bgColor: string;
}

/** Wartegrund: 'noInternet' = Verbindung fehlt/voruebergehend, 'disturbed' = Server-Problem. */
export type WaitReason = 'noInternet' | 'disturbed';

/** Fehlerklasse des letzten Versuchs der MutationQueue (`getLastFailure()`). */
export type QueueFailure = 'transient' | 'permanent' | null | undefined;

// =============================================================================
// CONFIG
// =============================================================================

// Fixrunde 1 (Review I2): nur Icon/Farbe sind statisch (React-Hook-frei, module-level) --
// der Label-TEXT kommt aus i18n (LABEL_KEY_BY_STATUS, im Component-Body ueber useTranslation).
export const STATUS_CONFIG: Record<SyncStatus, StatusConfig> = {
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

export const LABEL_KEY_BY_STATUS: Record<SyncStatus, string> = {
    synced: 'syncStatus.label.synced',
    updated: 'syncStatus.label.updated',
    conflict: 'syncStatus.label.conflict',
    error: 'syncStatus.label.error',
    offline: 'syncStatus.label.offline',
};

/** Darstellung fuer noch wartende Eintraege ohne Konflikt/Fehler (A-06i). */
export const WAITING_CONFIG: StatusConfig = {
    icon: '↑',
    color: cssVars.colors.warning,
    bgColor: cssVars.colors.warningLight,
};

// =============================================================================
// WARTEGRUND
// =============================================================================

/**
 * Leitet aus Status, Outbox-Fehlerklasse und Queue-Fehlerklasse ab, warum Eintraege warten.
 * Reihenfolge der Regeln ist verbindlich (Brief A10):
 * 1. keine wartenden Eintraege -> null
 * 2. status offline oder irgendein 'transient' (auch gemischt mit 'permanent') -> 'noInternet'
 * 3. outboxKind 'permanent' oder queueFailure 'permanent' -> 'disturbed'
 * 4. sonst null
 */
export function deriveWaitReason(input: {
    pendingCount: number;
    status: SyncStatus;
    outboxKind: OutboxStatus['lastFailureKind'];
    queueFailure: QueueFailure;
}): WaitReason | null {
    const { pendingCount, status, outboxKind, queueFailure } = input;
    if (pendingCount === 0) {
        return null;
    }
    if (status === 'offline' || outboxKind === 'transient' || queueFailure === 'transient') {
        return 'noInternet';
    }
    if (outboxKind === 'permanent' || queueFailure === 'permanent') {
        return 'disturbed';
    }
    return null;
}
