import { CSSProperties } from 'react';
import { cssVars, dialogWidths, iconSizeValues } from '../../../../design-tokens';
import { Icons } from '../../../ui/Icons';
import { DialogActions } from '../../../ui/molecules/DialogActions';
import { DialogSurface } from '../../../ui/molecules/DialogSurface';
import { MatchCockpitSettingsPanel } from '../../../match-settings/MatchCockpitSettingsPanel';
import type { MatchCockpitSettings } from '../../../../types/tournament';
import { TastenkuerzelSchalter } from './TastenkuerzelSchalter';
import { GeraetTonAbschnitt } from './GeraetTonAbschnitt';

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

    // Kopf und Fuß liegen in den Slots der Fläche: nur der Inhalt scrollt, „Fertig“ bleibt im Bild (S1, @OB-062)
    const headerStyle: CSSProperties = {
        padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm} ${cssVars.spacing.xs} ${cssVars.spacing.lg}`,
        borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: cssVars.touchTargets.primary,
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
        width: cssVars.touchTargets.minimum,
        height: cssVars.touchTargets.minimum,
        minWidth: cssVars.touchTargets.minimum,
        minHeight: cssVars.touchTargets.minimum,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: cssVars.colors.textSecondary,
        padding: 0,
        borderRadius: cssVars.borderRadius.sm,
    };

    const contentStyle: CSSProperties = {
        padding: cssVars.spacing.lg,
    };

    const header = (
        <div style={headerStyle}>
            <h2 id="cockpit-settings-dialog-title" style={titleStyle}>Cockpit Einstellungen</h2>
            <button style={closeButtonStyle} onClick={onClose} aria-label="Schließen">
                <Icons.X size={iconSizeValues.md} />
            </button>
        </div>
    );

    const footer = (
        <DialogActions primary={{ label: 'Fertig', onClick: onClose, 'data-testid': 'cockpit-settings-fertig' }} />
    );

    return (
        <DialogSurface
            isOpen={isOpen}
            onClose={onClose}
            maxWidth={dialogWidths.md}
            labelledBy="cockpit-settings-dialog-title"
            header={header}
            footer={footer}
        >
            <div style={contentStyle}>
                <MatchCockpitSettingsPanel
                    settings={settings}
                    onChange={onChange}
                    tournamentId={tournamentId}
                    onTestSound={onTestSound}
                    readOnly={readOnly}
                    ohneTonwahl
                />
                <GeraetTonAbschnitt onTestSound={onTestSound} />
                <TastenkuerzelSchalter />
            </div>
        </DialogSurface>
    );
}
