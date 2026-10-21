/**
 * @FU-109 „Verwerfen ohne erreichbaren Server löscht nichts und lädt den Stand des Servers nach“: Statuszeile
 * „Verworfen – der Stand des Servers wird geladen, sobald die Verbindung steht“ für das geöffnete Turnier.
 *
 * Eine Zeile im normalen Fluss über die volle Breite (Text bricht um): der Inhalt darunter rückt nach unten und wird nie
 * verdeckt (Review Version-Fix R1). Die Gastgeber setzen sie direkt unter ihren Kopf – Admin Center unter `AdminHeader`
 * (`sticky` unterhalb des Kopfs), Cockpit unter die Anzeigetafel. Ohne Wartendes rendert sie nichts.
 */
import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { useSyncStatus } from '../../../hooks/useSyncStatus';

const lineStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    // deckend: Seitenhintergrund, darüber die (halbtransparente) Warn-Tönung
    backgroundColor: cssVars.colors.background,
    backgroundImage: `linear-gradient(${cssVars.colors.warningLight}, ${cssVars.colors.warningLight})`,
    borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.warning}`,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodySm,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
};

export interface AwaitingServerCopyLineProps {
    tournamentId: string;
    /** Abstand nach oben, wenn die Zeile beim Scrollen unter einem festen Kopf stehen bleiben soll (`sticky`). */
    stickyTop?: number;
    zIndex?: number;
}

export function AwaitingServerCopyLine({ tournamentId, stickyTop, zIndex }: AwaitingServerCopyLineProps) {
    const { t } = useTranslation('common');
    const { awaitingServerCopyIds = [], isCloudSyncAvailable } = useSyncStatus();
    if (!isCloudSyncAvailable || !awaitingServerCopyIds.includes(tournamentId)) { return null; }
    const sticky: CSSProperties = stickyTop === undefined ? {} : { position: 'sticky', top: stickyTop, zIndex };
    return (
        <div style={{ ...lineStyle, ...sticky }} role="status" data-testid="sync-awaiting-server-copy">
            {t('syncStatus.awaitingServerCopy')}
        </div>
    );
}
