/**
 * @ZM-198 Vor dem ersten beendeten Spiel steht in der Tabelle kein Platz („–“ statt sechsmal „1“); danach die Plätze nach der Wertung.
 * Eine Logik für Monitor-Folie und Zuschauer-Seite (Szenario „Vor dem ersten beendeten Spiel steht in der Tabelle kein Platz“).
 */
import { describe, expect, it } from 'vitest';
import { placeLabel, standingsHaveNoPlaces } from '../placeLabel';

const reihe = (played: number[], places?: number[]) => played.map((p, i) => ({ played: p, place: places?.[i] }));

describe('@ZM-198 Platzziffer der Tabelle', () => {
  it('kein Team hat gespielt: „–“ bei allen sechs, nicht „1“', () => {
    const rows = reihe([0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1]);
    expect(standingsHaveNoPlaces(rows)).toBe(true);
    expect(rows.map((_, i) => placeLabel(rows, i))).toEqual(['–', '–', '–', '–', '–', '–']);
  });

  it('das erste Spiel ist beendet: die Plätze stehen da (gemeinsame Ziffer mit Sprung, sonst Zeilennummer)', () => {
    const rows = reihe([1, 1, 0, 0, 0, 0], [1, 2, 3, 3, 3, 3]);
    expect(rows.map((_, i) => placeLabel(rows, i))).toEqual(['1', '2', '3', '3', '3', '3']);
    const ohnePlatz = reihe([1, 0]);
    expect(placeLabel(ohnePlatz, 0)).toBe('1');
    expect(placeLabel(ohnePlatz, 1)).toBe('2');
  });

  it('Gegenbeispiel: schon ein Team mit einem Spiel genügt, damit kein „–“ mehr steht', () => {
    const rows = reihe([0, 0, 0, 1]);
    expect(rows.map((_, i) => placeLabel(rows, i)).includes('–')).toBe(false);
  });
});
