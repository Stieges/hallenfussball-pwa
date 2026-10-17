/**
 * RejectedOutboxDialog (C3a-2a Fixrunde 3, P8/W11): die Anzeige zu `useRejectedOutboxDialog` --
 * Dialog mit `RejectedEntriesPanel`, aus `LiveCockpit.tsx` und `AdminHeader.tsx` ausgelagert
 * (dort Wort fuer Wort doppelt).
 */
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../../components/dialogs/Dialog';
import { RejectedEntriesPanel } from './RejectedEntriesPanel';
import type { EngineRejectedEntry } from '../../match-engine/useEngineOutboxSummary';
import type { EventMatch } from './rejectionText';

export interface RejectedOutboxDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entries: EngineRejectedEntry[];
  onDismiss: (ids: string[]) => void;
  /** A-08f3e2 Fixrunde 1 (M-4): Spiel und Teams je Eintrag. */
  matchFor?: (matchId: string) => EventMatch | undefined;
}

export function RejectedOutboxDialog({ isOpen, onClose, entries, onDismiss, matchFor }: RejectedOutboxDialogProps) {
  const { t: tCommon } = useTranslation('common');
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={String(tCommon('outbox.rejected.dialogTitle'))}>
      <RejectedEntriesPanel entries={entries} onDismiss={onDismiss} matchFor={matchFor} />
    </Dialog>
  );
}
