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
import { proposeCopyTitle } from '../../core/models/tournamentCopy';
import type { Tournament } from '../../types/tournament';

export interface CopyTournamentDialogProps {
  /** Das Original; `null` = Dialog zu */
  tournament: Tournament | null;
  onCancel: () => void;
  onConfirm: (title: string) => void;
}

const hintStyle: CSSProperties = {
  margin: `0 0 ${cssVars.spacing.md}`,
  color: cssVars.colors.textSecondary,
  fontSize: cssVars.fontSizes.md,
};

function CopyForm({ tournament, onCancel, onConfirm }: CopyTournamentDialogProps & { tournament: Tournament }) {
  const { t } = useTranslation('common');
  const [name, setName] = useState(() => proposeCopyTitle(tournament.title, t('tournament.copySuffix')));
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
            onClick: () => onConfirm(title),
            disabled: title === '',
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
    </Dialog>
  );
}

export const CopyTournamentDialog = (props: CopyTournamentDialogProps) =>
  props.tournament ? <CopyForm {...props} tournament={props.tournament} /> : null;
