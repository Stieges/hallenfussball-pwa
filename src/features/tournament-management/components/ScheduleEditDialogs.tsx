/**
 * Rückfragen des Spielplan-Bearbeitens: Konflikte beim Speichern (@ZP-102), „n Änderungen verwerfen?“ (@ZP-103) und
 * „von Hand zugeteilt – trotzdem neu verteilen?“ (@W3-035).
 */
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import type { ScheduleDraftControls } from '../hooks/useScheduleDraft';
import type { ScheduleEditActions } from '../hooks/useScheduleEditActions';
import { ScheduleConflictContent } from './ScheduleConflictContent';

interface ScheduleEditDialogsProps {
  draft: ScheduleDraftControls;
  edit: ScheduleEditActions;
}

const CRITICAL = new Set(['team_double_booking', 'referee_double_booking', 'field_overlap']);

export const ScheduleEditDialogs: React.FC<ScheduleEditDialogsProps> = ({ draft, edit }) => {
  const { t } = useTranslation('tournament');
  const critical = draft.conflicts.filter((c) => CRITICAL.has(c.type));
  const warnings = draft.conflicts.filter((c) => c.type === 'break_violation');

  return (
    <>
      <ConfirmDialog
        isOpen={draft.conflictOpen}
        onClose={draft.closeConflicts}
        onConfirm={draft.saveAnyway}
        title={t('schedule.conflicts.title')}
        confirmText={t('schedule.conflicts.saveAnyway')}
        cancelText={t('schedule.conflicts.backToEdit')}
        variant={critical.length > 0 ? 'danger' : 'warning'}
        message={<ScheduleConflictContent criticalConflicts={critical} warningConflicts={warnings} />}
      />
      <ConfirmDialog
        isOpen={draft.discardOpen}
        onClose={draft.keepEditing}
        onConfirm={draft.confirmDiscard}
        title={t('draft.discardTitle', { count: draft.changeCount })}
        message={t('draft.discardMessage')}
        confirmText={t('draft.discard')}
        cancelText={t('draft.keepEditing')}
        variant="danger"
      />
      <ConfirmDialog {...edit.overwriteDialogProps} />
    </>
  );
};
