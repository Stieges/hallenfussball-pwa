/**
 * LeibchenWahlFelder – die Wahl von Team und Farbe der Leibchen-Karte (@SL-218, @SL-219, @SL-231): zuerst die Hallenfarben als große Tasten und
 * „Andere Farbe …“, darunter die Grundauswahl aus 8 Farben. Jede Farbe trägt ihren Namen als Wort, die gewählte einen Haken, eine dem eigenen Trikot
 * oder dem Gegner zu ähnliche Farbe ein Warnzeichen mit Wort („Wie Trikot“, „Gleich hell“, „Wie Gegner“). Alle Tippziele mindestens 44 Bildpunkte.
 * Rein darstellend: die Wahl hält der Aufrufer (`seite`, `farbe`); bestätigt wird erst auf der Karte.
 */
import { useState, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { KitSide } from '../../../core/models/kit';
import {
  leibchenFarbName, leibchenGegenGegnerHinweis, leibchenWieEigenesTrikot, type LeibchenFarbHinweis, type TrikotFarben,
} from '../../../core/models/kitChoice';
import { wahlFarben } from '../../../core/models/kitProposal';
import { ChipButton } from '../atoms/ChipButton';
import { Icons } from '../Icons';

export interface LeibchenWahlFelderProps {
  teams: { a: string; b: string };
  seite: KitSide;
  farbe: string;
  hallenFarben: readonly string[];
  trikot: TrikotFarben;
  onSeite: (seite: KitSide) => void;
  onFarbe: (farbe: string) => void;
  /** „Andere Farbe …“ von Anfang an offen (Karte „Kein passendes Leibchen“). */
  andereOffen?: boolean;
  testIdPrefix: string;
}

const reihe: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.xs };
const teamZeile = (gewaehlt: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, width: '100%', minHeight: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.md}`, textAlign: 'left', fontFamily: 'inherit', fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.bold,
  color: cssVars.colors.textPrimary, background: cssVars.colors.background, cursor: 'pointer', borderRadius: cssVars.borderRadius.md,
  border: `${gewaehlt ? cssVars.borderWidth.medium : cssVars.borderWidth.thin} solid ${gewaehlt ? cssVars.colors.textPrimary : cssVars.colors.borderControl}`,
});
const linkTaste: CSSProperties = {
  alignSelf: 'flex-start', minHeight: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.xs}`, background: 'transparent', border: 'none',
  color: cssVars.colors.primary, fontFamily: 'inherit', fontSize: cssVars.fontSizes.md, textDecoration: 'underline', cursor: 'pointer',
};
const beschriftung: CSSProperties = { fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary, margin: 0 };
const punkt = (farbe: string): CSSProperties => ({
  width: cssVars.spacing.md, height: cssVars.spacing.md, borderRadius: cssVars.borderRadius.full, background: farbe,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, flex: 'none',
});

export function LeibchenWahlFelder(p: LeibchenWahlFelderProps): ReactElement {
  const { t } = useTranslation('cockpit');
  const [andere, setAndere] = useState(p.andereOffen === true);
  const { halle, weitere } = wahlFarben(p.hallenFarben);
  const name = (farbe: string): string => t(`anpfiff.farbe.${leibchenFarbName(farbe) ?? 'turnier'}`);

  const hinweisVon = (farbe: string): { art: LeibchenFarbHinweis; gegner: boolean } => {
    const eigen = leibchenWieEigenesTrikot(p.trikot, p.seite, farbe);
    if (eigen !== 'none') { return { art: eigen, gegner: false }; }
    const gegner = leibchenGegenGegnerHinweis(p.trikot, p.seite, farbe);
    return { art: gegner === 'aehnlich' ? 'aehnlich' : 'none', gegner: gegner === 'aehnlich' };
  };
  const hinweisText = (farbe: string, gross: boolean): string | null => {
    const h = hinweisVon(farbe);
    if (h.art === 'none') { return null; }
    if (h.gegner) { return t('leibchenKarte.wieGegner'); }
    if (h.art === 'gleichHell') { return t('leibchenKarte.gleichHell'); }
    return gross ? t('leibchenKarte.aehnlichWieTrikot') : t('leibchenKarte.wieTrikot');
  };
  const eigen = p.seite === 'a' ? p.teams.a : p.teams.b;
  const gegnerName = p.seite === 'a' ? p.teams.b : p.teams.a;
  /** Vorgelesen mit vollem Satz (@SL-231, @SL-151): „… – zu ähnlich wie das Trikot von <Gegner>“ bzw. „… – sieht aus wie das eigene Trikot von <Team>“. */
  const vollerSatz = (farbe: string): string | null => {
    const h = hinweisVon(farbe);
    if (h.art === 'none') { return null; }
    if (h.gegner) { return t('anpfiff.farbeZuAehnlich', { farbe: name(farbe), gegner: gegnerName }); }
    return t(h.art === 'gleichHell' ? 'leibchenKarte.gleichHellVon' : 'leibchenKarte.eigenesTrikotVon', { farbe: name(farbe), team: eigen });
  };
  const farbTaste = (farbe: string, gross: boolean): ReactElement => {
    const gewaehlt = p.farbe === farbe;
    const warnung = hinweisText(farbe, gross);
    return (
      <ChipButton key={farbe} selected={gewaehlt} size="minimum" onClick={() => { p.onFarbe(farbe); }}
        aria-label={vollerSatz(farbe) ?? t('leibchenKarte.farbeAria', { farbe: name(farbe) })}
        data-testid={`${p.testIdPrefix}-farbe-${leibchenFarbName(farbe) ?? 'turnier'}`}>
        <span style={punkt(farbe)} aria-hidden="true" />
        {name(farbe)}
        {warnung !== null && <><Icons.AlertTriangle size={iconSizeValues.sm} /><span data-testid={`${p.testIdPrefix}-warnung`}>{warnung}</span></>}
      </ChipButton>
    );
  };
  // Der volle Satz steht erst nach der Wahl unter der Auswahl (@SL-231): eigenes Trikot oder Gegner
  const wahl = hinweisVon(p.farbe);
  const satz = p.farbe === '' || wahl.art !== 'aehnlich' ? null : wahl.gegner ? t('anpfiff.farbeZuAehnlich', { farbe: name(p.farbe), gegner: gegnerName }) : t('leibchenKarte.warnungEigenesTrikot');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm }} data-testid={`${p.testIdPrefix}-wahl`}>
      <p style={beschriftung}>{t('leibchenKarte.teamFrage')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.xs }} role="group" aria-label={t('leibchenKarte.teamFrage')}>
        {(['a', 'b'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={p.seite === s} style={teamZeile(p.seite === s)} onClick={() => { p.onSeite(s); }} data-testid={`${p.testIdPrefix}-team-${s === 'a' ? 'heim' : 'gast'}`}>
            <span>{s === 'a' ? p.teams.a : p.teams.b}</span>{p.seite === s && <Icons.Check size={iconSizeValues.md} />}
          </button>
        ))}
      </div>
      <p style={beschriftung}>{t('leibchenKarte.farbe')}</p>
      <div style={reihe} role="group" aria-label={t('leibchenKarte.farbe')}>
        {halle.map((f) => farbTaste(f, true))}
      </div>
      <button type="button" style={linkTaste} aria-expanded={andere} onClick={() => { setAndere(!andere); }} data-testid={`${p.testIdPrefix}-andere`}>{t('leibchenKarte.andere')}</button>
      {andere && <div style={reihe} role="group" aria-label={t('leibchenKarte.andere')}>{weitere.map((f) => farbTaste(f, false))}</div>}
      {satz !== null && <p style={{ ...beschriftung, color: cssVars.colors.textPrimary }} role="status" data-testid={`${p.testIdPrefix}-satz`}>{satz}</p>}
    </div>
  );
}
