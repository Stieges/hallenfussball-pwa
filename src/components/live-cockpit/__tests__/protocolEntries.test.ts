/**
 * protocolEntries (M2): Log-Reihenfolge ohne Zurueckgenommenes, Zeit-Sortierung nur mit
 * Zurueckgenommenem; Limit-Hilfe fuer die Sidebar zaehlt nur wirksame Eintraege.
 */
import { describe, it, expect } from 'vitest';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { mergeProtocol, takeRecent } from '../components/protocolEntries';

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

describe('takeRecent (M10/U5): Sidebar-Zeitfenster', () => {
  const entry = (id: string, timestampSeconds: number, retracted = false) => ({
    event: event(id, timestampSeconds),
    retracted,
  });

  it('Zurückgenommene nur ab dem ältesten gezeigten wirksamen Eintrag (Grenze)', () => {
    // Anzeige-Reihenfolge: neueste zuerst; angezeigt werden die 2 neuesten wirksamen (30, 20).
    const entries = [
      entry('e3', 30),
      entry('rNeu', 25, true),
      entry('e2', 20),
      entry('rGleich', 20, true),
      entry('rAlt', 19, true),
      entry('e1', 10),
    ];
    expect(takeRecent(entries, 2).map((e) => e.event.id)).toEqual(['e3', 'rNeu', 'e2', 'rGleich']);
  });

  it('Grenze einzeln: gleich alt sichtbar, älter weg, neuer sichtbar', () => {
    const base = [entry('e2', 20), entry('e1', 10)];
    expect(takeRecent([...base, entry('rGleich', 20, true)], 1).map((e) => e.event.id)).toContain('rGleich');
    expect(takeRecent([...base, entry('rAlt', 19, true)], 1).map((e) => e.event.id)).not.toContain('rAlt');
    expect(takeRecent([...base, entry('rNeu', 25, true)], 1).map((e) => e.event.id)).toContain('rNeu');
  });

  it('ohne gezeigte wirksame Einträge erscheinen keine Zurückgenommenen', () => {
    const entries = [entry('r1', 30, true), entry('r2', 20, true)];
    expect(takeRecent(entries, 10)).toEqual([]);
  });

  it('Zurückgenommene verdrängen keine wirksamen Einträge', () => {
    const entries = [entry('e3', 30), entry('r1', 25, true), entry('e2', 20), entry('e1', 10)];
    const ids = takeRecent(entries, 2).map((e) => e.event.id);
    expect(ids.filter((id) => id.startsWith('e'))).toEqual(['e3', 'e2']);
  });
});
