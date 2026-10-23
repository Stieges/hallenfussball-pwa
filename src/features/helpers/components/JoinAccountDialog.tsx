/**
 * Rückfrage, wenn jemand mit angemeldetem Konto den Helfer-QR-Code scannt (A-17b, Mockup M1 `e3`, @HE-089, @HE-090).
 * „Weiter“ meldet nur dieses Gerät ab (Haupttaste unten), „Abbrechen“ lässt alles unverändert und sendet nichts. Der Hinweis
 * sagt, dass andere Geräte angemeldet bleiben. Zuerst „Abbrechen“ im Fokus: Enter löst nichts aus (@OB-014).
 */
import { useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Dialog } from '../../../components/dialogs/Dialog';
import { InlineNotice } from '../../../components/ui/molecules/InlineNotice';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';

export interface JoinAccountDialogProps {
  accountName: string | null;
  /** „Weiter“ wurde getippt; Abmelden läuft (Taste gesperrt). */
  busy: boolean;
  onContinue: () => void;
  onCancel: () => void;
}

export const JoinAccountDialog = ({ accountName, busy, onContinue, onCancel }: JoinAccountDialogProps) => {
  const { t } = useTranslation('helpers');
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      isOpen
      onClose={onCancel}
      title={t('join.account.dialogTitle')}
      closeOnBackdropClick={false}
      initialFocusRef={cancelRef}
      suppressEnter
      footer={(
        <DialogActions
          secondary={[{ label: t('join.account.cancel'), onClick: onCancel, disabled: busy, buttonRef: cancelRef, 'data-testid': 'join-account-cancel' }]}
          primary={{ label: busy ? t('join.account.signingOut') : t('join.account.continue'), onClick: onContinue, disabled: busy, 'data-testid': 'join-account-continue' }}
        />
      )}
    >
      <p data-testid="join-account-text">
        {accountName ? (
          <Trans i18nKey="join.account.dialogText" ns="helpers" values={{ name: accountName }} components={{ b: <strong /> }} />
        ) : (
          t('join.account.dialogTextNoName')
        )}
      </p>
      <InlineNotice tone="info" data-testid="join-account-other-devices">{t('join.account.otherDevices')}</InlineNotice>
    </Dialog>
  );
};
