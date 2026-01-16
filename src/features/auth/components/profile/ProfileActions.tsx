/**
 * ProfileActions - Security and account actions
 *
 * Contains 2FA toggle, password change, and logout functionality.
 *
 * @see UserProfileScreen.tsx
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

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

/**
 * Toggle row component
 */
const ToggleRow: React.FC<{
  label: string;
  checked: boolean;
  onChange: () => void;
  icon?: string;
}> = ({ label, checked, onChange, icon }) => (
  <div style={styles.toggleRow} onClick={onChange}>
    <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
      {icon && <span style={{ fontSize: cssVars.fontSizes.lg }}>{icon}</span>}
      <span style={styles.toggleLabel}>{label}</span>
    </div>
    <div
      style={{
        ...styles.toggleSwitch,
        background: checked ? cssVars.colors.primary : cssVars.colors.surfaceSolid,
        justifyContent: checked ? 'flex-end' : 'flex-start',
      }}
    >
      <div style={styles.toggleKnob} />
    </div>
  </div>
);

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
      <ToggleRow
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
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${cssVars.spacing.sm} 0`,
    cursor: 'pointer',
  },
  toggleLabel: {
    fontSize: cssVars.fontSizes.md,
  },
  toggleSwitch: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    transition: 'background 0.2s ease',
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: cssVars.colors.textOnDark,
    boxShadow: `0 1px 2px ${cssVars.colors.shadowSoft}`,
  },
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
