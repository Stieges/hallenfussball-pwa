/**
 * Wächter der Fixtures (B-28a3-0): Jedes Spiel mit Ergebnis ist `finished`. Die einzige laufende Ausnahme ist
 * Spiel 12 (@BM-012, „läuft“ mit Zwischenstand), und die steht ausdrücklich im Test.
 */
import { describe, expect, it } from 'vitest';
import { hallencupSchedule, unfinishedWithResult, withMatchResult } from './pdfFixture';

describe('Fixture-Wächter: Ergebnis heißt finished', () => {
  it('ein Ergebnis über withMatchResult ist finished, Spiel 12 läuft nur explizit', () => {
    const schedule = withMatchResult(
      withMatchResult(hallencupSchedule(), 11, { scoreA: 2, scoreB: 1 }),
      12,
      { scoreA: 1, scoreB: 0 },
      'running',
    );
    expect(unfinishedWithResult(schedule)).toEqual([12]);
  });

  it('gegenbeispiel: ein Ergebnis mit Status scheduled wird gemeldet', () => {
    const schedule = withMatchResult(hallencupSchedule(), 11, { scoreA: 2, scoreB: 1 }, 'scheduled');
    expect(unfinishedWithResult(schedule)).toEqual([11]);
  });

  it('ohne Ergebnis gibt es nichts zu melden', () => {
    expect(unfinishedWithResult(hallencupSchedule())).toEqual([]);
  });
});
