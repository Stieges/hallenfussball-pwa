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
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { SyncStatusBar } from './SyncStatusBar';
import { SyncFailedList } from './SyncFailedList';

export interface SyncStatusIndicatorProps {
    /** Tournament to sync when clicked (no-op if omitted) */
    tournamentId?: string;
    /** Compact mode (icon only, no label) — default true for header use */
    compact?: boolean;
}

const containerStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
};

export function SyncStatusIndicator({ tournamentId, compact = true }: SyncStatusIndicatorProps) {
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
    } = useSyncStatus();

    const [showFailedList, setShowFailedList] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Click/touch outside closes the failed-list popover. Not useClickOutside() here: that hook's
    // RefObject<T> (non-nullable current) doesn't accept the RefObject<T | null> a DOM useRef
    // actually produces (React 19 types) -- a pre-existing mismatch, out of scope to fix here.
    useEffect(() => {
        if (!showFailedList) {
            return;
        }
        const handler = (event: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowFailedList(false);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [showFailedList]);

    const handleClick = () => {
        if (failedChanges > 0) {
            setShowFailedList((prev) => !prev);
            return;
        }
        if (tournamentId) {
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
                pendingCount={pendingChanges}
                failedCount={failedChanges}
                onSyncClick={handleClick}
                compact={compact}
            />

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
