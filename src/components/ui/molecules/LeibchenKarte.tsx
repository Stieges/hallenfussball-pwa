/**
 * LeibchenKarte – die Karte der Leibchen in der Wechselminute (@SL-206 bis @SL-209, @SL-215, @SL-218 bis @SL-231), Lage B (Daniel 2026-11-09):
 * direkt über der Daumenleiste (Cockpit) bzw. im Endstand über „Weiter“.
 * - `karte`: der Vorschlag („TSV Waging 1 zieht Gelb“, antippbar, öffnet die Wahl von Team und Farbe) und zwei gleich große, nur umrandete Tasten
 *   „Bestätigen“ und „Keine Leibchen“; ohne passende Farbe „Kein passendes Leibchen vorhanden“ mit „Keine Leibchen“ und „Andere Farbe …“.
 * - `zeile`: nach dem Tipp die kleine Zeile „… · Ändern“ mit Leibchen-Zeichen, dazu „wird gesendet“ / „gesendet“ (@SL-230); „Ändern“ öffnet die Karte.
 * - `festlegen`: ohne Farbgleichheit nur die kleine Taste „Leibchen festlegen“ (@SL-148).
 * - `lesen`: ein Gerät ohne Steuerung sieht Karte bzw. Zeile ohne Tasten und das Angebot, das Feld zu übernehmen (@SL-202, @SL-213).
 * Die Wahl ändert nur den Vorschlag; erst „Bestätigen“ stellt die Anzeige um. Rein darstellend, der Aufrufer hält die Daten.
 */
import { useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { KitSide } from '../../../core/models/kit';
import { leibchenFarbName, type TrikotFarben } from '../../../core/models/kitChoice';
import type { KitProposal } from '../../../core/models/kitProposal';
import { Icons } from '../Icons';
import { MatchIcons } from '../IconsMatch';
import { LeibchenWahlFelder } from './LeibchenWahlFelder';

export type LeibchenAuswahl = { art: 'bestaetigt'; seite: KitSide; farbe: string } | { art: 'keine' };

export interface LeibchenKarteProps {
  teams: { a: string; b: string };
  trikot: TrikotFarben;
  hallenFarben: readonly string[];
  /** Was Tom schon getippt hat; `null` = offen (Karte bzw. „Leibchen festlegen“). */
  gewaehlt: LeibchenAuswahl | null;
  vorschlag: KitProposal | null;
  /** Ohne Farbgleichheit: nur die kleine Taste, die Karte erst nach einem Tipp. */
  nurFestlegen: boolean;
  senden: 'pending' | 'sent' | null;
  lesen: boolean;
  onUebernehmen?: (() => void) | undefined;
  onBestaetigen: (seite: KitSide, farbe: string) => void;
  onKeine: () => void;
  /** Die Wahl von Team und Farbe ist auf- oder zugeklappt (am Handy weichen dann Tafel und Einträge). */
  onWahlOffen?: ((offen: boolean) => void) | undefined;
  /** Nummer des Spiels, für das die Karte gilt (im Endstand das NÄCHSTE Spiel, @SL-215); fehlt sie, steht die Überschrift ohne Nummer. */
  spielNummer?: number | undefined;
  testIdPrefix?: string;
}

const flaeche: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm, padding: cssVars.spacing.sm, background: cssVars.colors.surface,
  borderTop: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, minWidth: 0,
};
/** Die Karte als Handlungsfläche (Mockup Runde 3): getönt mit Rahmen; die Zeile danach ist unauffällig. */
const karteFlaeche: CSSProperties = {
  ...flaeche, background: cssVars.colors.warningSubtle, border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.warningBorder}`, borderRadius: cssVars.borderRadius.md,
  margin: `${cssVars.spacing.xs} ${cssVars.spacing.xs} 0`,
};
const ueberschriftStil: CSSProperties = {
  margin: 0, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const wTeil = (farbe: string): CSSProperties => ({ position: 'absolute', top: 0, bottom: 0, left: '30%', right: '30%', background: farbe });
const wRahmen = (trikot: string): CSSProperties => ({
  position: 'relative', overflow: 'hidden', flex: 'none', width: cssVars.spacing.xl, height: cssVars.spacing.lg, borderRadius: cssVars.borderRadius.sm,
  background: trikot, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
});
/** Kleines Westen-Bild: Trikotfarbe außen, Leibchenfarbe in der Mitte (dekorativ, der Satz daneben nennt Team und Farbe). */
function MiniWeste({ trikot, farbe }: { trikot: string | undefined; farbe: string }): ReactElement {
  return <span style={wRahmen(trikot ?? cssVars.colors.surfaceDarkMedium)} aria-hidden="true" data-testid="leibchen-weste"><i style={wTeil(farbe === '' ? cssVars.colors.background : farbe)} /></span>;
}

const taste: CSSProperties = {
  flex: '1 1 0', minWidth: 0, minHeight: cssVars.touchTargets.primary, height: cssVars.touchTargets.primary, background: 'transparent', color: cssVars.colors.textPrimary,
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.md, fontFamily: 'inherit',
  fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold, cursor: 'pointer',
};
const klein: CSSProperties = {
  minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum, background: 'transparent', color: cssVars.colors.textPrimary,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.md, fontFamily: 'inherit',
  fontSize: cssVars.fontSizes.md, cursor: 'pointer', padding: `0 ${cssVars.spacing.md}`,
};
const vorschlagKnopf: CSSProperties = {
  ...klein, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, width: '100%', textAlign: 'left',
  fontWeight: cssVars.fontWeights.semibold, background: cssVars.colors.background,
};

export function LeibchenKarte(p: LeibchenKarteProps): ReactElement | null {
  const { t } = useTranslation('cockpit');
  const prefix = p.testIdPrefix ?? 'leibchen';
  const [offen, setOffen] = useState(false);
  const [aendern, setAendern] = useState(false);
  const zuletzt = useRef(0); // Zeitpunkt des letzten Tipps auf „Bestätigen“/„Keine Leibchen“: ein Doppeltipp öffnet die Zeile nicht wieder (@SL-221)
  const [entwurf, setEntwurf] = useState<{ seite: KitSide; farbe: string } | null>(null);
  const setzeOffen = (wert: boolean): void => { setOffen(wert); p.onWahlOffen?.(wert); };
  const name = (farbe: string): string => t(`anpfiff.farbe.${leibchenFarbName(farbe) ?? 'turnier'}`);
  const team = (seite: KitSide): string => (seite === 'a' ? p.teams.a : p.teams.b);
  const satz = (seite: KitSide, farbe: string): string => (farbe === '' ? `${team(seite)} …` : t('leibchenKarte.zieht', { team: team(seite), farbe: name(farbe) }));
  const status = p.senden === null ? null : p.senden === 'pending' ? t('leibchenKarte.wirdGesendet') : t('leibchenKarte.gesendet');

  // Zeile nach dem Tipp
  if (p.gewaehlt !== null && !aendern) {
    const text = p.gewaehlt.art === 'keine' ? t('leibchenKarte.keine') : satz(p.gewaehlt.seite, p.gewaehlt.farbe);
    return (
      <div style={{ ...flaeche, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }} data-testid={`${prefix}-zeile`} data-art={p.gewaehlt.art}>
        <MatchIcons.Shirt />
        <span style={{ flex: '1 1 0', minWidth: 0, fontSize: cssVars.fontSizes.md }}>{text}</span>
        {status !== null && (
          <span style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.xs }} data-testid={`${prefix}-status`} data-status={p.senden}>
            {p.senden === 'sent' && <Icons.Check size={iconSizeValues.sm} />}{status}
          </span>
        )}
        {p.lesen ? (
          p.onUebernehmen !== undefined && <button type="button" style={klein} onClick={p.onUebernehmen} data-testid={`${prefix}-uebernehmen`}>{t('leibchenKarte.uebernehmen')}</button>
        ) : (
          <button type="button" style={klein} onClick={() => { if (Date.now() - zuletzt.current >= 1000) { setAendern(true); } }} data-testid={`${prefix}-aendern`}>{t('leibchenKarte.aendern')}</button>
        )}
      </div>
    );
  }

  const vorbelegt: { seite: KitSide; farbe: string } | null = aendern && p.gewaehlt?.art === 'bestaetigt'
    ? { seite: p.gewaehlt.seite, farbe: p.gewaehlt.farbe }
    : p.vorschlag?.kind === 'vorschlag' ? { seite: p.vorschlag.seite, farbe: p.vorschlag.farbe } : null;
  const aktuell = entwurf ?? vorbelegt;

  if (p.gewaehlt === null && p.nurFestlegen && !aendern) {
    if (p.lesen) { return null; }
    return (
      <div style={{ ...flaeche, alignItems: 'flex-start' }}>
        <button type="button" style={klein} onClick={() => { setAendern(true); }} data-testid={`${prefix}-festlegen`}>
          <MatchIcons.Shirt /> {t('leibchenKarte.festlegen')}
        </button>
      </div>
    );
  }
  if (p.vorschlag === null && aktuell === null && !aendern) { return null; }

  const keinPassendes = p.vorschlag?.kind === 'keinPassendes' && entwurf === null && !aendern;
  const regelSeite: KitSide = p.vorschlag?.seite ?? 'a';
  const schliesse = (): void => { setAendern(false); setEntwurf(null); setzeOffen(false); };

  return (
    <div style={karteFlaeche} data-leibchen-flaeche="" role="group" aria-label={t('leibchenKarte.gruppeAria')} data-testid={`${prefix}-karte`}>
      <p style={ueberschriftStil} data-testid={`${prefix}-ueberschrift`}>{p.spielNummer === undefined ? t('leibchenKarte.ueberschriftOhneNummer') : t('leibchenKarte.ueberschrift', { nummer: p.spielNummer })}</p>
      {keinPassendes ? (
        <p style={{ margin: 0, fontWeight: cssVars.fontWeights.semibold }} data-testid={`${prefix}-kein-passendes`}>
          <Icons.AlertTriangle size={iconSizeValues.sm} /> {t('leibchenKarte.keinPassendes')}
        </p>
      ) : aktuell !== null && (
        <button type="button" style={vorschlagKnopf} aria-expanded={offen} aria-label={`${satz(aktuell.seite, aktuell.farbe)}. ${t('leibchenKarte.aendernVorschlag')}`}
          disabled={p.lesen} onClick={() => { if (offen) { setEntwurf(null); } setzeOffen(!offen); }} data-testid={`${prefix}-vorschlag`}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: cssVars.spacing.sm, minWidth: 0 }}><MiniWeste trikot={p.trikot[aktuell.seite]} farbe={aktuell.farbe} />{satz(aktuell.seite, aktuell.farbe)}</span>
          {!p.lesen && <span style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>{t('leibchenKarte.aendernVorschlag')} {offen ? '▴' : '▾'}</span>}
        </button>
      )}
      {(offen || (keinPassendes && offen)) && !p.lesen && (
        <LeibchenWahlFelder teams={p.teams} seite={(entwurf ?? aktuell ?? { seite: regelSeite }).seite} farbe={(entwurf ?? aktuell ?? { farbe: '' }).farbe ?? ''}
          hallenFarben={p.hallenFarben} trikot={p.trikot} andereOffen={p.vorschlag?.kind === 'keinPassendes'} testIdPrefix={prefix}
          onSeite={(seite) => { setEntwurf({ seite, farbe: (entwurf ?? aktuell)?.farbe ?? '' }); }}
          onFarbe={(farbe) => { setEntwurf({ seite: (entwurf ?? aktuell)?.seite ?? regelSeite, farbe }); }} />
      )}
      {p.lesen ? (
        <p style={{ margin: 0, fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }} data-testid={`${prefix}-nur-lesen`}>
          {t('leibchenKarte.nurLesen')}
          {p.onUebernehmen !== undefined && <button type="button" style={{ ...klein, marginLeft: cssVars.spacing.sm }} onClick={p.onUebernehmen} data-testid={`${prefix}-uebernehmen`}>{t('leibchenKarte.uebernehmen')}</button>}
        </p>
      ) : (
        <div style={{ display: 'flex', gap: cssVars.spacing.sm }}>
          {!keinPassendes && (
            <button type="button" style={taste} data-testid={`${prefix}-bestaetigen`} disabled={aktuell === null || aktuell.farbe === ''}
              onClick={() => { if (aktuell !== null && aktuell.farbe !== '') { zuletzt.current = Date.now(); p.onBestaetigen(aktuell.seite, aktuell.farbe); schliesse(); } }}>
              {t('leibchenKarte.bestaetigen')}
            </button>
          )}
          {keinPassendes && (
            <button type="button" style={taste} data-testid={`${prefix}-andere-farbe`} onClick={() => { setEntwurf({ seite: regelSeite, farbe: '' }); setzeOffen(true); }}>
              {t('leibchenKarte.andere')}
            </button>
          )}
          <button type="button" style={taste} data-testid={`${prefix}-keine`} onClick={() => { zuletzt.current = Date.now(); p.onKeine(); schliesse(); }}>{t('leibchenKarte.keine')}</button>
        </div>
      )}
    </div>
  );
}
