/**
 * A-30a Teamfarben und Leibchen, Kern (Regeln): @SL-137, @SL-138, @SL-139, @W3-028, @W3-029, @ZM-140 (Datenteil).
 * Testwerte aus dem Gherkin der Records (docs/anforderungen/2026-10-02_spiel-leiten.md,
 * 2026-09-27_wizard-turniertag-vorbereiten.md, 2026-10-02_zuschauer-und-monitor.md); Code nur als Ansatzpunkt.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BIB_COLOR,
  KIT_SIMILAR_DELTA_E,
  defaultKit,
  kitConflict,
  kitConflictWithLuminance,
  kitWithBib,
  normalizeKitColor,
  wornColors,
} from '../kit';
import { hexDeltaE2000 } from '../kitColorDistance';
import { teamSlot } from '../matchSlot';
import { resolveBoxColors, type BoxFill } from '../scoreBoxColors';
import { DEFAULT_SPECTATOR_DISPLAY } from '../spectatorDisplay';
import type { Match, Team } from '../../../types/tournament';
import { palette } from '../../../design-tokens/colors/palette';

const SV_SUED = '11111111-1111-4111-8111-000000000001';
const FC_NORD = '11111111-1111-4111-8111-000000000002';
const TSV_OST = '11111111-1111-4111-8111-000000000003';
const DJK_BERG = '11111111-1111-4111-8111-000000000004';

const ROT = palette.kit.red;
const WEISS = palette.neutral[0];
const SCHWARZ = palette.kit.black;
const ORANGE = '#FF6600';

function team(id: string, name: string, primary?: string): Team {
  return primary === undefined ? { id, name } : { id, name, colors: { primary } };
}

function spiel(id: string, home: string, away: string, extra: Partial<Match> = {}): Match {
  return { id, round: 1, field: 1, slotA: teamSlot(home), slotB: teamSlot(away), ...extra };
}

describe('A-30a @SL-139 Farbabstand ΔE2000, Hinweis unter 30', () => {
  it('@SL-139 die Grenze ist ein fester Wert der App: ΔE2000 30', () => {
    expect(KIT_SIMILAR_DELTA_E).toBe(30);
  });

  // Szenariogrundriss @SL-139, alle fünf Beispielzeilen wörtlich (Farbe FC Nord | Farbe DJK Berg | Anzeige | Abstand).
  it.each([
    { zeile: 'Schwarz/Dunkelblau', nord: palette.kit.black, berg: palette.kit.navy, abstand: 21.6, hinweis: true },
    { zeile: 'Blau/Navy', nord: palette.kit.blue, berg: palette.kit.navy, abstand: 26.8, hinweis: true },
    { zeile: 'Weiß/Gelb', nord: palette.neutral[0], berg: '#FFEB3B', abstand: 29.2, hinweis: true },
    // @SL-139 Zeile 4 (seit 2026-10-23): Abstand 30,5 liegt über der Grenze, aber die Helligkeit 1,07:1 (@SL-173) löst den Hinweis aus.
    { zeile: 'Weiß/Zitronengelb', nord: palette.neutral[0], berg: '#FFFF00', abstand: 30.5, hinweis: true, nurAbstand: false },
    { zeile: 'Rot/Weiß', nord: palette.kit.red, berg: palette.neutral[0], abstand: 50.8, hinweis: false },
  ])('@SL-139 $zeile: Abstand $abstand → Hinweis $hinweis', ({ nord, berg, abstand, hinweis, nurAbstand = hinweis }) => {
    expect(Math.round(hexDeltaE2000(nord, berg) * 10) / 10).toBe(abstand);
    expect(hexDeltaE2000(nord, berg) < 30).toBe(nurAbstand);
    expect(kitConflict(nord, berg)).toBe(nurAbstand ? 'similar' : 'none');
    expect(kitConflictWithLuminance(nord, berg)).toBe(hinweis ? 'similar' : 'none');

    // Spiel 15 FC Nord gegen DJK Berg: mit Hinweis bietet die Vorbelegung „Leibchen“ an, ohne Hinweis nicht.
    const teams = [team(FC_NORD, 'FC Nord', nord), team(DJK_BERG, 'DJK Berg', berg)];
    const kit = defaultKit(spiel('spiel-15', FC_NORD, DJK_BERG), teams, {});
    expect(kit.bibSide).toBe(hinweis ? 'a' : undefined);
  });

  it('@SL-139 Zusatzpaar Schwarz/Bordeaux (26,1) liegt unter der Grenze → Hinweis', () => {
    expect(Math.round(hexDeltaE2000(palette.kit.black, '#5D0F1F') * 10) / 10).toBe(26.1);
    expect(kitConflict(palette.kit.black, '#5D0F1F')).toBe('similar');
  });

  it('@SL-139 der Abstand hängt nicht von der Reihenfolge der Seiten ab', () => {
    expect(kitConflict('#FFEB3B', palette.neutral[0])).toBe('similar');
    expect(kitConflict(palette.neutral[0], palette.kit.red)).toBe('none');
  });

  it('@SL-139 Gegenbeispiel: Groß-/Kleinschreibung und Kurzform sind kein Unterschied', () => {
    expect(kitConflict('#dc0000', '#DC0000')).toBe('same');
    expect(kitConflict('#fff', palette.neutral[0])).toBe('same');
    expect(normalizeKitColor('#fff')).toBe(palette.neutral[0]);
    expect(normalizeKitColor('#dc0000')).toBe('#DC0000');
  });

  it.each([
    { fall: 'fehlende Farbe Heim', a: undefined, b: ROT },
    { fall: 'fehlende Farbe Gast', a: ROT, b: undefined },
    { fall: 'keine Farben', a: undefined, b: undefined },
    { fall: 'ungültiger Wert', a: 'rot', b: 'rot' },
    { fall: 'Hex ohne Raute', a: 'C62828', b: 'C62828' },
  ])('@SL-139 Gegenbeispiel: $fall → Farbe unbekannt, kein Hinweis', ({ a, b }) => {
    expect(kitConflict(a, b)).toBe('none');
  });
});

describe('A-30a @SL-137 gleiche Farbe: Leibchen für eine Seite, nur in diesem Spiel', () => {
  // Hintergrund: SV Süd und FC Nord haben beide Rot, Leibchenfarbe des Turniers Gelb (Vorgabe).
  const teams = [team(SV_SUED, 'SV Süd', ROT), team(FC_NORD, 'FC Nord', ROT)];
  const spiel12 = spiel('spiel-12', SV_SUED, FC_NORD);

  it('@SL-137 weist auf die gleiche Farbe hin', () => {
    expect(kitConflict(ROT, ROT)).toBe('same');
  });

  it('@SL-137 „Leibchen“ vorbelegt SV Süd als Heimseite, mit Gelb vorbelegt', () => {
    expect(defaultKit(spiel12, teams, {})).toEqual({ a: DEFAULT_BIB_COLOR, b: ROT, bibSide: 'a' });
  });

  it('@SL-137 Gelb ist änderbar: eine andere Leibchenfarbe gilt für die gewählte Seite', () => {
    expect(kitWithBib(spiel12, teams, {}, 'a', ORANGE)).toEqual({ a: ORANGE, b: ROT, bibSide: 'a' });
  });

  it('@SL-137 wählt Tom „Leibchen“ für FC Nord, gilt Gelb für FC Nord nur in Spiel 12; im nächsten Spiel trägt FC Nord wieder Rot', () => {
    const kit = kitWithBib(spiel12, teams, {}, 'b');
    expect(kit).toEqual({ a: ROT, b: DEFAULT_BIB_COLOR, bibSide: 'b' });

    const angepfiffen = { ...spiel12, matchStatus: 'running' as const, kit };
    expect(wornColors(angepfiffen, teams)).toEqual({ a: ROT, b: DEFAULT_BIB_COLOR });

    const spiel13 = spiel('spiel-13', FC_NORD, TSV_OST);
    expect(wornColors(spiel13, [...teams, team(TSV_OST, 'TSV Ost', WEISS)])).toEqual({ a: ROT, b: WEISS });
  });
});

describe('A-30a @SL-138 ohne Farbkonflikt kein Hinweis, Anpfiff ohne Zusatzschritt', () => {
  it('@SL-138 SV Süd in Rot, TSV Ost in Weiß: kein Hinweis, beide Farben, kein Leibchen', () => {
    const teams = [team(SV_SUED, 'SV Süd', ROT), team(TSV_OST, 'TSV Ost', WEISS)];
    expect(kitConflict(ROT, WEISS)).toBe('none');
    const kit = defaultKit(spiel('spiel-14', SV_SUED, TSV_OST), teams, {});
    expect(kit).toEqual({ a: ROT, b: WEISS });
    expect(kit).not.toHaveProperty('bibSide');
  });

  it('@SL-138 Gegenbeispiel: ohne Teamfarben gibt es keinen Konflikt und keine Leibchen-Vorbelegung', () => {
    const kit = defaultKit(spiel('spiel-14', SV_SUED, TSV_OST), [team(SV_SUED, 'SV Süd'), team(TSV_OST, 'TSV Ost')], {});
    expect(kit).toEqual({});
  });

  it('@SL-138 Gegenbeispiel: ungültige Teamfarbe zählt als „keine Farbe“, kein Konflikt', () => {
    const kit = defaultKit(spiel('spiel-14', SV_SUED, TSV_OST), [team(SV_SUED, 'SV Süd', 'rot'), team(TSV_OST, 'TSV Ost', 'rot')], {});
    expect(kit).toEqual({});
  });
});

describe('A-30a @W3-029 Leibchenfarbe des Turniers', () => {
  const teams = [team(SV_SUED, 'SV Süd', ROT), team(FC_NORD, 'FC Nord', ROT)];
  const spiel12 = spiel('spiel-12', SV_SUED, FC_NORD);

  it('@W3-029 Leibchenfarbe auf Orange gestellt: Orange ist in jedem Spiel als Leibchenfarbe vorbelegt', () => {
    expect(defaultKit(spiel12, teams, { bibColor: ORANGE })).toEqual({ a: ORANGE, b: ROT, bibSide: 'a' });
    expect(kitWithBib(spiel12, teams, { bibColor: ORANGE }, 'b')).toEqual({ a: ROT, b: ORANGE, bibSide: 'b' });
    const spiel20 = spiel('spiel-20', FC_NORD, SV_SUED);
    expect(defaultKit(spiel20, teams, { bibColor: ORANGE }).a).toBe(ORANGE);
  });

  it('@W3-029 ohne Einstellung ist Gelb vorbelegt', () => {
    expect(DEFAULT_BIB_COLOR).toBe('#FFCC00');
    expect(defaultKit(spiel12, teams, {}).a).toBe(DEFAULT_BIB_COLOR);
  });

  it('@W3-029 Gegenbeispiel: eine ungültige Einstellung fällt auf Gelb zurück, kein dritter Wert', () => {
    expect(defaultKit(spiel12, teams, { bibColor: 'orange' }).a).toBe(DEFAULT_BIB_COLOR);
  });
});

describe('A-30a @W3-028 Trikotfarbe am Turniertag', () => {
  // Gegeben: der Hallencup Nord läuft, für SV Süd ist keine Trikotfarbe eingetragen.
  const ohneFarbe = [team(SV_SUED, 'SV Süd'), team(FC_NORD, 'FC Nord', WEISS)];
  // Wenn Olli für SV Süd Schwarz aus der Palette wählt:
  const mitSchwarz = [team(SV_SUED, 'SV Süd', SCHWARZ), team(FC_NORD, 'FC Nord', WEISS)];
  const anpfiffKit = defaultKit(spiel('x', SV_SUED, FC_NORD), ohneFarbe, {});

  it('@W3-028 Schwarz gilt ab dem nächsten Spiel von SV Süd als Trikotfarbe', () => {
    const naechstes = spiel('spiel-9', SV_SUED, FC_NORD, { matchStatus: 'scheduled' });
    expect(wornColors(naechstes, mitSchwarz)).toEqual({ a: SCHWARZ, b: WEISS });
  });

  it.each([
    { status: 'running' as const, zeile: 'laufendes' },
    { status: 'finished' as const, zeile: 'beendetes' },
  ])('@W3-028 ein $zeile Spiel behält die Farbe, mit der es gespielt wurde (ohne Farbe → keine)', ({ status }) => {
    const gespielt = spiel('spiel-7', SV_SUED, FC_NORD, { matchStatus: status, kit: anpfiffKit });
    expect(wornColors(gespielt, mitSchwarz)).toEqual({ a: undefined, b: WEISS });
  });

  it('@W3-028 Gegenbeispiel: angepfiffenes Spiel ohne gespeicherte Farben nimmt NICHT die neue Teamfarbe', () => {
    const gespielt = spiel('spiel-7', SV_SUED, FC_NORD, { matchStatus: 'running' });
    expect(wornColors(gespielt, mitSchwarz)).toEqual({ a: undefined, b: undefined });
  });

  it('@W3-028 ein beendetes Spiel ohne gespeicherte Farbe behält „keine Farbe“, nie die neue Teamfarbe', () => {
    const beendet = spiel('spiel-6', SV_SUED, FC_NORD, { matchStatus: 'finished' });
    expect(wornColors(beendet, mitSchwarz)).toEqual({ a: undefined, b: undefined });
  });

  // Fixrunde 1 (Review B1): jeder Zustand nach dem Anpfiff zählt – auch der Cloud-Status `paused`
  // (Halbzeit, Pause, offene Entscheidung, Strafstoßschießen), den der Mapper ungeprüft durchreicht.
  it.each([
    { status: 'running', angepfiffen: true },
    { status: 'waiting', angepfiffen: true },
    { status: 'paused', angepfiffen: true },
    { status: 'finished', angepfiffen: true },
    { status: 'scheduled', angepfiffen: false },
    { status: 'skipped', angepfiffen: false },
    { status: undefined, angepfiffen: false },
  ])('@W3-028 Status $status: angepfiffen $angepfiffen', ({ status, angepfiffen }) => {
    const gespielt = { ...spiel('spiel-5', SV_SUED, FC_NORD), matchStatus: status as Match['matchStatus'], kit: { a: WEISS } };
    expect(wornColors(gespielt, mitSchwarz)).toEqual(angepfiffen ? { a: WEISS, b: undefined } : { a: SCHWARZ, b: WEISS });
  });

  it('@W3-028 Gegenbeispiel: abgesetztes Spiel ist nicht angepfiffen und folgt der Teamfarbe', () => {
    const abgesetzt = spiel('spiel-8', SV_SUED, FC_NORD, { matchStatus: 'skipped' });
    expect(wornColors(abgesetzt, mitSchwarz)).toEqual({ a: SCHWARZ, b: WEISS });
  });
});

describe('A-30a @ZM-140 getragene Farbe am Spiel → Kasten (Farbregel Spielanzeige 2.1, Vorbelegung Heim Blau, Gast Rot)', () => {
  // Gherkin @ZM-140 (angepasst 2026-10-18): Weste statt nur Leibchenfarbe, ohne Farbe die Standardfarbe der Seite mit Ausweichregel.
  const GELB = DEFAULT_BIB_COLOR;
  const BLAU = '#0033CC';
  const teams = [team(SV_SUED, 'SV Süd', ROT), team(FC_NORD, 'FC Nord', WEISS)];
  const solid = (color: string): BoxFill => ({ kind: 'solid', color });
  const vest = (center: string, stripes: string): BoxFill => ({ kind: 'vest', center, stripes });

  it.each([
    { farbe: 'gelbe Leibchen über roten Trikots', gast: 'Weiß', kit: { a: GELB, b: WEISS, bibSide: 'a' as const }, shirt: ROT, kasten: vest(GELB, ROT) },
    { farbe: 'Schwarz', gast: 'Weiß', kit: { a: SCHWARZ, b: WEISS }, shirt: undefined, kasten: solid(SCHWARZ) },
    { farbe: 'keine eingetragene Farbe', gast: 'Weiß', kit: { b: WEISS }, shirt: undefined, kasten: solid(palette.kit.blue) },
    { farbe: 'keine eingetragene Farbe', gast: 'Blau', kit: { b: BLAU }, shirt: undefined, kasten: solid(palette.kit.red) },
    { farbe: 'gelbe Leibchen, ohne eingetragene Trikotfarbe', gast: 'Weiß', kit: { a: GELB, b: WEISS, bibSide: 'a' as const }, shirt: undefined, kasten: vest(GELB, palette.kit.blue) },
  ])('@ZM-140 Heimseite trägt $farbe, Gast $gast → Kasten', ({ kit, shirt, kasten }) => {
    const spiel12 = spiel('spiel-12', SV_SUED, FC_NORD, { matchStatus: 'running', kit });
    const boxes = resolveBoxColors({
      worn: wornColors(spiel12, teams),
      ...(kit.bibSide === undefined ? {} : { bibSide: kit.bibSide }),
      ...(shirt === undefined ? {} : { shirt }),
      settings: DEFAULT_SPECTATOR_DISPLAY,
    });
    expect(boxes.a.fill).toEqual(kasten);
  });

  it('@ZM-140 „keine eingetragene Farbe“ ist die Standardfarbe Heim (Blau #1565C0, Vorgabe der Einstellung)', () => {
    expect(DEFAULT_SPECTATOR_DISPLAY.homeColor).toBe(palette.kit.blue);
  });
});
