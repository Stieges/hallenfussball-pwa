/**
 * scheduleHelpers (A-08f2, @FU-087): laufend/beendet kommen aus dem Turnier-Spiel (`matchStatus`,
 * Ergebnis), nicht aus dem localStorage-Eintrag `liveMatches-<id>`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Match } from '../../../../types/tournament';
import { isMatchRunning, isMatchFinished } from '../scheduleHelpers';

function spiel(overrides: Partial<Match> = {}): Match {
  return { id: 'm7', round: 1, field: 1, teamA: 'a', teamB: 'b', ...overrides } as unknown as Match;
}

describe('scheduleHelpers (A-08f2, @FU-087)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('@FU-087 Pflicht: matchStatus running -> laufend; scheduled -> nicht laufend', () => {
    expect(isMatchRunning(spiel({ matchStatus: 'running' }))).toBe(true);
    expect(isMatchRunning(spiel({ matchStatus: 'scheduled' }))).toBe(false);
  });

  it('@FU-087 Gegenbeispiel: veralteter localStorage-Eintrag RUNNING macht ein nicht laufendes Spiel nicht laufend', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ m7: { status: 'RUNNING' } }) });
    expect(isMatchRunning(spiel({ matchStatus: 'scheduled' }))).toBe(false);
  });

  it('beendet = Ergebnis vorhanden (unveraendert zu frueher)', () => {
    expect(isMatchFinished(spiel({ scoreA: 1, scoreB: 0 }))).toBe(true);
    expect(isMatchFinished(spiel({ scoreA: 1 }))).toBe(false);
    expect(isMatchFinished(spiel())).toBe(false);
  });
});
