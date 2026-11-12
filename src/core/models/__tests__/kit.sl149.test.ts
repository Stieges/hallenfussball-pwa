/**
 * Anpfiff-Kit mit ausdrücklichem „Keine Leibchen“ (@SL-149) und ohne Vorbelegung (@SL-210).
 * Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md), nicht aus dem Code.
 */
import { describe, expect, it } from 'vitest';
import { compactKit, parseKitInput } from '../kit';
import { kitBeimAnpfiff } from '../kitAnpfiff';
import { teamSlot } from '../matchSlot';
import type { Match, Team } from '../../../types/tournament';

const BLAU = '#1565C0';
const GELB = '#FFCC00';
const ORANGE = '#FF9800';
const WAGING = '00000000-0000-4000-8000-0000000000a1';
const PETTING = '00000000-0000-4000-8000-0000000000a2';
const TEAMS: Team[] = [
  { id: WAGING, name: 'TSV Waging 1', colors: { primary: BLAU } },
  { id: PETTING, name: 'TSV Petting', colors: { primary: BLAU } },
];
const SPIEL2: Match = { id: 'spiel-2', round: 1, field: 1, slotA: teamSlot(WAGING), slotB: teamSlot(PETTING) };

describe('@SL-149 ausdrücklich „Keine Leibchen“ im Anpfiff', () => {
  it('@SL-149 bibSide null ist erlaubt und bleibt als null stehen (der Server liest den Schlüssel als „keine Leibchen“)', () => {
    expect(parseKitInput({ a: BLAU, b: BLAU, bibSide: null })).toEqual({ a: BLAU, b: BLAU, bibSide: null });
  });

  it('@SL-149 compactKit behält bibSide null, lässt aber einen fehlenden Schlüssel fehlen', () => {
    expect(compactKit({ a: BLAU, bibSide: null })).toEqual({ a: BLAU, bibSide: null });
    expect(Object.keys(compactKit({ a: BLAU, b: undefined, bibSide: undefined }))).toEqual(['a']);
  });

  it('@SL-149 Gegenbeispiel: eine fremde Seite oder Zahl ist kein gültiges Kit', () => {
    expect(parseKitInput({ bibSide: 'c' })).toBeNull();
    expect(parseKitInput({ bibSide: 0 })).toBeNull();
    expect(parseKitInput({ bibSide: null, fremd: 1 })).toBeNull();
  });
});

describe('@SL-210 der Anpfiff belegt nichts vor', () => {
  it('@SL-210 beide Teams in Blau, nichts getippt: das Kit trägt die Trikotfarben und keinen Schlüssel bibSide', () => {
    const kit = kitBeimAnpfiff(SPIEL2, TEAMS);
    expect(kit).toEqual({ a: BLAU, b: BLAU });
    expect('bibSide' in kit).toBe(false);
  });

  it('@SL-210 offene Wahl (kitDecision fehlt) trotz Farbgleichheit: keine Leibchen vorbelegt', () => {
    expect(kitBeimAnpfiff({ ...SPIEL2 }, TEAMS).bibSide).toBeUndefined();
  });

  it('@SL-149 „Keine Leibchen“ getippt: das Kit trägt ausdrücklich bibSide null', () => {
    const kit = kitBeimAnpfiff({ ...SPIEL2, kitDecision: 'none' }, TEAMS);
    expect(kit).toEqual({ a: BLAU, b: BLAU, bibSide: null });
  });

  it('@SL-202 bestätigt (TSV Waging 1 zieht Gelb): Leibchenfarbe auf der Leibchen-Seite, Trikot auf der anderen, Seite genannt', () => {
    const match: Match = { ...SPIEL2, kitDecision: 'bib', kit: { a: GELB, bibSide: 'a' } };
    expect(kitBeimAnpfiff(match, TEAMS)).toEqual({ a: GELB, b: BLAU, bibSide: 'a' });
  });

  it('@SL-209 bestätigt für TSV Petting in Orange: nur die Gast-Seite trägt, Heim bleibt im Trikot', () => {
    const match: Match = { ...SPIEL2, kitDecision: 'bib', kit: { b: ORANGE, bibSide: 'b' } };
    expect(kitBeimAnpfiff(match, TEAMS)).toEqual({ a: BLAU, b: ORANGE, bibSide: 'b' });
  });

  it('@SL-210 Gegenbeispiel: eine bestätigte Wahl ohne Leibchenfarbe im Spiel (kaputter Stand) wird nicht erfunden, sondern offen behandelt', () => {
    const match: Match = { ...SPIEL2, kitDecision: 'bib', kit: { bibSide: 'a' } };
    expect(kitBeimAnpfiff(match, TEAMS)).toEqual({ a: BLAU, b: BLAU });
  });
});
