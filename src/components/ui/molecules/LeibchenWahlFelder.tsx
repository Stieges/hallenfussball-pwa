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
  const farbTaste = (farbe: string, gross: boolean): ReactElement => {
    const gewaehlt = p.farbe === farbe;
    const warnung = hinweisText(farbe, gross);
    return (
      <ChipButton key={farbe} selected={gewaehlt} size="minimum" onClick={() => { p.onFarbe(farbe); }}
        aria-label={warnung === null ? t('leibchenKarte.farbeAria', { farbe: name(farbe) }) : t('leibchenKarte.farbeWarnAria', { farbe: name(farbe), warnung })}
        data-testid={`${p.testIdPrefix}-farbe-${leibchenFarbName(farbe) ?? 'turnier'}`}>
        <span style={punkt(farbe)} aria-hidden="true" />
        {name(farbe)}
        {warnung !== null && <><Icons.AlertTriangle size={iconSizeValues.sm} /><span data-testid={`${p.testIdPrefix}-warnung`}>{warnung}</span></>}
      </ChipButton>
    );
  };
  const satz = hinweisVon(p.farbe).art === 'aehnlich' && !hinweisVon(p.farbe).gegner ? t('leibchenKarte.warnungEigenesTrikot') : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.sm }} data-testid={`${p.testIdPrefix}-wahl`}>
      <p style={beschriftung}>{t('leibchenKarte.team')}</p>
      <div style={reihe} role="group" aria-label={t('leibchenKarte.team')}>
        {(['a', 'b'] as const).map((s) => (
          <ChipButton key={s} selected={p.seite === s} size="minimum" onClick={() => { p.onSeite(s); }} data-testid={`${p.testIdPrefix}-team-${s === 'a' ? 'heim' : 'gast'}`}>
            {s === 'a' ? p.teams.a : p.teams.b}
          </ChipButton>
        ))}
      </div>
      <p style={beschriftung}>{t('leibchenKarte.farbe')}</p>
      <div style={reihe} role="group" aria-label={t('leibchenKarte.farbe')}>
        {halle.map((f) => farbTaste(f, true))}
        <ChipButton selected={andere} size="minimum" onClick={() => { setAndere(!andere); }} data-testid={`${p.testIdPrefix}-andere`}>{t('leibchenKarte.andere')}</ChipButton>
      </div>
      {andere && <div style={reihe} role="group" aria-label={t('leibchenKarte.andere')}>{weitere.map((f) => farbTaste(f, false))}</div>}
      {satz !== null && <p style={{ ...beschriftung, color: cssVars.colors.textPrimary }} role="status" data-testid={`${p.testIdPrefix}-satz`}>{satz}</p>}
    </div>
  );
}
