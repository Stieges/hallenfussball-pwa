/**
 * Spielanzeige 2.3: Der Monitor liest die Kastenfarbe aus der Ansicht (`MatchView.boxes`), nicht mehr aus einer Farbe je Folie.
 * @ZM-159 Fälle A, B, C · @ZM-153 (Gast weicht auf Weiß aus) · @ZM-154 (Teamfarben aus) · @ZM-152 (keine Farbe je Folie)
 * Spiel 7 läuft auf Feld 1: FC Nord (Heim) – SV Süd (Gast). Getragene Farben kommen aus `match.kit` (beim Anpfiff festgehalten).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveSlide } from '../slides/LiveSlide';
import type { PerformanceSettings, SlideConfig } from '../../../types/monitor';
import type { SpectatorDisplaySettings } from '../../../core/models/spectatorDisplay';
import type { MatchKit } from '../../../core/models/kit';
import { buildTournament, slide, withMatch } from './monitorFixture';
import { withView } from './monitorViewHelper';
import { palette } from '../../../design-tokens/colors/palette';

const performanceSettings = {} as PerformanceSettings;
const VORBELEGUNG: SpectatorDisplaySettings = { teamColors: true, homeColor: palette.kit.blue, awayColor: palette.kit.red };

const BLAU = palette.kit.blue;
const ROT = palette.kit.red;
const GELB = palette.yellow[400];
const WEISS = palette.neutral[0];
const GRAUVIOLETT = '#736469';

function zeigeSpiel7(kit: MatchKit | undefined, spectatorDisplay: SpectatorDisplaySettings | undefined = VORBELEGUNG, config: SlideConfig = { fieldId: 'field-1' }) {
  const tournament = buildTournament({
    matches: withMatch('match-7', kit === undefined ? {} : { kit }),
    ...(spectatorDisplay === undefined ? {} : { spectatorDisplay }),
  });
  return render(
    <LiveSlide slide={slide('live', config)} {...withView(tournament)} performanceSettings={performanceSettings} theme="dark" style={{}} />,
  );
}

const heim = () => document.querySelector<HTMLElement>('[data-position="home"]');
const gast = () => document.querySelector<HTMLElement>('[data-position="away"]');

describe('@ZM-159 Farbe der Kästen am Monitor Feld 1 (Fälle A, B, C)', () => {
  it.each([
    ['A keine Farbe / keine Farbe', undefined, BLAU, ROT],
    ['B keine Farbe / Gelb', { b: GELB }, BLAU, GELB],
    ['B keine Farbe / Blau (Heim weicht auf die Standardfarbe Gast aus)', { b: BLAU }, ROT, BLAU],
    ['B keine Farbe / Grauviolett (Heim weiß, weil weiter weg als Schwarz)', { b: GRAUVIOLETT }, WEISS, GRAUVIOLETT],
    ['C Gelb / Blau', { a: GELB, b: BLAU }, GELB, BLAU],
  ] as const)('@ZM-159 Fall %s', (_name, kit, kastenHeim, kastenGast) => {
    zeigeSpiel7(kit);
    expect(heim()).toHaveStyle({ backgroundColor: kastenHeim });
    expect(gast()).toHaveStyle({ backgroundColor: kastenGast });
  });

  it('@ZM-159 Gegenbeispiel: Fall C ist nicht Fall A – mit Teamfarben steht Gelb im Kasten, nicht die Standardfarbe Heim', () => {
    zeigeSpiel7({ a: GELB, b: BLAU });
    expect(heim()).not.toHaveStyle({ backgroundColor: BLAU });
  });
});

describe('@ZM-153 Standardfarben zu ähnlich: Gast-Kasten am Monitor weiß', () => {
  const NAVY = palette.kit.navy;
  it('@ZM-153 Blau/Navy, Spiel ohne Teamfarben: Heim Blau, Gast Weiß', () => {
    zeigeSpiel7(undefined, { teamColors: true, homeColor: BLAU, awayColor: NAVY });
    expect(heim()).toHaveStyle({ backgroundColor: BLAU });
    expect(gast()).toHaveStyle({ backgroundColor: WEISS });
  });

  it('@ZM-153 Gegenbeispiel Blau/Rot: Gast bleibt Rot', () => {
    zeigeSpiel7(undefined, { teamColors: true, homeColor: BLAU, awayColor: ROT });
    expect(gast()).toHaveStyle({ backgroundColor: ROT });
  });

  it('RF2 Blau/Blau: Gast-Kasten weicht auf Weiß aus', () => {
    zeigeSpiel7(undefined, { teamColors: true, homeColor: BLAU, awayColor: BLAU });
    expect(gast()).toHaveStyle({ backgroundColor: WEISS });
  });
});

describe('@ZM-154 Ohne Teamfarben tragen die Kästen die Standardfarben', () => {
  const GRUEN = '#2E7D32';
  const SCHWARZ = palette.kit.black;
  it('@ZM-154 ausgeschaltet: Heim Standardfarbe Heim (Blau), Gast ganz Standardfarbe Gast (Rot), ohne Weste', () => {
    zeigeSpiel7({ a: GRUEN, b: SCHWARZ, bibSide: 'b' }, { ...VORBELEGUNG, teamColors: false });
    expect(heim()).toHaveStyle({ backgroundColor: BLAU });
    expect(gast()).toHaveStyle({ backgroundColor: ROT });
  });

  it('@ZM-154 Gegenbeispiel Vorbelegung (an): Heim Grün, Gast Schwarz (Weste, bis 3.2 mit der Mitte als Fläche)', () => {
    zeigeSpiel7({ a: GRUEN, b: SCHWARZ, bibSide: 'b' });
    expect(heim()).toHaveStyle({ backgroundColor: GRUEN });
    expect(gast()).not.toHaveStyle({ backgroundColor: ROT });
  });

  it('@ZM-154 beide Fälle: Kasten gleich groß und gleich gelegen (feste Zellen aus dem Token)', () => {
    const { unmount } = zeigeSpiel7(undefined);
    const an = [screen.getByTestId('live-block-home').style.cssText, screen.getByTestId('live-block-away').style.cssText];
    unmount();
    zeigeSpiel7(undefined, { ...VORBELEGUNG, teamColors: false });
    expect([screen.getByTestId('live-block-home').style.cssText, screen.getByTestId('live-block-away').style.cssText]).toEqual(an);
  });
});

describe('@ZM-152 Die Folie hat keine eigene Farbe mehr', () => {
  it('@ZM-152 ein Altschlüssel liveColorScheme an der Folie ändert die Kästen nicht', () => {
    const alt = { fieldId: 'field-1', liveColorScheme: { preset: 'custom', homeColor: '#FDE047', awayColor: palette.kit.black, useTeamColors: false } } as unknown as SlideConfig;
    zeigeSpiel7(undefined, VORBELEGUNG, alt);
    expect(heim()).toHaveStyle({ backgroundColor: BLAU });
    expect(gast()).toHaveStyle({ backgroundColor: ROT });
  });
});
