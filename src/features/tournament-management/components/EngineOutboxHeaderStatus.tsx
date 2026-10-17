/**
 * EngineOutboxHeaderStatus (A-08f3e3, M-1): Übertragungsstatus und nicht übernommene Einträge im Kopf der
 * Turnierverwaltung -- für alle Tabs, also auch im Spielplan. Muster `AdminHeader.tsx` (SyncStatusIndicator +
 * RejectedOutboxDialog). Szenarien: @FU-002 („1 Eintrag wartet“), @FU-004 (Ablehnung sichtbar mit Grund).
 */
import { useToast } from '../../../components/ui/Toast';
import { SyncStatusIndicator } from '../../collaboration/components/SyncStatusIndicator';
import { RejectedOutboxDialog } from '../../collaboration/outbox/RejectedOutboxDialog';
import { useRejectedOutboxDialog } from '../../collaboration/outbox/useRejectedOutboxDialog';

export function EngineOutboxHeaderStatus({ tournamentId }: { tournamentId: string }) {
  const { showError } = useToast();
  const rejectedOutbox = useRejectedOutboxDialog(tournamentId, showError);
  return (
    <>
      <SyncStatusIndicator
        tournamentId={tournamentId}
        compact
        rejectedCount={rejectedOutbox.rejectedCount}
        reviewCount={rejectedOutbox.reviewCount}
        onShowRejected={rejectedOutbox.show}
        enginePendingCount={rejectedOutbox.pendingCount}
      />
      <RejectedOutboxDialog
        isOpen={rejectedOutbox.isOpen}
        onClose={rejectedOutbox.close}
        entries={rejectedOutbox.entries}
        onDismiss={rejectedOutbox.handleDismiss}
      />
    </>
  );
}
