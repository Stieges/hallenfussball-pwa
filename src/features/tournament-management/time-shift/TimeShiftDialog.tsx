/**
 * B-26 Dialog „Zeiten verschieben“ (Mockup Bild 2, 4, 5, 6): Eingaben, Zusammenfassung und Haupttaste.
 * Vor dem ersten Anpfiff heißt sie „Übernehmen“ und gilt sofort (@ZP-019, @ZP-089), danach „Vorschau ansehen“ (@ZP-017).
 * Bei der Sperre „Vergangenheit“ bleibt sie sichtbar, ist aber inaktiv (@ZP-057, Mockup E8).
 * Solange etwas verschoben ist, steht unten der Link „Ursprüngliche Zeiten wiederherstellen“ (@ZP-036, Mockup E6).
 * Kein Feld „Grund“: ohne Verlauf (@ZP-038, MVP+) würde er nirgends gespeichert.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, dialogWidths, iconSizeValues } from '../../../design-tokens';
import { Dialog } from '../../../components/dialogs/Dialog';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';
import { Icons } from '../../../components/ui/Icons';
import type { ShiftPlan } from '../../../core/services/scheduleShift';
import { TimeShiftForm, type MatchChoice } from './TimeShiftForm';
import { TimeShiftSummary } from './TimeShiftSummary';
import type { ShiftForm } from './useTimeShift';

interface TimeShiftDialogProps {
  isOpen: boolean;
  form: ShiftForm;
  onFormChange: (form: ShiftForm) => void;
  plan: ShiftPlan | undefined;
  kickedOff: boolean;
  restorable: boolean;
  choices: readonly MatchChoice[];
  fieldCount: number;
  onProceed: () => void;
  onRestore: () => void;
  onClose: () => void;
}

const body: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.lg };
const restoreButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  minHeight: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.sm}`,
  alignSelf: 'flex-start',
  background: 'transparent',
  border: 'none',
  color: cssVars.colors.primary,
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.semibold,
  fontFamily: cssVars.fontFamilies.body,
  textDecoration: 'underline',
  cursor: 'pointer',
};

export function TimeShiftDialog(props: TimeShiftDialogProps) {
  const { isOpen, form, onFormChange, plan, kickedOff, restorable, choices, fieldCount, onProceed, onRestore, onClose } = props;
  const { t } = useTranslation('tournament');
  const blocked = plan === undefined || plan.error !== undefined || plan.changes.length === 0;
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('timeShift.dialogTitle')}
      maxWidth={dialogWidths.md}
      footer={(
        <DialogActions
          secondary={[{ label: t('timeShift.cancel'), onClick: onClose, 'data-testid': 'time-shift-cancel' }]}
          primary={{ label: kickedOff ? t('timeShift.preview') : t('timeShift.apply'), onClick: onProceed, disabled: blocked, 'data-testid': 'time-shift-proceed' }}
        />
      )}
    >
      <div style={body} data-testid="time-shift-dialog">
        <TimeShiftForm form={form} onChange={onFormChange} choices={choices} fieldCount={fieldCount} />
        <TimeShiftSummary plan={plan} kickedOff={kickedOff} direction={form.direction} minutes={form.minutes} />
        {restorable && (
          <button type="button" style={restoreButton} onClick={onRestore} data-testid="time-shift-restore-link">
            <Icons.Restore size={iconSizeValues.sm} />
            {t('timeShift.restoreLink')}
          </button>
        )}
      </div>
    </Dialog>
  );
}
