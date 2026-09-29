/**
 * C3b-1 (Plan G6, §8 Zeile 11+19): zurueckgenommene Eintraege in einer GETRENNTEN Liste
 * (`retractedEvents`), `events` bleibt ohne Zurueckgenommenes; "offen" = Nummer fehlt (nicht `incomplete`).
 */
import { describe, it, expect } from 'vitest';
import { toRuntimeEvents, toRetractedEvents, toLiveMatchView, foulCounts } from '../viewAdapters';
import { applyEvent, reduceMatch, type EngineEvent } from '../../';
import { T, ctx, ev, goal, meta, start } from './fixtures';

const view = (log: EngineEvent[]) => {
  const state = reduceMatch(log, ctx).state;
  return { state, log };
};

describe('toRetractedEvents (G6)', () => {
  const log = [
    start(),
    goal('g1', 'teamA', 2000, 30_000, { playerNumber: 7 }),
    goal('g2', 'teamB', 3000, 40_000),
    ev({ id: 'f1', type: 'FOUL', at: 3500, teamId: 'teamA', clockMs: 45_000 }),
    ev({ id: 'r1', type: 'RETRACT', at: 4000, targetId: 'g2' }),
    ev({ id: 'r2', type: 'RETRACT', at: 4500, targetId: 'f1' }),
  ];

  it('liefert nur zurueckgenommene Eintraege, in Log-Reihenfolge, mit Typ/Nummer/Zeit', () => {
    const { state } = view(log);
    const retracted = toRetractedEvents(state, log, ctx);
    expect(retracted.map((e) => [e.id, e.type])).toEqual([['g2', 'GOAL'], ['f1', 'FOUL']]);
    expect(retracted[0].timestampSeconds).toBe(40);
    expect(retracted[0].payload.teamId).toBe('teamB');
  });

  it('LiveMatch.events bleibt OHNE Zurueckgenommenes, retractedEvents traegt sie', () => {
    const { state } = view(log);
    const match = toLiveMatchView(state, meta, { serverNow: T, offsetMs: 0 }, log);
    expect(match.events.map((e) => e.id)).toEqual(['g1']);
    expect(match.retractedEvents?.map((e) => e.id)).toEqual(['g2', 'f1']);
  });

  it('Fouls und offene Eintraege zaehlen Zurueckgenommenes nicht (foulCounts, events)', () => {
    const { state } = view(log);
    expect(foulCounts(state)).toEqual({});
    expect(toRuntimeEvents(state, log, ctx).some((e) => e.type === 'FOUL')).toBe(false);
    expect(toRuntimeEvents(state, log, ctx).filter((e) => e.incomplete === true)).toEqual([]);
  });
});

describe('offen = Nummer fehlt (G10, Plan §8 Zeile 11+19)', () => {
  it('Tor ohne Nummer ist offen, auch wenn payload.incomplete false sagt', () => {
    const log = [start(), goal('g1', 'teamA', 2000, 30_000, { incomplete: false })];
    const { state } = view(log);
    expect(toRuntimeEvents(state, log, ctx)[0].incomplete).toBe(true);
  });

  it('Tor mit Nummer ist nicht offen, auch wenn payload.incomplete true sagt', () => {
    const log = [start(), goal('g1', 'teamA', 2000, 30_000, { playerNumber: 7, incomplete: true })];
    const { state } = view(log);
    expect(toRuntimeEvents(state, log, ctx)[0].incomplete).toBe(false);
  });

  it('AMEND mit Nummer schliesst den Eintrag, AMEND clear oeffnet ihn wieder', () => {
    const base = [start(), goal('g1', 'teamA', 2000, 30_000, { incomplete: true })];
    const amended = [...base, ev({ id: 'a1', type: 'AMEND', at: 2500, targetId: 'g1', payload: { playerNumber: 7 } })];
    const cleared = [...amended, ev({ id: 'a2', type: 'AMEND', at: 2600, targetId: 'g1', payload: { clear: ['playerNumber'] } })];
    expect(toRuntimeEvents(view(base).state, base, ctx)[0].incomplete).toBe(true);
    expect(toRuntimeEvents(view(amended).state, amended, ctx)[0].incomplete).toBe(false);
    expect(toRuntimeEvents(view(cleared).state, cleared, ctx)[0].incomplete).toBe(true);
  });

  it('Pflicht: Helfer, finished, Tor "Ohne Nr." -> Nummer nachtragen -> angenommen, Eintrag nicht mehr offen', () => {
    const log = [
      start(),
      goal('g1', 'teamA', 2000, 30_000, { incomplete: true }),
      ev({ id: 'end', type: 'MATCH_END', at: 4000, section: 1, clockMs: 600_000 }),
    ];
    const { state } = view(log);
    expect(state.status).toBe('finished');
    expect(toRuntimeEvents(state, log, ctx)[0].incomplete).toBe(true);

    const amend = ev({ id: 'a1', type: 'AMEND', at: 5000, targetId: 'g1', actor: 'helper', payload: { playerNumber: 7 } });
    const result = applyEvent(state, amend, ctx);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      const after = toRuntimeEvents(result.state, [...log, amend], ctx);
      expect(after[0].incomplete).toBe(false);
      expect(after[0].payload.playerNumber).toBe(7);
    }
  });

  it('Foul ohne Nummer bleibt ohne Offen-Markierung (keine Nummernabfrage im Cockpit)', () => {
    const log = [start(), ev({ id: 'f1', type: 'FOUL', at: 3000, teamId: 'teamA', clockMs: 45_000 })];
    expect(toRuntimeEvents(view(log).state, log, ctx)[0].incomplete).toBeUndefined();
  });
});
