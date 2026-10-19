/**
 * CopyTournamentDialog – Name der Kopie fürs Proben vor dem Speichern (@W5-028).
 *
 * Der Vorschlag „<Name> (Probe)“ kommt von `proposeCopyTitle`; Olli darf ihn ändern. Leerer Name speichert nicht.
 */
import { useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { Dialog } from './Dialog';
import { Input } from '../ui/Input';
import { DialogActions } from '../ui/molecules';
import { proposeCopyTitle, proposeProbeDate } from '../../core/models/tournamentCopy';
import type { Tournament } from '../../types/tournament';

export interface CopyTournamentDialogProps {
  /** Das Original; `null` = Dialog zu */
  tournament: Tournament | null;
  onCancel: () => void;
  onConfirm: (title: string, startDate: string) => void;
}

const hintStyle: CSSProperties = {
  margin: `0 0 ${cssVars.spacing.md}`,
  color: cssVars.colors.textSecondary,
  fontSize: cssVars.fontSizes.md,
};

function CopyForm({ tournament, onCancel, onConfirm }: CopyTournamentDialogProps & { tournament: Tournament }) {
  const { t } = useTranslation('common');
  const [name, setName] = useState(() => proposeCopyTitle(tournament.title, t('tournament.copySuffix')));
  // @W5-025: ohne Datum in der Zukunft stünde die Kopie nicht bei „kommend“
  const [date, setDate] = useState(() => proposeProbeDate(tournament, new Date()));
  const title = name.trim();

  return (
    <Dialog
      isOpen
      onClose={onCancel}
      title={t('tournament.copyDialog.title')}
      footer={
        <DialogActions
          secondary={[{ label: t('actions.cancel'), onClick: onCancel, 'data-testid': 'copy-dialog-cancel' }]}
          primary={{
            label: t('tournament.copyDialog.confirm'),
            onClick: () => onConfirm(title, date),
            disabled: title === '' || date === '',
            'data-testid': 'copy-dialog-confirm',
          }}
        />
      }
    >
      <p style={hintStyle}>{t('tournament.copyDialog.hint')}</p>
      <Input
        label={t('tournament.copyDialog.nameLabel')}
        value={name}
        onChange={setName}
        data-testid="copy-dialog-name"
      />
      <div style={{ marginTop: cssVars.spacing.md }}>
        <Input
          type="date"
          label={t('tournament.copyDialog.dateLabel')}
          value={date}
          onChange={setDate}
          data-testid="copy-dialog-date"
        />
      </div>
    </Dialog>
  );
}

export const CopyTournamentDialog = (props: CopyTournamentDialogProps) =>
  props.tournament ? <CopyForm {...props} tournament={props.tournament} /> : null;
