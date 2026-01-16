import React, { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { ProfileToggle } from './ProfileToggle';

interface ProfileSettingsProps {
    isDark: boolean;
    onToggleTheme: () => void;
    onOpenSettings: () => void;
    onShowInfo: (msg: string) => void;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({
    isDark,
    onToggleTheme,
    onOpenSettings,
    onShowInfo,
}) => {
    return (
        <>
            <ProfileToggle
                label="Dark Mode"
                icon="🌙"
                checked={isDark}
                onChange={onToggleTheme}
            />
            <ProfileToggle
                label="Benachrichtigungen"
                icon="🔔"
                checked={true /* Mocked */}
                onChange={() => onShowInfo('Benachrichtigungen werden in Kürze verfügbar sein.')}
            />
            <div style={styles.listRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
                    <span style={{ fontSize: cssVars.fontSizes.lg }}>🌐</span>
                    <span style={styles.listLabel}>Sprache</span>
                </div>
                <select
                    style={styles.selectInput}
                    value="de"
                    onChange={() => alert('Sprache ist aktuell auf Deutsch festgelegt.')}
                >
                    <option value="de">Deutsch</option>
                    <option value="en">English (BETA)</option>
                </select>
            </div>
            <div style={styles.divider} />
            <button style={styles.actionButton} onClick={onOpenSettings}>
                ⚙️ Weitere Einstellungen
            </button>
        </>
    );
};

const styles: Record<string, CSSProperties> = {
    listRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${cssVars.spacing.sm} 0`,
        cursor: 'pointer',
    },
    listLabel: {
        fontSize: cssVars.fontSizes.md,
    },
    selectInput: {
        padding: '4px 8px',
        borderRadius: cssVars.borderRadius.md,
        border: `1px solid ${cssVars.colors.border}`,
        background: cssVars.colors.background,
        color: cssVars.colors.textPrimary,
        fontSize: cssVars.fontSizes.sm,
        cursor: 'pointer',
    },
    divider: {
        height: '1px',
        background: cssVars.colors.border,
        margin: `${cssVars.spacing.xs} 0`,
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
};
