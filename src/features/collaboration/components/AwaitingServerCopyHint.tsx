/**
 * @FU-109 „Verwerfen ohne erreichbaren Server löscht nichts und lädt den Stand des Servers nach“: Hinweis
 * „Verworfen – der Stand des Servers wird geladen, sobald die Verbindung steht“.
 *
 * Desktop: im Kopf neben der Übertragungs-Anzeige. Handy und Tablet: eigene Statuszeile über die volle Breite direkt unter
 * dem Kopf (`<header>` des Admin Centers; ohne `<header>`, z. B. im Cockpit, unter der Zeile der Anzeige). Der Text bricht
 * um; die Zeile liegt oben und verdeckt das Offline-Banner unten nicht. Die Einbindungen (AdminHeader, Cockpit) bleiben
 * unverändert – die Zeile liegt fest (`position: fixed`) am Fenster, am Kopf ausgerichtet; kein Portal (nur Dialoge, @OB-055).
 */
import { CSSProperties, RefObject, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { useDeviceType } from '../../../hooks/useIsMobile';

const inlineStyle: CSSProperties = {
    alignSelf: 'center',
    marginLeft: cssVars.spacing.xs,
    color: cssVars.colors.warning,
    fontSize: cssVars.fontSizes.bodySm,
    whiteSpace: 'nowrap',
};

const lineStyle: CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    zIndex: cssVars.zIndex.sticky,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    // deckend: Seitenhintergrund, darüber die (halbtransparente) Warn-Tönung – der Inhalt darunter scheint nicht durch
    backgroundColor: cssVars.colors.background,
    backgroundImage: `linear-gradient(${cssVars.colors.warningLight}, ${cssVars.colors.warningLight})`,
    borderBottom: `1px solid ${cssVars.colors.warning}`,
    boxShadow: cssVars.shadows.sm,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
};

/** Unterkante des Kopfs (bzw. der Zeile der Anzeige) – dort beginnt die Statuszeile. */
function anchorBottom(anchor: HTMLElement | null): number | null {
    if (!anchor) { return null; }
    const head = anchor.closest('header') ?? anchor;
    return head.getBoundingClientRect().bottom;
}

export interface AwaitingServerCopyHintProps {
    /** Container der Übertragungs-Anzeige (für die Ausrichtung der Statuszeile). */
    anchorRef: RefObject<HTMLElement | null>;
}

export function AwaitingServerCopyHint({ anchorRef }: AwaitingServerCopyHintProps) {
    const { t } = useTranslation('common');
    const asLine = useDeviceType() !== 'desktop';
    const [top, setTop] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (!asLine) { return undefined; }
        const measure = (): void => { setTop(anchorBottom(anchorRef.current)); };
        measure();
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [asLine, anchorRef]);

    const text = t('syncStatus.awaitingServerCopy');
    if (!asLine) {
        return <span style={inlineStyle} role="status" data-testid="sync-awaiting-server-copy">{text}</span>;
    }
    if (top === null) { return null; }
    return <div style={{ ...lineStyle, top: `${top}px` }} role="status" data-testid="sync-awaiting-server-copy">{text}</div>;
}
