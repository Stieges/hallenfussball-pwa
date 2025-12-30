/**
 * MobileAuthBottomSheet - Auth-Optionen als BottomSheet für Mobile
 *
 * Zeigt je nach Auth-Zustand:
 * - Gast: "Registrieren", "Anmelden"
 * - Nicht eingeloggt: "Anmelden", "Registrieren", "Als Gast fortfahren"
 *
 * @see docs/concepts/HEADER-AUTH-NAVIGATION-KONZEPT.md Abschnitt 4.4
 */

import React from 'react';
import { BottomSheet, BottomSheetItem, Icons } from '../../../components/ui';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../../../design-tokens';

interface MobileAuthBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToLogin: () => void;
  onNavigateToRegister: () => void;
}

export const MobileAuthBottomSheet: React.FC<MobileAuthBottomSheetProps> = ({
  isOpen,
  onClose,
  onNavigateToLogin,
  onNavigateToRegister,
}) => {
  const { isGuest, continueAsGuest } = useAuth();

  const handleLogin = () => {
    onClose();
    onNavigateToLogin();
  };

  const handleRegister = () => {
    onClose();
    onNavigateToRegister();
  };

  const handleContinueAsGuest = () => {
    continueAsGuest();
    onClose();
  };

  // Guest user - show registration as primary
  if (isGuest) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Konto">
        <BottomSheetItem
          icon={<Icons.UserPlus size={20} color={colors.primary} />}
          label="Registrieren"
          description="Konto erstellen und Daten synchronisieren"
          onClick={handleRegister}
          data-testid="bottomsheet-register"
        />
        <BottomSheetItem
          icon={<Icons.User size={20} color="currentColor" />}
          label="Anmelden"
          description="Mit bestehendem Konto anmelden"
          onClick={handleLogin}
          data-testid="bottomsheet-login"
        />
      </BottomSheet>
    );
  }

  // Not logged in - show all options
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Konto">
      <BottomSheetItem
        icon={<Icons.User size={20} color="currentColor" />}
        label="Anmelden"
        description="Mit bestehendem Konto anmelden"
        onClick={handleLogin}
        data-testid="bottomsheet-login"
      />
      <BottomSheetItem
        icon={<Icons.UserPlus size={20} color="currentColor" />}
        label="Registrieren"
        description="Neues Konto erstellen"
        onClick={handleRegister}
        data-testid="bottomsheet-register"
      />
      <BottomSheetItem
        icon={<Icons.Users size={20} color={colors.textTertiary} />}
        label="Als Gast fortfahren"
        description="Ohne Konto, lokal auf diesem Gerät"
        onClick={handleContinueAsGuest}
        data-testid="bottomsheet-continue-guest"
      />
    </BottomSheet>
  );
};

export default MobileAuthBottomSheet;
