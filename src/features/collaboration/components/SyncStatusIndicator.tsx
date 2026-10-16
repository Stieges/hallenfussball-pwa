/**
 * SyncStatusIndicator - Übertragungsstatus im Admin- und Cockpit-Kopf (C-SYNC)
 *
 * Kombiniert SyncStatusBar (ruhig/wartend/deutlich-gescheitert) mit der
 * aufklappbaren Liste gescheiterter Übertragungen (SyncFailedList,
 * retry/verwerfen). Ein Baustein für beide Aufrufstellen statt Duplikation.
 *
 * @see .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A4-brief.md (Teil 1, C-SYNC)
 */

import { CSSProperties, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { isRealtimeInterrupted, useRealtimeChannelStatus } from '../../../hooks/realtimeChannelStatus';
import { useResyncNow } from '../../match-engine/useResyncNow';
import { useMatchEngineContextOptional } from '../../match-engine/useMatchEngineContext';
import { useOutboxStatus } from '../outbox/useOutboxStatus';
import { SyncStatusBar } from './SyncStatusBar';
import { SyncFailedList } from './SyncFailedList';
import { SyncWaitDetails } from './SyncWaitDetails';
import { deriveWaitReason } from './syncStatusDisplay';

export interface SyncStatusIndicatorProps {
    /** Tournament to sync when clicked (no-op if omitted) */
    tournamentId?: string;
    /** Compact mode (icon only, no label) — default true for header use */
    compact?: boolean;
    /** C2b: nur Durchreichung an die SyncStatusBar, die Datenquelle verdrahtet C3a */
    rejectedCount?: number;
    reviewCount?: number;
    onShowRejected?: () => void;
    /** W1 (C3a-2a Fixrunde 2, Re-Review-Befund C2): Engine-Ausgang (`useEngineOutboxSummary`,
     * turniergenau) -- wird zur MutationQueue-Zaehlung (`pendingChanges`) ADDIERT, kein eigener
     * UI-Umbau (`SyncStatusBar.pendingCount` kennt den Slot bereits). */
    enginePendingCount?: number;
}

const containerStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
};

// A-06k (@FU-025): sichtbarer Hinweis, solange der Realtime-Kanal unterbrochen ist.
const realtimeHintStyle: CSSProperties = {
    alignSelf: 'center',
    marginLeft: cssVars.spacing.xs,
    color: cssVars.colors.warning,
    fontSize: cssVars.fontSizes.bodySm,
    whiteSpace: 'nowrap',
};

export function SyncStatusIndicator({
    tournamentId,
    compact = true,
    rejectedCount = 0,
    reviewCount = 0,
    onShowRejected,
    enginePendingCount = 0,
}: SyncStatusIndicatorProps) {
    const {
        status,
        isSyncing,
        lastSyncedAt,
        pendingChanges,
        failedChanges,
        failedMutations,
        syncTournament,
        retryFailedMutation,
        discardFailedMutation,
        isCloudSyncAvailable,
        queueLastFailure,
    } = useSyncStatus();
    // A-06j (Brief A10): echter Ausgangs-Status des Senders (lastFailureKind/lastError) und die
    // Queue-Fehlerklasse ergeben zusammen den Wartegrund fuer die Bar.
    const outbox = useOutboxStatus(useMatchEngineContextOptional()?.sender ?? null);
    const waitingCount = pendingChanges + enginePendingCount;
    const waitReason = deriveWaitReason({
        pendingCount: waitingCount,
        status,
        outboxKind: outbox.lastFailureKind,
        queueFailure: queueLastFailure,
    });
    // A-06h (Brief A9): Klick stoesst IMMER die Uebertragung an (resyncNow), auch bei
    // pendingChanges > 0 (@FU-013 "sobald frei, alle uebertragen"). Oben bei den anderen Hooks.
    const resyncNow = useResyncNow();
    // A-06k (@FU-025): Kanal-Zustand des Turniers (CLOSED/CHANNEL_ERROR/TIMED_OUT = unterbrochen).
    const { t } = useTranslation('common');
    const realtimeInterrupted = isRealtimeInterrupted(useRealtimeChannelStatus(tournamentId));

    const [showFailedList, setShowFailedList] = useState(false);
    // A-06j (E1): Antippen im kompakten Modus zeigt den Wartegrund mit Details.
    const [showWaitDetails, setShowWaitDetails] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // A-06j Fixrunde 1: der gemerkte Offen-Zustand gilt nur, solange etwas wartet und nichts
    // fehlgeschlagen ist. Sonst wuerde das Feld beim naechsten Warten ungefragt wieder aufspringen.
    useEffect(() => {
        if (waitingCount === 0 || failedChanges > 0) {
            setShowWaitDetails(false);
        }
    }, [waitingCount, failedChanges]);

    // Click/touch outside closes the failed-list popover. Not useClickOutside() here: that hook's
    // RefObject<T> (non-nullable current) doesn't accept the RefObject<T | null> a DOM useRef
    // actually produces (React 19 types) -- a pre-existing mismatch, out of scope to fix here.
    const anyPopoverOpen = showFailedList || showWaitDetails;
    useEffect(() => {
        if (!anyPopoverOpen) {
            return;
        }
        const handler = (event: MouseEvent | TouchEvent) => {
            // Ein Dialog aus dem Popover (Rückfrage „Verwerfen“) liegt im Portal von DialogSurface (B-43a) –
            // ein Klick darin ist kein Klick außerhalb, sonst schließt die Liste vor dem Bestätigen.
            if (event.target instanceof Element && event.target.closest('.dialog-surface-scrim')) {
                return;
            }
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowFailedList(false);
                setShowWaitDetails(false);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [anyPopoverOpen]);

    const handleClick = () => {
        void resyncNow();
        if (failedChanges > 0) {
            setShowFailedList((prev) => !prev);
            return;
        }
        if (compact && waitingCount > 0) {
            setShowWaitDetails((prev) => !prev);
        }
        if (pendingChanges === 0 && tournamentId) {
            void syncTournament(tournamentId);
        }
    };

    // Gilt nur im Cloud-Modus (angemeldet, kein lokaler Gast) — Gast/offline-only zeigt nichts
    // (siehe isCloudSyncAvailable-Doku in useSyncStatus). Nach den Hooks, damit die Hook-Reihenfolge
    // stabil bleibt, auch wenn sich isCloudSyncAvailable zur Laufzeit ändert (z.B. Login/Logout).
    if (!isCloudSyncAvailable) {
        return null;
    }

    return (
        <div style={containerStyle} ref={containerRef}>
            <SyncStatusBar
                status={status}
                isSyncing={isSyncing}
                lastSyncedAt={lastSyncedAt}
                pendingCount={waitingCount}
                failedCount={failedChanges}
                onSyncClick={handleClick}
                compact={compact}
                rejectedCount={rejectedCount}
                reviewCount={reviewCount}
                onShowRejected={onShowRejected}
                waitReason={waitReason}
                waitDetail={outbox.lastError ?? undefined}
            />

            {realtimeInterrupted && (
                <span style={realtimeHintStyle} role="status" data-testid="realtime-interrupted-hint">
                    {t('syncStatus.realtimeInterrupted')}
                </span>
            )}

            {compact && showWaitDetails && failedChanges === 0 && waitingCount > 0 && (
                <SyncWaitDetails pendingCount={waitingCount} waitReason={waitReason} detail={outbox.lastError ?? undefined} />
            )}

            {showFailedList && (
                <SyncFailedList
                    items={failedMutations}
                    onRetry={retryFailedMutation}
                    onDiscard={discardFailedMutation}
                    onClose={() => setShowFailedList(false)}
                />
            )}
        </div>
    );
}

export default SyncStatusIndicator;
