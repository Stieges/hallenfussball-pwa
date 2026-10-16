/**
 * A-07d1 – „Auf allen anderen Geräten abmelden“ (@AN-024).
 *
 * Knopf mit Bestätigung. Meldet alle anderen Geräte ab, dieses Gerät bleibt angemeldet.
 * Während des Aufrufs ist der Knopf gesperrt. Erfolg und Fehler (mit Grund) kommen als Toast;
 * nichts wird still verschluckt.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { profileActionStyles } from './profile/profileActionStyles';

export const LogoutOthersSection: React.FC = () => {
  const { t } = useTranslation('auth');
  const { logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    setIsConfirmOpen(false);
    setIsPending(true);
    try {
      const result = await logout({ scope: 'others' });
      if (result.ok) {
        showSuccess(t('logoutOthers.success'));
      } else {
        showError(t('logoutOthers.error', { reason: t(`logoutOthers.reason.${result.reason}`) }));
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <div style={profileActionStyles.divider} />
      <button
        type="button"
        data-testid="logout-others"
        disabled={isPending}
        aria-busy={isPending}
        style={{
          ...profileActionStyles.actionButton,
          minHeight: cssVars.touchTargets.minimum,
          ...(isPending ? profileActionStyles.actionButtonDisabled : {}),
        }}
        onClick={() => setIsConfirmOpen(true)}
      >
        {isPending ? t('logoutOthers.pending') : t('logoutOthers.button')}
      </button>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={t('logoutOthers.title')}
        message={t('logoutOthers.message')}
        variant="warning"
        confirmText={t('logoutOthers.confirm')}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
};

export default LogoutOthersSection;
