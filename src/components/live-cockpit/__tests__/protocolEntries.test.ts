/**
 * protocolEntries (M2): Log-Reihenfolge ohne Zurueckgenommenes, Zeit-Sortierung nur mit
 * Zurueckgenommenem; Limit-Hilfe fuer die Sidebar zaehlt nur wirksame Eintraege.
 */
import { describe, it, expect } from 'vitest';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { mergeProtocol } from '../components/protocolEntries';

const event = (id: string, timestampSeconds: number): RuntimeMatchEvent => ({
  id,
  timestampSeconds,
  type: 'GOAL',
  payload: { teamId: 'teamA' },
  scoreAfter: { home: 1, away: 0 },
});

describe('mergeProtocol (M2)', () => {
  it('ohne Zurueckgenommenes bleibt die Log-Reihenfolge (auch bei nicht-monotoner Zeit)', () => {
    const entries = mergeProtocol([event('a', 30), event('b', 10), event('c', 20)]);
    expect(entries.map((entry) => entry.event.id)).toEqual(['a', 'b', 'c']);
  });

  it('mit Zurueckgenommenem sortiert nach Spielzeit; bei Gleichstand wirksame vor zurueckgenommenen', () => {
    const entries = mergeProtocol([event('a', 20), event('b', 20)], [event('r1', 10), event('r2', 20)]);
    expect(entries.map((entry) => entry.event.id)).toEqual(['r1', 'a', 'b', 'r2']);
  });
});
