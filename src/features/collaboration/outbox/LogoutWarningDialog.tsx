/**
 * Abmelde-Warnung (D-C2, C2b): warnt vor dem Abmelden, wenn Eintraege noch auf
 * Uebertragung warten. Die Eintraege bleiben auf dem Geraet gespeichert und
 * werden nach der naechsten Anmeldung mit diesem Konto gesendet -- geloescht
 * wird nichts.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogActions } from '../../../components/ui/molecules/DialogActions';
import { Dialog } from '../../../components/dialogs/Dialog';
import { cssVars } from '../../../design-tokens';

export interface LogoutWarningDialogProps {
  isOpen: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.bodySm,
  color: cssVars.colors.textPrimary,
};

export function LogoutWarningDialog({ isOpen, count, onCancel, onConfirm }: LogoutWarningDialogProps) {
  const { t } = useTranslation('common');
  // Tasten im festen Fuß (DA-2a, @OB-061/@OB-062): Abbrechen davor, die Haupttaste „Trotzdem abmelden“ zuletzt
  const footer = (
    <DialogActions
      secondary={[{ label: t('actions.cancel'), onClick: onCancel, 'data-testid': 'logout-warning-cancel' }]}
      primary={{ label: t('outbox.logoutWarning.confirm'), onClick: onConfirm, 'data-testid': 'logout-warning-confirm' }}
      primaryVariant="danger"
      data-testid="logout-warning-actions"
    />
  );
  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={String(t('outbox.logoutWarning.title', { count }))} footer={footer}>
      <div data-testid="logout-warning-dialog">
        <p style={messageStyle}>{t('outbox.logoutWarning.message', { count })}</p>
      </div>
    </Dialog>
  );
}
