/**
 * H4-10 (@HT-017): „Auf Feld 1 läuft Spiel 11“ – welche Spielnummer läuft auf welchem Feld, und welche Felder die Rückfrage betrifft.
 * Rein; der Hook darüber ist `useLaufendeSpiele` (gleiche Quelle wie `useAngepfiffeneFelder`, dort getestet).
 */
import { describe, expect, it } from 'vitest';
import type { PlanSpiel } from '../runtime/feldStandSpiele';
import { laufendeSpiele } from '../runtime/angepfiffeneFelder';
import { laufendeAufFeldern } from '../ui/useAnhoerenRueckfrage';

const spiel = (id: string, field: number, matchNumber: number, status?: PlanSpiel['status']): PlanSpiel => ({ id, field, matchNumber, status, ctx: null });

describe('@HT-017 laufendeSpiele', () => {
  it('Spiel 11 läuft auf Feld 1, Spiel 12 ist beendet, Spiel 13 steht noch aus → nur Feld 1 mit Nummer 11', () => {
    const plan = [spiel('a', 1, 11, 'RUNNING'), spiel('b', 2, 12, 'FINISHED'), spiel('c', 2, 13)];
    expect([...laufendeSpiele(plan, () => undefined)]).toEqual([[1, 11]]);
  });
  it('ein angehaltenes Spiel läuft noch (angepfiffen); der Stand der Engine geht vor der Kopie', () => {
    expect([...laufendeSpiele([spiel('a', 1, 11, 'PAUSED')], () => undefined)]).toEqual([[1, 11]]);
    expect(laufendeSpiele([spiel('a', 1, 11, 'RUNNING')], () => 'finished').size).toBe(0);
  });
  it('Gegenbeispiel: nichts angepfiffen → keine Rückfrage nötig', () => {
    expect(laufendeSpiele([spiel('a', 1, 11), spiel('b', 2, 12, 'FINISHED')], () => undefined).size).toBe(0);
  });
});

describe('@HT-017 laufendeAufFeldern', () => {
  const laufend = new Map([[1, 11], [2, 12]]);
  it('nur die betroffenen Felder, nach Feld sortiert', () => {
    expect(laufendeAufFeldern(laufend, [2, 1])).toEqual([{ feld: 1, spiel: 11 }, { feld: 2, spiel: 12 }]);
    expect(laufendeAufFeldern(laufend, [2])).toEqual([{ feld: 2, spiel: 12 }]);
  });
  it('Gegenbeispiel: ein Feld ohne laufendes Spiel oder kein Feld → leer', () => {
    expect(laufendeAufFeldern(laufend, [3])).toEqual([]);
    expect(laufendeAufFeldern(laufend, [])).toEqual([]);
  });
});
