import { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { MatchCockpitSettingsPanel } from '../../../match-cockpit/MatchCockpitSettingsPanel';
import type { MatchCockpitSettings } from '../../../../types/tournament';

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    settings: MatchCockpitSettings;
    onChange: (settings: MatchCockpitSettings) => void;
    tournamentId: string;
    onTestSound?: () => void;
}

export function SettingsDialog({
    isOpen,
    onClose,
    settings,
    onChange,
    tournamentId,
    onTestSound,
}: SettingsDialogProps) {
    if (!isOpen) {return null;}

    const overlayStyle: CSSProperties = {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 200, // Higher than menu
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: cssVars.spacing.md,
    };

    const dialogStyle: CSSProperties = {
        background: cssVars.colors.surfaceSolid,
        borderRadius: cssVars.borderRadius.lg,
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: cssVars.shadows.xl,
        animation: 'slideUp 0.2s ease-out',
    };

    const headerStyle: CSSProperties = {
        padding: cssVars.spacing.lg,
        borderBottom: `1px solid ${cssVars.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    };

    const titleStyle: CSSProperties = {
        margin: 0,
        fontSize: cssVars.fontSizes.lg,
        fontWeight: cssVars.fontWeights.bold,
    };

    const closeButtonStyle: CSSProperties = {
        background: 'transparent',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: cssVars.colors.textSecondary,
        padding: cssVars.spacing.sm,
        lineHeight: 1,
    };

    const contentStyle: CSSProperties = {
        padding: cssVars.spacing.lg,
        overflowY: 'auto',
    };

    const footerStyle: CSSProperties = {
        padding: cssVars.spacing.md,
        borderTop: `1px solid ${cssVars.colors.border}`,
        textAlign: 'right',
    };

    const okButtonStyle: CSSProperties = {
        padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
        background: cssVars.colors.primary,
        color: 'white',
        border: 'none',
        borderRadius: cssVars.borderRadius.md,
        fontSize: cssVars.fontSizes.md,
        fontWeight: cssVars.fontWeights.medium,
        cursor: 'pointer',
    };

    return (
        <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div style={dialogStyle} role="dialog" aria-modal="true">
                <div style={headerStyle}>
                    <h2 style={titleStyle}>Cockpit Einstellungen</h2>
                    <button style={closeButtonStyle} onClick={onClose} aria-label="Schließen">
                        ×
                    </button>
                </div>

                <div style={contentStyle}>
                    <MatchCockpitSettingsPanel
                        settings={settings}
                        onChange={onChange}
                        tournamentId={tournamentId}
                        onTestSound={onTestSound}
                    />
                </div>

                <div style={footerStyle}>
                    <button style={okButtonStyle} onClick={onClose}>
                        Fertig
                    </button>
                </div>
            </div>
        </div>
    );
}
