/**
 * EinrichtungSchritte – „Hallen-Lautsprecher einrichten“ (H4-9, @HT-043): die vier Schritte in fester Reihenfolge – App installieren,
 * Schalter, Ton aktivieren, Testton in der Halle. Der Schalter (Schritt 2) kommt als Kind von außen, damit es nur EINEN Schalter auf
 * der Seite gibt. „Erledigt“ steht mit Häkchen und Wort (Farbe nie allein): Schritt 1 bei schon installierter App, Schritt 2 sobald dieses Gerät
 * Lautsprecher ist, Schritt 3 sobald der Ton aktiv ist. Der erste offene Schritt ist als „jetzt“ markiert (stärkerer Rand).
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Button } from '../../../components/ui/Button';
import { Icons } from '../../../components/ui/Icons';

export interface EinrichtungSchritteProps {
  installiert: boolean;
  /** Das Angebot des Browsers „App installieren“ ist da (sonst erklärt der Schritt den Weg über das Menü). */
  installAngebot: boolean;
  onInstallieren: () => void;
  schalterErledigt: boolean;
  tonErledigt: boolean;
  /** Der Schalter samt Feldwahl (Schritt 2). */
  schalter: ReactNode;
  /** Änderungen sind gesperrt (nach dem Turnierende): die Schritte bleiben lesbar. */
  gesperrt?: boolean;
}

const listeStil: CSSProperties = { listStyle: 'none', margin: 0, padding: cssVars.spacing.md, display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg, backgroundColor: cssVars.colors.surface, color: cssVars.colors.textPrimary };
const zeileStil: CSSProperties = { display: 'grid', gridTemplateColumns: `${cssVars.iconSizes.lg} minmax(0, 1fr)`, gap: `${cssVars.spacing.sm} ${cssVars.spacing.md}`, alignItems: 'start' };
const inhaltStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, minWidth: 0 };
const titelStil: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, fontWeight: cssVars.fontWeights.semibold, lineHeight: cssVars.lineHeights.title };
const textStil: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
const markeStil = (erledigt: boolean, jetzt: boolean): CSSProperties => ({
  width: cssVars.iconSizes.lg, height: cssVars.iconSizes.lg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: cssVars.borderRadius.full,
  border: `${cssVars.borderWidth.medium} solid ${erledigt || jetzt ? cssVars.colors.primary : cssVars.colors.borderControl}`,
  background: erledigt ? cssVars.colors.primary : 'transparent', color: erledigt ? cssVars.colors.onPrimary : cssVars.colors.textPrimary,
  fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.md,
});
const tagStil: CSSProperties = { marginLeft: cssVars.spacing.xs, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.medium };
const erledigtStil: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs, margin: 0, color: cssVars.colors.primary, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md };

export function EinrichtungSchritte({ installiert, installAngebot, onInstallieren, schalterErledigt, tonErledigt, schalter, gesperrt = false }: EinrichtungSchritteProps): ReactElement {
  const { t } = useTranslation('hallenton');
  const erledigt = [installiert, schalterErledigt, tonErledigt, false];
  const jetzt = erledigt.indexOf(false);
  const zeile = (nr: number, titel: ReactNode, inhalt: ReactNode): ReactElement => (
    <li style={zeileStil} data-testid={`einrichtung-schritt-${nr}`} data-done={erledigt[nr - 1]} data-now={jetzt === nr - 1}>
      <span style={markeStil(erledigt[nr - 1], jetzt === nr - 1)} aria-hidden="true">{erledigt[nr - 1] ? <Icons.Check size={iconSizeValues.sm} /> : nr}</span>
      <div style={inhaltStil}>
        <h3 style={titelStil}>
          {titel}
          {erledigt[nr - 1] ? <span style={tagStil}>{t('einrichtung.erledigt')}</span> : nr === 1 ? <span style={tagStil}>{t('einrichtung.empfohlen')}</span> : null}
        </h3>
        {inhalt}
      </div>
    </li>
  );
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md }} aria-labelledby="hallenton-einrichtung-titel" data-testid="hallenton-einrichtung">
      <h2 id="hallenton-einrichtung-titel" style={{ margin: 0, fontSize: cssVars.fontSizes.titleLg, fontWeight: cssVars.fontWeights.semibold }}>{t('einrichtung.titel')}</h2>
      <ol style={listeStil}>
        {zeile(1, t('einrichtung.schritt1'), installiert ? (
          <p style={erledigtStil} data-testid="einrichtung-installiert"><Icons.Check size={iconSizeValues.xs} />{t('einrichtung.schritt1Erledigt')}</p>
        ) : (
          <>
            <p style={textStil}>{installAngebot ? t('einrichtung.schritt1Text') : `${t('einrichtung.schritt1Text')} ${t('einrichtung.schritt1Ohne')}`}</p>
            {installAngebot ? (
              <div><Button variant="secondary" icon={<Icons.Download size={iconSizeValues.sm} />} onClick={onInstallieren} data-testid="einrichtung-installieren">{t('einrichtung.schritt1Knopf')}</Button></div>
            ) : null}
          </>
        ))}
        {zeile(2, t('einrichtung.schritt2'), gesperrt ? <p style={textStil}>{t('geraet.gesperrt')}</p> : (
          <>
            {schalter}
            <p style={textStil}>{t('einrichtung.schritt2Text')}</p>
          </>
        ))}
        {zeile(3, t('einrichtung.schritt3'), <p style={textStil}>{t('einrichtung.schritt3Text')}</p>)}
        {zeile(4, t('einrichtung.schritt4'), <p style={textStil}>{t('einrichtung.schritt4Text')}</p>)}
      </ol>
    </section>
  );
}
