/**
 * Abmelde-Warnung (D-C2, C2b): warnt vor dem Abmelden, wenn Eintraege noch auf
 * Uebertragung warten. Die Eintraege bleiben auf dem Geraet gespeichert und
 * werden nach der naechsten Anmeldung mit diesem Konto gesendet -- geloescht
 * wird nichts.
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/dialogs/Dialog';
import { cssVars } from '../../../design-tokens';

export interface LogoutWarningDialogProps {
  isOpen: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: cssVars.spacing.sm,
  marginTop: cssVars.spacing.md,
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: cssVars.fontSizes.bodySm,
  color: cssVars.colors.textPrimary,
};

export function LogoutWarningDialog({ isOpen, count, onCancel, onConfirm }: LogoutWarningDialogProps) {
  const { t } = useTranslation('common');
  return (
    <Dialog isOpen={isOpen} onClose={onCancel} title={String(t('outbox.logoutWarning.title'))}>
      <div data-testid="logout-warning-dialog">
        <p style={messageStyle}>{t('outbox.logoutWarning.message', { count })}</p>
        <div style={actionsStyle}>
          <Button data-testid="logout-warning-cancel" variant="ghost" onClick={onCancel}>
            {t('actions.cancel')}
          </Button>
          <Button data-testid="logout-warning-confirm" variant="danger" onClick={onConfirm}>
            {t('outbox.logoutWarning.confirm')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
