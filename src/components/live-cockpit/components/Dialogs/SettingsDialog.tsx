import { CSSProperties } from 'react';
import { cssVars, dialogWidths } from '../../../../design-tokens';
import { DialogSurface } from '../../../ui/molecules/DialogSurface';
import { MatchCockpitSettingsPanel } from '../../../match-cockpit/MatchCockpitSettingsPanel';
import type { MatchCockpitSettings } from '../../../../types/tournament';

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    settings: MatchCockpitSettings;
    onChange: (settings: MatchCockpitSettings) => void;
    tournamentId: string;
    onTestSound?: () => void;
    /** Task R2 Fixrunde 3 (Review-Befund M): durchgereicht an MatchCockpitSettingsPanel — der
     *  Dialog öffnet sich unter readOnly weiterhin (Ansehen erlaubt, Regel 2), nur die Eingaben
     *  darin werden gesperrt. */
    readOnly?: boolean;
}

export function SettingsDialog({
    isOpen,
    onClose,
    settings,
    onChange,
    tournamentId,
    onTestSound,
    readOnly = false,
}: SettingsDialogProps) {

    if (!isOpen) {return null;}

    const dialogStyle: CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '44px',
        height: '44px',
        minWidth: '44px',
        minHeight: '44px',
        background: 'transparent',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: cssVars.colors.textSecondary,
        padding: 0,
        lineHeight: 1,
        borderRadius: cssVars.borderRadius.sm,
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
        color: cssVars.colors.onPrimary,
        border: 'none',
        borderRadius: cssVars.borderRadius.md,
        fontSize: cssVars.fontSizes.md,
        fontWeight: cssVars.fontWeights.medium,
        cursor: 'pointer',
    };

    return (
        <DialogSurface
            isOpen={isOpen}
            onClose={onClose}
            maxWidth={dialogWidths.md}
            labelledBy="cockpit-settings-dialog-title"
        >
            <div style={dialogStyle}>
                <div style={headerStyle}>
                    <h2 id="cockpit-settings-dialog-title" style={titleStyle}>Cockpit Einstellungen</h2>
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
                        readOnly={readOnly}
                    />
                </div>

                <div style={footerStyle}>
                    <button style={okButtonStyle} onClick={onClose}>
                        Fertig
                    </button>
                </div>
            </div>
        </DialogSurface>
    );
}
