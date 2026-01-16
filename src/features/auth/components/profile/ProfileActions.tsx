import React, { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { ProfileToggle } from './ProfileToggle';

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
  is2FAEnabled,
  on2FAToggle,
  onChangePassword,
  passwordResetCooldown,
  onLogout,
}) => {
  const isPasswordChangeDisabled = passwordResetCooldown > 0;

  return (
    <>
      <ProfileToggle
        label="Zwei-Faktor-Authentifizierung (2FA)"
        icon="🛡️"
        checked={is2FAEnabled}
        onChange={on2FAToggle}
      />
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

const styles: Record<string, CSSProperties> = {
  actionButton: {
    width: '100%',
    textAlign: 'left',
    padding: `${cssVars.spacing.sm} 0`,
    background: 'none',
    border: 'none',
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  actionButtonDisabled: {
    color: cssVars.colors.textMuted,
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  divider: {
    height: '1px',
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.xs} 0`,
  },
};

export default ProfileActions;
