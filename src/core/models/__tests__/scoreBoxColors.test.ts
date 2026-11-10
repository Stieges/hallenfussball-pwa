/**
 * Aufgabe 2.1 (Spielanzeige): Farbregel der Ergebniskästen, Fälle A–D2 (@ZM-159), getragene Farbe und Weste (@ZM-140,
 * @ZM-161), Standardfarben (@ZM-153), Teamfarben aus (@ZM-154), Fallback-Muster statt Ausweichfarbe (@ZM-203, @ZM-204; Daniel 2026-11-09),
 * RF1 aus dem Review Focus.
 * Testwerte aus dem Gherkin von docs/anforderungen/2026-10-02_zuschauer-und-monitor.md; „zu ähnlich“ = ΔE2000 < 30.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BIB_COLOR, KIT_SIMILAR_DELTA_E, kitConflict } from '../kit';
import { hexDeltaE2000 } from '../kitColorDistance';
import { FALLBACK_PATTERN, fillColorUnknown, resolveBoxColors, type BoxColorInput, type BoxFill } from '../scoreBoxColors';
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
/** Seite ohne Trikotfarbe: das Fallback-Muster (@ZM-203). */
const muster: BoxFill = { kind: 'striped', light: FALLBACK_PATTERN.light, dark: FALLBACK_PATTERN.dark };
/** Weste über einem Team ohne Trikotfarbe: das Muster in den Rändern (@ZM-204). */
const westeOhneTrikot = (center: string): BoxFill => ({ kind: 'vest', center, stripes: FALLBACK_PATTERN.dark, stripesUnknown: true });
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
    ['B keine/Gelb', { b: GELB }, {}, muster, solid(GELB)],
    ['B keine/Blau (nicht Rot und nicht Blau)', { b: BLAU }, {}, muster, solid(BLAU)],
    ['B Gelb/keine', { a: GELB }, {}, solid(GELB), muster],
    ['B keine/Grauviolett (ohne Rechnung nach Farbabstand)', { b: GRAUVIOLETT }, {}, muster, solid(GRAUVIOLETT)],
    ['C Gelb/Blau', { a: GELB, b: BLAU }, {}, solid(GELB), solid(BLAU)],
    ['D Gelb/rote Leibchen über Gelb', { a: GELB, b: ROT }, { bibSide: 'b' as const, shirt: GELB }, solid(GELB), vest(ROT, GELB)],
    ['D2 Gelb/Gelb ohne Leibchen (echte Trikotfarbe, keine Ausweichfarbe)', { a: GELB, b: GELB }, {}, solid(GELB), solid(GELB)],
    ['D2 Rot/Rot ohne Leibchen (echte Trikotfarbe, keine Ausweichfarbe)', { a: ROT, b: ROT }, {}, solid(ROT), solid(ROT)],
  ])('@ZM-159 Fall %s', (_fall, worn, extra, heim, gast) => {
    const boxes = resolve(worn, extra);
    expect(boxes.a.fill).toEqual(heim);
    expect(boxes.b.fill).toEqual(gast);
  });

  it('@ZM-159 Fall D2 Blau gegen Blau (@ZM-200): beide Kästen Blau, kein Ausweichen auf Rot, Weiß oder Schwarz', () => {
    const boxes = resolve({ a: BLAU, b: BLAU });
    expect([boxes.a.fill, boxes.b.fill]).toEqual([solid(BLAU), solid(BLAU)]);
  });

  it('@ZM-159 Leibchen-Zeichen nur an der Leibchen-Seite (Fall D: FC Nord); Gegenbeispiel Fall C ohne Zeichen', () => {
    const d = resolve({ a: GELB, b: ROT }, { bibSide: 'b', shirt: GELB });
    expect([d.a.bib, d.b.bib]).toEqual([false, true]);
    const c = resolve({ a: GELB, b: BLAU });
    expect([c.a.bib, c.b.bib]).toEqual([false, false]);
  });

  it('@ZM-159 Gegenbeispiel Fall A: keine Seite mit Farbe, aber Teamfarben aus – ebenfalls Heim Blau, Gast Rot (kein Muster)', () => {
    const boxes = resolveBoxColors({ worn: {}, settings: settings({ teamColors: false }) });
    expect([boxes.a.fill, boxes.b.fill]).toEqual([solid(BLAU_STD), solid(ROT_STD)]);
  });

  it('@ZM-159 Fall B spiegelbildlich: Gastseite ohne Farbe gegen Heim Rot zeigt das Muster, nicht Blau', () => {
    const boxes = resolve({ a: ROT });
    expect(boxes.a.fill).toEqual(solid(ROT));
    expect(boxes.b.fill).toEqual(muster);
  });

  it('@ZM-159 Fall B gegen eine Weste: die Seite ohne Farbe zeigt das Muster, die Weste bleibt (Mitte Rot, Streifen Gelb)', () => {
    const boxes = resolve({ a: ROT }, { bibSide: 'a', shirt: GELB });
    expect(boxes.a.fill).toEqual(vest(ROT, GELB));
    expect(boxes.b.fill).toEqual(muster);
  });
});

describe('@ZM-203 Kasten ohne Trikotfarbe: schräg grau gestreift, kein Ausweichen', () => {
  it('@ZM-203 SV Süd (Heim) ohne Trikotfarbe, FC Nord (Gast) Blau: Heim Muster, Gast Blau, Heim weder Blau noch Rot noch Weiß noch Schwarz', () => {
    const boxes = resolve({ b: BLAU });
    expect(boxes.a.fill).toEqual(muster);
    expect(boxes.b.fill).toEqual(solid(BLAU));
    for (const verboten of [BLAU, BLAU_STD, ROT_STD, WEISS, SCHWARZ]) {
      expect(boxes.a.fill).not.toEqual(solid(verboten));
    }
  });

  it('@ZM-203 Aber haben beide Seiten keine Trikotfarbe: SV Süd Blau (Standardfarbe Heim), FC Nord Rot (Standardfarbe Gast)', () => {
    const boxes = resolve({});
    expect([boxes.a.fill, boxes.b.fill]).toEqual([solid(BLAU_STD), solid(ROT_STD)]);
  });

  it('@ZM-203 das Muster ist das Zeichen „Trikotfarbe unbekannt“: fillColorUnknown nur dafür, nicht für echte Farben', () => {
    const boxes = resolve({ b: BLAU });
    expect(fillColorUnknown(boxes.a.fill)).toBe(true);
    expect(fillColorUnknown(boxes.b.fill)).toBe(false);
    expect(fillColorUnknown(solid(GELB))).toBe(false);
    expect(fillColorUnknown(vest(GELB, ROT))).toBe(false);
  });

  it('@ZM-203 Gegenbeispiel Teamfarben aus: auch eine Seite ohne Trikotfarbe trägt die Standardfarbe, kein Muster', () => {
    const boxes = resolveBoxColors({ worn: { b: BLAU }, settings: settings({ teamColors: false }) });
    expect([boxes.a.fill, boxes.b.fill]).toEqual([solid(BLAU_STD), solid(ROT_STD)]);
  });
});

describe('@ZM-204 Weste über einem Team ohne Trikotfarbe: das Muster in den Rändern', () => {
  it('@ZM-204 SV Süd (Heim) in gelben Leibchen ohne Trikotfarbe: Mitte Gelb, Ränder im Muster (weder Blau noch Rot), Leibchen-Zeichen', () => {
    const boxes = resolve({ a: DEFAULT_BIB_COLOR, b: WEISS }, { bibSide: 'a' });
    expect(boxes.a).toEqual({ fill: westeOhneTrikot(GELB), bib: true });
    expect(fillColorUnknown(boxes.a.fill)).toBe(true);
    expect(boxes.a.fill).not.toMatchObject({ stripes: BLAU_STD });
    expect(boxes.a.fill).not.toMatchObject({ stripes: ROT_STD });
  });

  it('@ZM-204 Gegenbeispiel: Gastseite in Leibchen ohne Trikotfarbe – ebenfalls das Muster, nicht die Standardfarbe Gast (Rot)', () => {
    const boxes = resolve({ a: WEISS, b: GELB }, { bibSide: 'b' });
    expect(boxes.b.fill).toEqual(westeOhneTrikot(GELB));
  });

  it('@ZM-195 Gegenbeispiel: mit Trikotfarbe bleibt die Weste einfarbig in dieser Farbe (kein Muster)', () => {
    const boxes = resolve({ a: GELB, b: WEISS }, { bibSide: 'a', shirt: ROT });
    expect(boxes.a.fill).toEqual(vest(GELB, ROT));
    expect(fillColorUnknown(boxes.a.fill)).toBe(false);
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

  it('@ZM-140 keine Farbe gegen Weiß: schräg grau gestreift (Fallback-Muster)', () => {
    expect(resolve({ b: WEISS }).a.fill).toEqual(muster);
  });

  it('@ZM-140 keine Farbe gegen Blau: schräg grau gestreift, nicht Rot und nicht Blau', () => {
    const fill = resolve({ b: BLAU }).a.fill;
    expect(fill).toEqual(muster);
    expect(fill).not.toEqual(solid(ROT_STD));
    expect(fill).not.toEqual(solid(BLAU_STD));
  });

  it('@ZM-140 gelbe Leibchen ohne eingetragene Trikotfarbe: Weste über dem grauen Streifenmuster', () => {
    const boxes = resolve({ a: GELB, b: WEISS }, { bibSide: 'a' });
    expect(boxes.a.fill).toEqual(westeOhneTrikot(GELB));
  });
});

describe('@ZM-153 Standardfarben, keine Seite trägt eine Farbe: genau Ollis Einstellung', () => {
  it.each([
    ['Blau/Rot', BLAU_STD, ROT_STD],
    ['Blau/Navy (zu ähnlich, Abstand 26,8): Navy wie eingestellt, kein Ausweichen', BLAU_STD, NAVY],
  ])('@ZM-153 Standardfarben %s: Heim und Gast wie eingestellt', (_name, home, away) => {
    const boxes = resolveBoxColors({ worn: {}, settings: settings({ homeColor: home, awayColor: away }) });
    expect(boxes.a.fill).toEqual(solid(home));
    expect(boxes.b.fill).toEqual(solid(away));
  });

  it('@ZM-153 Abstände: Blau/Rot 44,8 (kein Hinweis), Blau/Navy 26,8 (zu ähnlich), Blau/Weiß 49,7, Blau/Schwarz 39,1', () => {
    expectDistance(BLAU_STD, ROT_STD, 44.8);
    expectDistance(BLAU_STD, NAVY, 26.8);
    expectDistance(BLAU_STD, WEISS, 49.7);
    expectDistance(BLAU_STD, SCHWARZ, 39.1);
    expect(kitConflict(BLAU_STD, NAVY)).toBe('similar');
    expect(kitConflict(BLAU_STD, ROT_STD)).toBe('none');
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

describe('RF1 Review Focus', () => {
  it('@ZM-153 beide Standardfarben Blau, Teamfarben aus: beide Kästen Blau (keine Ausweichfarbe für den Gast)', () => {
    const boxes = resolveBoxColors({ worn: { a: GELB, b: ROT }, settings: settings({ teamColors: false, homeColor: BLAU_STD, awayColor: BLAU_STD }) });
    expect(boxes.a.fill).toEqual(solid(BLAU_STD));
    expect(boxes.b.fill).toEqual(solid(BLAU_STD));
  });

  it('RF1 Teamfarbe in Kurzform oder Kleinbuchstaben wird normalisiert, ungültige gilt als „keine Farbe“', () => {
    expect(resolve({ a: '#fc0', b: '#0033cc' }).a.fill).toEqual(solid(GELB));
    expect(resolve({ a: '#fc0', b: '#0033cc' }).b.fill).toEqual(solid(BLAU));
    const invalid = resolve({ a: 'blau', b: '' });
    expect(invalid.a.fill).toEqual(solid(BLAU_STD));
    expect(invalid.b.fill).toEqual(solid(ROT_STD));
  });
});
