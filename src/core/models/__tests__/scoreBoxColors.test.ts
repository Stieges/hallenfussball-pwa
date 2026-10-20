/**
 * Aufgabe 2.1 (Spielanzeige): Farbregel der Ergebniskästen, Fälle A–D2 (@ZM-159), getragene Farbe und Weste (@ZM-140,
 * @ZM-161), Standardfarben (@ZM-153), Teamfarben aus (@ZM-154), RF1/RF2 aus dem Review Focus.
 * Testwerte aus dem Gherkin von docs/anforderungen/2026-10-02_zuschauer-und-monitor.md; „zu ähnlich“ = ΔE2000 < 30.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BIB_COLOR, KIT_SIMILAR_DELTA_E, kitConflict } from '../kit';
import { hexDeltaE2000 } from '../kitColorDistance';
import { resolveBoxColors, whiteOrBlackFarthestFrom, type BoxColorInput, type BoxFill } from '../scoreBoxColors';
import { DEFAULT_AWAY_BOX_COLOR, DEFAULT_HOME_BOX_COLOR, DEFAULT_SPECTATOR_DISPLAY, type SpectatorDisplaySettings } from '../spectatorDisplay';
import { palette } from '../../../design-tokens/colors/palette';

const GELB = '#FFCC00';
const ROT = '#DC0000';
const BLAU = '#0033CC';
const GRUEN = '#009933';
const WEISS = palette.neutral[0];
const SCHWARZ = palette.kit.black;
const GRAUVIOLETT = '#736469';
const NAVY = palette.kit.navy;
const BLAU_STD = DEFAULT_HOME_BOX_COLOR;
const ROT_STD = DEFAULT_AWAY_BOX_COLOR;

const solid = (color: string): BoxFill => ({ kind: 'solid', color });
const vest = (center: string, stripes: string): BoxFill => ({ kind: 'vest', center, stripes });
const settings = (patch: Partial<SpectatorDisplaySettings> = {}): SpectatorDisplaySettings => ({ ...DEFAULT_SPECTATOR_DISPLAY, ...patch });
const resolve = (worn: BoxColorInput['worn'], extra: Partial<BoxColorInput> = {}) =>
  resolveBoxColors({ worn, settings: settings(), ...extra });
/** Gherkin nennt Abstände auf eine Nachkommastelle. */
const expectDistance = (x: string, y: string, gherkin: number) => expect(Math.abs(hexDeltaE2000(x, y) - gherkin)).toBeLessThanOrEqual(0.051);

describe('@ZM-159 Vorbelegung der Standardfarben', () => {
  it('@ZM-159 Standardfarbe Heim Blau #1565C0, Gast Rot #C62828, Teamfarben an', () => {
    expect(DEFAULT_SPECTATOR_DISPLAY).toEqual({ teamColors: true, homeColor: palette.kit.blue, awayColor: palette.kit.red });
  });

  it('@ZM-159 Grauviolett #736469: Abstand 26,3 zu Blau, 25,3 zu Rot; Weiß 43,2 gegen Schwarz 32,1', () => {
    expectDistance(GRAUVIOLETT, BLAU_STD, 26.3);
    expectDistance(GRAUVIOLETT, ROT_STD, 25.3);
    expectDistance(GRAUVIOLETT, WEISS, 43.2);
    expectDistance(GRAUVIOLETT, SCHWARZ, 32.1);
  });

  it('@ZM-159 „zu ähnlich“ ist dieselbe Grenze wie der Leibchen-Hinweis (@SL-139): ΔE2000 30', () => {
    expect(KIT_SIMILAR_DELTA_E).toBe(30);
  });
});

describe('@ZM-159 Fälle A–D2 (Teamfarben an, Standardfarben Vorbelegung)', () => {
  it.each([
    ['A keine/keine', {}, {}, solid(BLAU_STD), solid(ROT_STD)],
    ['B keine/Gelb', { b: GELB }, {}, solid(BLAU_STD), solid(GELB)],
    ['B keine/Blau', { b: BLAU }, {}, solid(ROT_STD), solid(BLAU)],
    ['B keine/Grauviolett', { b: GRAUVIOLETT }, {}, solid(WEISS), solid(GRAUVIOLETT)],
    ['C Gelb/Blau', { a: GELB, b: BLAU }, {}, solid(GELB), solid(BLAU)],
    ['D Gelb/rote Leibchen über Gelb', { a: GELB, b: ROT }, { bibSide: 'b' as const, shirt: GELB }, solid(GELB), vest(ROT, GELB)],
    ['D2 Gelb/Gelb ohne Leibchen', { a: GELB, b: GELB }, {}, solid(GELB), solid(ROT_STD)],
    ['D2 Rot/Rot ohne Leibchen', { a: ROT, b: ROT }, {}, solid(ROT), solid(BLAU_STD)],
  ])('@ZM-159 Fall %s', (_fall, worn, extra, heim, gast) => {
    const boxes = resolve(worn, extra);
    expect(boxes.a.fill).toEqual(heim);
    expect(boxes.b.fill).toEqual(gast);
  });

  it('@ZM-159 Leibchen-Zeichen nur an der Leibchen-Seite (Fall D: FC Nord); Gegenbeispiel Fall C ohne Zeichen', () => {
    const d = resolve({ a: GELB, b: ROT }, { bibSide: 'b', shirt: GELB });
    expect([d.a.bib, d.b.bib]).toEqual([false, true]);
    const c = resolve({ a: GELB, b: BLAU });
    expect([c.a.bib, c.b.bib]).toEqual([false, false]);
  });

  it('@ZM-159 Gegenbeispiel B: Blau ist der Standardfarbe Heim zu ähnlich, Gelb nicht', () => {
    expect(kitConflict(BLAU, BLAU_STD)).not.toBe('none');
    expect(kitConflict(GELB, BLAU_STD)).toBe('none');
    expect(kitConflict(BLAU, ROT_STD)).toBe('none');
  });

  it('@ZM-159 Fall B spiegelbildlich: Gastseite ohne Farbe gegen Heim Rot weicht auf Blau aus', () => {
    const boxes = resolve({ a: ROT });
    expect(boxes.a.fill).toEqual(solid(ROT));
    expect(boxes.b.fill).toEqual(solid(BLAU_STD));
  });

  it('@ZM-159 Fall B gegen eine Weste: die Seite ohne Farbe weicht von der Mitte der Weste aus', () => {
    // Heim in roten Leibchen über Gelb, Gast ohne Farbe: Standardfarbe Gast Rot ist der Mitte zu ähnlich → Blau.
    const boxes = resolve({ a: ROT }, { bibSide: 'a', shirt: GELB });
    expect(boxes.a.fill).toEqual(vest(ROT, GELB));
    expect(boxes.b.fill).toEqual(solid(BLAU_STD));
  });
});

describe('@ZM-159 whiteOrBlackFarthestFrom', () => {
  it('@ZM-159 whiteOrBlackFarthestFrom: Grauviolett → Weiß, Blau #1565C0 → Weiß, Gelb → Schwarz', () => {
    expect(whiteOrBlackFarthestFrom(GRAUVIOLETT)).toBe(WEISS);
    expect(whiteOrBlackFarthestFrom(BLAU_STD)).toBe(WEISS);
    expect(whiteOrBlackFarthestFrom(GELB)).toBe(SCHWARZ);
  });

  it('@ZM-153 Blau #1565C0: Weiß 49,7', () => {
    expectDistance(BLAU_STD, WEISS, 49.7);
  });

  it('@ZM-153 Blau #1565C0: gegen Schwarz 39,1', () => {
    expectDistance(BLAU_STD, SCHWARZ, 39.1);
  });
});

describe('@ZM-140 getragene Farbe, Weste (Teamfarben an, Vorbelegung)', () => {
  it('@ZM-140 gelbe Leibchen über roten Trikots, Gast Weiß: Heim-Kasten Weste Gelb/Rot', () => {
    const boxes = resolve({ a: DEFAULT_BIB_COLOR, b: WEISS }, { bibSide: 'a', shirt: ROT });
    expect(boxes.a).toEqual({ fill: vest(GELB, ROT), bib: true });
    expect(boxes.b).toEqual({ fill: solid(WEISS), bib: false });
  });

  it('@ZM-140 Schwarz gegen Weiß: Heim-Kasten Schwarz (Rahmen prüft 2.2)', () => {
    expect(resolve({ a: SCHWARZ, b: WEISS }).a.fill).toEqual(solid(SCHWARZ));
  });

  it('@ZM-140 keine Farbe gegen Weiß: Standardfarbe Heim (Blau)', () => {
    expect(resolve({ b: WEISS }).a.fill).toEqual(solid(BLAU_STD));
  });

  it('@ZM-140 keine Farbe gegen Blau: Standardfarbe Gast (Rot)', () => {
    expect(resolve({ b: BLAU }).a.fill).toEqual(solid(ROT_STD));
  });

  it('@ZM-140 gelbe Leibchen ohne Trikotfarbe: Streifen in der Standardfarbe Heim (Blau)', () => {
    const boxes = resolve({ a: GELB, b: WEISS }, { bibSide: 'a' });
    expect(boxes.a.fill).toEqual(vest(GELB, BLAU_STD));
  });

  it('@ZM-140 Gegenbeispiel: Leibchen der Gastseite ohne Trikotfarbe → Streifen in der Standardfarbe Gast (Rot)', () => {
    const boxes = resolve({ a: WEISS, b: GELB }, { bibSide: 'b' });
    expect(boxes.b.fill).toEqual(vest(GELB, ROT_STD));
  });
});

describe('@ZM-153 Standardfarben, keine Seite trägt eine Farbe', () => {
  it.each([
    ['Blau/Rot', BLAU_STD, ROT_STD, ROT_STD],
    ['Blau/Navy', BLAU_STD, NAVY, WEISS],
  ])('@ZM-153 Standardfarben %s, keine Seite mit Farbe: Gast-Kasten', (_name, home, away, gast) => {
    const boxes = resolveBoxColors({ worn: {}, settings: settings({ homeColor: home, awayColor: away }) });
    expect(boxes.a.fill).toEqual(solid(home));
    expect(boxes.b.fill).toEqual(solid(gast));
  });

  it('@ZM-153 Abstände: Blau/Rot 44,8 (kein Hinweis), Blau/Navy 26,8 (zu ähnlich)', () => {
    expectDistance(BLAU_STD, ROT_STD, 44.8);
    expectDistance(BLAU_STD, NAVY, 26.8);
  });
});

describe('@ZM-154 Teamfarben aus', () => {
  // Spiel 12: SV Süd (Heim) Grün, FC Nord (Gast) gelbe Leibchen über schwarzen Trikots.
  const spiel12: Pick<BoxColorInput, 'worn' | 'bibSide' | 'shirt'> = { worn: { a: GRUEN, b: GELB }, bibSide: 'b', shirt: SCHWARZ };

  it('@ZM-154 Teamfarben aus: SV Süd Grün → Blau, FC Nord gelbe Leibchen über Schwarz → ganz Rot, Leibchen-Zeichen bleibt', () => {
    const boxes = resolveBoxColors({ ...spiel12, settings: settings({ teamColors: false }) });
    expect(boxes.a).toEqual({ fill: solid(BLAU_STD), bib: false });
    expect(boxes.b).toEqual({ fill: solid(ROT_STD), bib: true });
  });

  it('@ZM-154 Gegenbeispiel Teamfarben an: SV Süd Grün, FC Nord Weste Gelb mit schwarzen Streifen', () => {
    const boxes = resolveBoxColors({ ...spiel12, settings: settings() });
    expect(boxes.a).toEqual({ fill: solid(GRUEN), bib: false });
    expect(boxes.b).toEqual({ fill: vest(GELB, SCHWARZ), bib: true });
  });
});

describe('@ZM-161 Weste', () => {
  it('@ZM-161 SV Süd gelbe Leibchen über Rot, FC Nord Weiß: FC Nord ganz weiß ohne Leibchen-Zeichen', () => {
    const boxes = resolve({ a: GELB, b: WEISS }, { bibSide: 'a', shirt: ROT });
    expect(boxes.a).toEqual({ fill: vest(GELB, ROT), bib: true });
    expect(boxes.b).toEqual({ fill: solid(WEISS), bib: false });
  });
});

describe('RF1/RF2 Review Focus', () => {
  it('RF2 beide Standardfarben Blau, Teamfarben aus: Gast weicht auf Weiß aus', () => {
    const boxes = resolveBoxColors({ worn: { a: GELB, b: ROT }, settings: settings({ teamColors: false, homeColor: BLAU_STD, awayColor: BLAU_STD }) });
    expect(boxes.a.fill).toEqual(solid(BLAU_STD));
    expect(boxes.b.fill).toEqual(solid(WEISS));
  });

  it('RF1 Teamfarbe in Kurzform oder Kleinbuchstaben wird normalisiert, ungültige gilt als „keine Farbe“', () => {
    expect(resolve({ a: '#fc0', b: '#0033cc' }).a.fill).toEqual(solid(GELB));
    expect(resolve({ a: '#fc0', b: '#0033cc' }).b.fill).toEqual(solid(BLAU));
    const invalid = resolve({ a: 'blau', b: '' });
    expect(invalid.a.fill).toEqual(solid(BLAU_STD));
    expect(invalid.b.fill).toEqual(solid(ROT_STD));
  });
});
