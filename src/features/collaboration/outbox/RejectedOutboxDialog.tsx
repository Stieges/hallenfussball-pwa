/**
 * RejectedOutboxDialog (C3a-2a Fixrunde 3, P8/W11): die Anzeige zu `useRejectedOutboxDialog` --
 * Dialog mit `RejectedEntriesPanel`, aus `LiveCockpit.tsx` und `AdminHeader.tsx` ausgelagert
 * (dort Wort fuer Wort doppelt).
 */
import { useTranslation } from 'react-i18next';
import { Dialog } from '../../../components/dialogs/Dialog';
import { RejectedEntriesPanel } from './RejectedEntriesPanel';
import type { EngineRejectedEntry } from '../../match-engine/useEngineOutboxSummary';

export interface RejectedOutboxDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entries: EngineRejectedEntry[];
  onDismiss: (ids: string[]) => void;
}

export function RejectedOutboxDialog({ isOpen, onClose, entries, onDismiss }: RejectedOutboxDialogProps) {
  const { t: tCommon } = useTranslation('common');
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={String(tCommon('outbox.rejected.dialogTitle'))}>
      <RejectedEntriesPanel entries={entries} onDismiss={onDismiss} />
    </Dialog>
  );
}
