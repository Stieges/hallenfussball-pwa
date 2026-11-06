/**
 * Leibchen-Wahl in der Anpfiff-Ansicht – Regeln (@SL-137, @SL-138, @SL-139, @SL-148, @SL-149, @SL-151, @SL-173, @SL-196).
 * Werte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md), nicht aus dem Code.
 */
import { describe, expect, it } from 'vitest';
import {
  ersteLeibchenWahl, kitAusWahl, kitHinweis, leibchenFarbenMit, leibchenGegenGegner, trikotFarben, vorschauKaesten,
} from '../kitChoice';
import { teamSlot } from '../matchSlot';
import type { SideBox } from '../scoreBoxColors';

const ROT = '#C62828';
const WEISS = '#FFFFFF';
const GELB_SV_SUED = '#FFEB3B';
const GELB_LEIBCHEN = '#FFEB3B';
const TURNIER_GELB = '#FFCC00';
const BLAU = '#1565C0';
const NAVY = '#0D1B4C';

const STANDARD: { a: SideBox; b: SideBox } = {
  a: { fill: { kind: 'solid', color: BLAU }, bib: false },
  b: { fill: { kind: 'solid', color: ROT }, bib: false },
};

describe('@SL-137 gleiche Farbe: Hinweis, Heim mit Leibchen vorbelegt, nur für dieses Spiel', () => {
  it('@SL-137 beide Rot → Hinweis „gleiche Farbe“, Leibchen für SV Süd (Heim) mit Gelb vorbelegt', () => {
    const farben = { a: ROT, b: ROT };
    expect(kitHinweis(farben)).toBe('same');
    expect(ersteLeibchenWahl(farben, TURNIER_GELB)).toEqual({ bibSide: 'a', bibColor: TURNIER_GELB });
  });

  it('@SL-137 wählt Tom „Leibchen für FC Nord“, trägt FC Nord Gelb, SV Süd Rot (kit des Anpfiffs)', () => {
    expect(kitAusWahl({ a: ROT, b: ROT }, { bibSide: 'b', bibColor: TURNIER_GELB })).toEqual({ a: ROT, b: TURNIER_GELB, bibSide: 'b' });
  });

  it('@SL-137 Leibchenfarbe änderbar: die gewählte Farbe geht mit', () => {
    expect(kitAusWahl({ a: ROT, b: ROT }, { bibSide: 'a', bibColor: '#00b862' })).toEqual({ a: '#00B862', b: ROT, bibSide: 'a' });
  });

  it('@SL-137 die Leibchenfarbe des Turniers steht als erste Wahl, ohne Doppel', () => {
    const farben = leibchenFarbenMit('#ff6d00');
    expect(farben[0]).toBe('#FF6D00');
    expect(new Set(farben).size).toBe(farben.length);
    expect(leibchenFarbenMit(TURNIER_GELB).filter((f) => f === TURNIER_GELB)).toHaveLength(1);
  });
});

describe('@SL-138/@SL-148 ohne Konflikt kein Hinweis, Leibchen freiwillig', () => {
  it('@SL-138 Rot gegen Weiß: kein Hinweis, ohne Leibchen vorbelegt', () => {
    expect(kitHinweis({ a: ROT, b: WEISS })).toBe('none');
    expect(ersteLeibchenWahl({ a: ROT, b: WEISS }, TURNIER_GELB).bibSide).toBeNull();
  });

  it('@SL-148 Leibchen für TSV Ost (Gast) freiwillig: Gelb über Weiß, SV Süd Rot', () => {
    expect(kitAusWahl({ a: ROT, b: WEISS }, { bibSide: 'b', bibColor: TURNIER_GELB })).toEqual({ a: ROT, b: TURNIER_GELB, bibSide: 'b' });
  });
});

describe('@SL-149 ohne Leibchen anpfeifen', () => {
  it('@SL-149 beide Rot, „Ohne Leibchen“: keine Seite trägt Leibchen, beide Trikotfarben gehen mit', () => {
    expect(kitAusWahl({ a: ROT, b: ROT }, { bibSide: null, bibColor: TURNIER_GELB })).toEqual({ a: ROT, b: ROT });
  });
});

describe('@SL-139/@SL-173 sehr ähnliche Farben (Grenzen aus der Anforderung)', () => {
  it.each([
    ['Schwarz/Dunkelblau', '#000000', NAVY, 'similar'],
    ['Blau/Navy', BLAU, NAVY, 'similar'],
    ['Weiß/Gelb', WEISS, '#FFEB3B', 'similar'],
    ['Weiß/Zitronengelb (Helligkeit)', WEISS, '#FFFF00', 'similar'],
    ['Rot/Weiß', ROT, WEISS, 'none'],
    ['Rot/Grün (Helligkeit, @SL-173)', '#D32F2F', '#2E7D32', 'similar'],
    ['Gelb/Blau', '#FFEB3B', BLAU, 'none'],
    ['Rot/Blau (Helligkeit 1,02:1, @SL-173)', '#C62828', BLAU, 'similar'],
    ['Rot #D32F2F/Weiß (Helligkeit 4,98:1, @SL-173)', '#D32F2F', WEISS, 'none'],
  ])('%s → %s', (_zeile, a, b, erwartet) => {
    expect(kitHinweis({ a, b })).toBe(erwartet);
  });

  it('ohne Trikotfarbe einer Seite kein Hinweis', () => {
    expect(kitHinweis({ a: ROT })).toBe('none');
  });
});

describe('@SL-151 Leibchenfarbe der Farbe des Gegners zu ähnlich', () => {
  it('@SL-151 SV Süd Gelb, TSV Ost Weiß mit gelben Leibchen → Hinweis', () => {
    expect(leibchenGegenGegner({ a: GELB_SV_SUED, b: WEISS }, { bibSide: 'b', bibColor: GELB_LEIBCHEN })).toBe(true);
  });

  it('@SL-151 Gegenprobe: Tom ändert die Leibchenfarbe auf Blau → kein Hinweis', () => {
    expect(leibchenGegenGegner({ a: GELB_SV_SUED, b: WEISS }, { bibSide: 'b', bibColor: BLAU })).toBe(false);
  });

  it('@SL-151 ohne Leibchen nie ein Hinweis zum Leibchen', () => {
    expect(leibchenGegenGegner({ a: GELB_SV_SUED, b: WEISS }, { bibSide: null, bibColor: GELB_LEIBCHEN })).toBe(false);
  });
});

describe('@SL-196 vor dem Anpfiff die echten Trikotfarben, keine Ausweichfarbe', () => {
  it('@SL-196 Blau gegen Blau ohne Leibchen: beide Kästen Blau', () => {
    const kaesten = vorschauKaesten({ a: BLAU, b: BLAU }, { bibSide: null, bibColor: TURNIER_GELB }, STANDARD);
    expect(kaesten.a.fill).toEqual({ kind: 'solid', color: BLAU });
    expect(kaesten.b.fill).toEqual({ kind: 'solid', color: BLAU });
  });

  it('@SL-196 mit Leibchen für Heim vorbelegt: beide Kästen Blau, Heim mit dem Leibchen-Zeichen (die Weste erst ab dem Anpfiff)', () => {
    const kaesten = vorschauKaesten({ a: BLAU, b: BLAU }, { bibSide: 'a', bibColor: TURNIER_GELB }, STANDARD);
    expect(kaesten.a).toEqual({ fill: { kind: 'solid', color: BLAU }, bib: true });
    expect(kaesten.b).toEqual({ fill: { kind: 'solid', color: BLAU }, bib: false });
  });

  it('ohne Trikotfarbe gilt die Standardfarbe der Seite', () => {
    const kaesten = vorschauKaesten({}, { bibSide: null, bibColor: TURNIER_GELB }, STANDARD);
    expect(kaesten.a.fill).toEqual(STANDARD.a.fill);
    expect(kaesten.b.fill).toEqual(STANDARD.b.fill);
  });

  it('trikotFarben liest die aktuellen Teamfarben je Seite, offene Seite ohne Farbe', () => {
    const T1 = '11111111-1111-4111-8111-000000000001';
    const T2 = '11111111-1111-4111-8111-000000000002';
    const teams = [{ id: T1, colors: { primary: '#1565c0' } }, { id: T2, colors: { primary: BLAU } }];
    expect(trikotFarben({ slotA: teamSlot(T1), slotB: teamSlot(T2) }, teams)).toEqual({ a: BLAU, b: BLAU });
    expect(trikotFarben({ slotA: teamSlot(T1), slotB: { kind: 'pending' } as never }, teams)).toEqual({ a: BLAU });
  });
});
