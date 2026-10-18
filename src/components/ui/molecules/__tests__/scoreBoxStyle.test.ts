/**
 * Aufgabe 2.2 (Spielanzeige): Farb- und Rahmenregeln des Ergebniskastens – reine Funktionen.
 * Werte aus dem Gherkin: @ZM-156 (Verlierer 30 % gedämpft, Ziffern ≥ 4,5 : 1), @ZM-160 (Kontrastregeln), @ZM-140 Zeile 2
 * (Schwarz mit hellem Rahmen), @ZM-161 (Weste: Mitte und Streifen zählen), RF5 (weißer Kasten auf hellem Grund).
 */
import { describe, expect, it } from 'vitest';
import { BOX_BLACK, BOX_WHITE, type BoxFill } from '../../../../core/models/scoreBoxColors';
import { DEFAULT_AWAY_BOX_COLOR, DEFAULT_HOME_BOX_COLOR } from '../../../../core/models/spectatorDisplay';
import { displayLayout, monitorThemes } from '../../../../design-tokens';
import { getContrastRatio } from '../../../../design-tokens/display';
import { mixHex } from '../../../../design-tokens/displayColor';
import { digitColor, effectiveDigitBackground, LOSER_DIM_SHARE, needsStrongFrame } from '../scoreBoxStyle';

const solid = (color: string): BoxFill => ({ kind: 'solid', color });
const vest = (center: string, stripes: string): BoxFill => ({ kind: 'vest', center, stripes });

const HELL = '#FFFFFF';
const DUNKEL = monitorThemes.dark.background;

const GELB = '#FFCC00';
const ROT = '#DC0000';
const BLAU = '#0033CC';
const GRUEN = '#009933';
const GRAUVIOLETT = '#736469';
const NAVY = '#0D1B4C';
const PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['Standardfarbe Heim Blau', DEFAULT_HOME_BOX_COLOR],
  ['Standardfarbe Gast Rot', DEFAULT_AWAY_BOX_COLOR],
  ['Gelb', GELB],
  ['Rot', ROT],
  ['Blau', BLAU],
  ['Grün', GRUEN],
  ['Weiß', BOX_WHITE],
  ['Schwarz', BOX_BLACK],
  ['Grauviolett', GRAUVIOLETT],
  ['Navy', NAVY],
];

describe('LOSER_DIM_SHARE', () => {
  it('@ZM-156 der Anteil kommt aus dem Token loserDimShare („30%“) und ist die Zahl 0,3 (B4)', () => {
    expect(displayLayout.scoreArea.loserDimShare).toBe('30%');
    expect(LOSER_DIM_SHARE).toBe(parseFloat(displayLayout.scoreArea.loserDimShare) / 100);
    expect(LOSER_DIM_SHARE).toBeCloseTo(0.3, 10);
  });
});

describe('effectiveDigitBackground', () => {
  it('@ZM-156 Verlierer behält den Farbton: gedämpft = mixHex(Farbe, Hintergrund, LOSER_DIM_SHARE)', () => {
    expect(effectiveDigitBackground(solid('#1565C0'), 'loser', HELL)).toBe(mixHex('#1565C0', HELL, LOSER_DIM_SHARE));
    expect(effectiveDigitBackground(solid('#1565C0'), 'loser', HELL)).toBe('#5B93D3');
  });

  it('@ZM-156 Gegenbeispiel: Sieger und ohne Ergebnis bleiben ungedämpft', () => {
    expect(effectiveDigitBackground(solid('#1565C0'), 'winner', HELL)).toBe('#1565C0');
    expect(effectiveDigitBackground(solid('#1565C0'), undefined, HELL)).toBe('#1565C0');
  });

  it('@ZM-161 bei der Weste zählt die Mitte, nicht der Streifen', () => {
    expect(effectiveDigitBackground(vest(GELB, ROT), undefined, HELL)).toBe(GELB);
    expect(effectiveDigitBackground(vest(GELB, ROT), 'loser', HELL)).toBe(mixHex(GELB, HELL, LOSER_DIM_SHARE));
  });
});

describe('digitColor', () => {
  it('@ZM-156 Verlierer Blau #1565C0 auf hellem Grund: Ziffern schwarz (gedämpft 6,56 : 1 statt 3,2 : 1)', () => {
    const gedaempft = effectiveDigitBackground(solid('#1565C0'), 'loser', HELL);
    expect(digitColor(solid('#1565C0'), 'loser', HELL)).toBe(BOX_BLACK);
    expect(getContrastRatio(gedaempft, BOX_BLACK)).toBeCloseTo(6.56, 1);
    expect(getContrastRatio(gedaempft, BOX_WHITE)).toBeLessThan(4.5);
  });

  it('@ZM-156 Gegenbeispiel: derselbe Kasten als Sieger (nicht gedämpft) hat weiße Ziffern', () => {
    expect(digitColor(solid('#1565C0'), 'winner', HELL)).toBe(BOX_WHITE);
    expect(digitColor(solid('#1565C0'), undefined, HELL)).toBe(BOX_WHITE);
  });

  it('@ZM-156 auf dunklem Grund bleibt der gedämpfte Blau-Kasten dunkel genug für weiße Ziffern', () => {
    expect(digitColor(solid('#1565C0'), 'loser', DUNKEL)).toBe(BOX_WHITE);
  });

  it.each(PALETTE.flatMap(([name, color]) => [HELL, DUNKEL].flatMap((grund) => [undefined, 'winner', 'loser'].map((outcome) => [name, color, grund, outcome] as const))))(
    '@ZM-160 Ziffern auf %s (%s) auf Grund %s, Ergebnis %s: mindestens 4,5 : 1 auf der wirksamen Farbe',
    (_name, color, grund, outcome) => {
      const out = outcome as 'winner' | 'loser' | undefined;
      const wirksam = effectiveDigitBackground(solid(color), out, grund);
      expect(getContrastRatio(wirksam, digitColor(solid(color), out, grund))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('@ZM-161 Weste: die Ziffer richtet sich nach der Mitte (Gelb → schwarz), obwohl die Streifen dunkel sind', () => {
    expect(digitColor(vest(GELB, '#000000'), undefined, HELL)).toBe(BOX_BLACK);
    expect(digitColor(vest(ROT, GELB), undefined, HELL)).toBe(BOX_WHITE);
  });
});

describe('needsStrongFrame', () => {
  it('@ZM-140 Schwarz auf dunklem Monitor: kräftiger Rahmen (Zeile „Schwarz gegen Weiß“: Schwarz mit hellem Rahmen)', () => {
    expect(needsStrongFrame(solid(BOX_BLACK), DUNKEL)).toBe(true);
  });

  it('@ZM-140 Gegenbeispiel: Schwarz auf hellem Grund hebt sich ab, kein kräftiger Rahmen', () => {
    expect(needsStrongFrame(solid(BOX_BLACK), HELL)).toBe(false);
  });

  it('RF5 weißer Kasten auf hellem Grund: kräftiger Rahmen; Gegenbeispiel Weiß auf dunklem Grund: keiner', () => {
    expect(needsStrongFrame(solid(BOX_WHITE), HELL)).toBe(true);
    expect(needsStrongFrame(solid(BOX_WHITE), DUNKEL)).toBe(false);
  });

  it('@ZM-161 Weste: reicht die Mitte, aber nicht der Streifen (< 3 : 1), gibt es den Rahmen', () => {
    expect(needsStrongFrame(solid(GELB), DUNKEL)).toBe(false);
    expect(needsStrongFrame(vest(GELB, BOX_BLACK), DUNKEL)).toBe(true);
  });

  it('@ZM-161 Weste: reicht der Streifen, aber nicht die Mitte, gibt es den Rahmen', () => {
    expect(needsStrongFrame(vest(BOX_BLACK, GELB), DUNKEL)).toBe(true);
  });

  it('@ZM-161 Gegenbeispiel: Weste mit Mitte und Streifen ≥ 3 : 1 hat keinen kräftigen Rahmen', () => {
    expect(needsStrongFrame(vest(GELB, '#FF8800'), DUNKEL)).toBe(false);
  });

  it('@ZM-156 gedämpfter Verlierer: Blau #1565C0 hebt sich auf dunklem Grund (3,1 : 1) ab, gedämpft (2,2 : 1) nicht mehr', () => {
    expect(needsStrongFrame(solid('#1565C0'), DUNKEL)).toBe(false);
    expect(needsStrongFrame(solid('#1565C0'), DUNKEL, 'winner')).toBe(false);
    expect(needsStrongFrame(solid('#1565C0'), DUNKEL, 'loser')).toBe(true);
  });
});
