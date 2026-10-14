/**
 * A-07d1 – „Auf allen anderen Geräten abmelden“ (@AN-024).
 *
 * Knopf mit Bestätigung. Meldet alle anderen Geräte ab, dieses Gerät bleibt angemeldet.
 * Erfolg und Fehler (mit Grund) kommen als Toast; nichts wird still verschluckt.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';

const buttonStyle: React.CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: `${cssVars.spacing.sm} 0`,
  minHeight: cssVars.touchTargets.minimum,
  background: 'none',
  border: 'none',
  fontSize: cssVars.fontSizes.md,
  color: cssVars.colors.textPrimary,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
};

export const LogoutOthersSection: React.FC = () => {
  const { t } = useTranslation('auth');
  const { logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleConfirm = async (): Promise<void> => {
    setIsConfirmOpen(false);
    const result = await logout({ scope: 'others' });
    if (result.ok) {
      showSuccess(t('logoutOthers.success'));
    } else {
      showError(t('logoutOthers.error', { reason: t(`logoutOthers.reason.${result.reason}`) }));
    }
  };

  return (
    <>
      <button
        type="button"
        data-testid="logout-others"
        style={buttonStyle}
        onClick={() => setIsConfirmOpen(true)}
      >
        {t('logoutOthers.button')}
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
