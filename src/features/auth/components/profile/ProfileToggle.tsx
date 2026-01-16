import React, { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

interface ProfileToggleProps {
    label: string;
    checked: boolean;
    onChange: () => void;
    icon?: string;
}

export const ProfileToggle: React.FC<ProfileToggleProps> = ({ label, checked, onChange, icon }) => (
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
};
