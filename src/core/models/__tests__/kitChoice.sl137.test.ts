/**
 * Leibchen-Wahl in der Anpfiff-Ansicht – Regeln (@SL-137, @SL-138, @SL-139, @SL-148, @SL-149, @SL-151, @SL-173, @SL-196).
 * Werte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md), nicht aus dem Code.
 */
import { describe, expect, it } from 'vitest';
import {
  kitHinweis, leibchenFarbeFuer, leibchenFarbenMit, trikotFarben } from '../kitChoice';
import { teamSlot } from '../matchSlot';

const ROT = '#C62828';
const WEISS = '#FFFFFF';
const TURNIER_GELB = '#FFCC00';
const BLAU = '#1565C0';
const NAVY = '#0D1B4C';

describe('@SL-137 gleiche Farbe: Hinweis, Heim mit Leibchen vorbelegt, nur für dieses Spiel', () => {



  it('@SL-137 die Leibchenfarbe des Turniers steht als erste Wahl, ohne Doppel', () => {
    const farben = leibchenFarbenMit('#ff6d00');
    expect(farben[0]).toBe('#FF6D00');
    expect(new Set(farben).size).toBe(farben.length);
    expect(leibchenFarbenMit(TURNIER_GELB).filter((f) => f === TURNIER_GELB)).toHaveLength(1);
  });
});

describe('@SL-139/@SL-173 sehr ähnliche Farben: Karte nur bei Farbabstand (Grenzen aus der Anforderung, geändert 2026-11-10)', () => {
  it.each([
    ['Schwarz/Dunkelblau', '#000000', NAVY, 'similar'],
    ['Blau/Navy', BLAU, NAVY, 'similar'],
    ['Weiß/Gelb', WEISS, '#FFEB3B', 'similar'],
    ['Weiß/Zitronengelb (Helligkeit 1,07:1: nur Hinweis „gleich hell“, keine Karte, @SL-139/@SL-173)', WEISS, '#FFFF00', 'none'],
    ['Rot/Weiß', ROT, WEISS, 'none'],
    ['Rot/Grün (Helligkeit 1,03:1: keine Karte, @SL-173)', '#D32F2F', '#2E7D32', 'none'],
    ['Gelb/Blau', '#FFEB3B', BLAU, 'none'],
    ['Rot/Blau (Helligkeit 1,02:1: keine Karte, @SL-173)', '#C62828', BLAU, 'none'],
    ['Rot #D32F2F/Weiß (Helligkeit 4,98:1, @SL-173)', '#D32F2F', WEISS, 'none'],
  ])('%s → %s', (_zeile, a, b, erwartet) => {
    expect(kitHinweis({ a, b })).toBe(erwartet);
  });

  it('ohne Trikotfarbe einer Seite kein Hinweis', () => {
    expect(kitHinweis({ a: ROT })).toBe('none');
  });
});

describe('@SL-196 vor dem Anpfiff die echten Trikotfarben, keine Ausweichfarbe', () => {



  it('trikotFarben liest die aktuellen Teamfarben je Seite, offene Seite ohne Farbe', () => {
    const T1 = '11111111-1111-4111-8111-000000000001';
    const T2 = '11111111-1111-4111-8111-000000000002';
    const teams = [{ id: T1, colors: { primary: '#1565c0' } }, { id: T2, colors: { primary: BLAU } }];
    expect(trikotFarben({ slotA: teamSlot(T1), slotB: teamSlot(T2) }, teams)).toEqual({ a: BLAU, b: BLAU });
    expect(trikotFarben({ slotA: teamSlot(T1), slotB: { kind: 'pending' } as never }, teams)).toEqual({ a: BLAU });
  });
});

describe('@SL-151 Leibchenfarbe gegen den Gegner', () => {
  it('@SL-151 Weiß gegen Gelb, Turnierfarbe Gelb: nicht Gelb, sondern die erste Farbe ohne Konflikt zum Gegner; Gegenprobe: konfliktfrei bleibt die Turnierfarbe', () => {
    expect(leibchenFarbeFuer({ a: WEISS, b: '#FFEB3B' }, 'a', TURNIER_GELB)).not.toBe(TURNIER_GELB);
    expect(leibchenFarbeFuer({ a: ROT, b: ROT }, 'a', TURNIER_GELB)).toBe(TURNIER_GELB);
  });
});
