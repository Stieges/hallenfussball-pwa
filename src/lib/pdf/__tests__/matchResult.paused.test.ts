/**
 * C-MATCHSTATUS-OHNE-PAUSED (@DR-019): Ein Spiel in Halbzeit, Pause, Entscheidung oder Strafstoßschießen
 * steht in der Cloud als `paused`. Für den Ausdruck ist es „laufend“: „läuft“ und je ein leeres Feld für Heim und
 * Gast (Zeile „Spiel 12 laufend“), nicht „wie geplant“ ohne Hinweis.
 *
 * Gegenbeispiel: ein geplantes Spiel bleibt leer.
 */
import { describe, expect, it } from 'vitest';
import { resultState } from '../matchResult';
import type { StatefulMatch } from '../tournamentState';
import { hallencupSchedule } from './pdfFixture';

function spielMit(matchStatus: StatefulMatch['matchStatus']): StatefulMatch {
  const base = hallencupSchedule().allMatches[0];
  return { ...base, matchStatus };
}

describe('C-MATCHSTATUS-OHNE-PAUSED: Ausdruck kennt den Cloud-Status paused', () => {
  it('@DR-019 Spiel in der Halbzeit (Cloud-Status paused) ist laufend: „läuft“ mit leeren Feldern', () => {
    expect(resultState(spielMit('paused'))).toEqual({ kind: 'live' });
    expect(resultState(spielMit('running'))).toEqual({ kind: 'live' });
  });

  it('Gegenbeispiel: ein geplantes Spiel bleibt leer', () => {
    expect(resultState(spielMit('scheduled'))).toEqual({ kind: 'empty' });
  });
});
