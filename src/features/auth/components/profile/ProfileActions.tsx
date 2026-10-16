import React from 'react';
import { cssVars } from '../../../../design-tokens';
import { profileActionStyles as styles } from './profileActionStyles';

interface ProfileActionsProps {
  /** Current 2FA state */
  is2FAEnabled: boolean;
  /** Handler for 2FA toggle */
  on2FAToggle: () => void;
  /** Handler for password change */
  onChangePassword: () => void;
  /** Cooldown remaining in seconds */
  passwordResetCooldown: number;
  /** Handler for logout */
  onLogout: () => void;
}

export const ProfileActions: React.FC<ProfileActionsProps> = ({
  onChangePassword,
  passwordResetCooldown,
  onLogout,
}) => {
  const isPasswordChangeDisabled = passwordResetCooldown > 0;

  return (
    <>
      <button
        style={{
          ...styles.actionButton,
          ...(isPasswordChangeDisabled ? styles.actionButtonDisabled : {}),
        }}
        onClick={onChangePassword}
        disabled={isPasswordChangeDisabled}
      >
        🔑 {isPasswordChangeDisabled
          ? `Passwort ändern (${passwordResetCooldown}s)`
          : 'Passwort ändern'}
      </button>
      <div style={styles.divider} />
      <button
        style={{ ...styles.actionButton, color: cssVars.colors.error }}
        onClick={onLogout}
      >
        🚪 Abmelden
      </button>
    </>
  );
};

export default ProfileActions;
