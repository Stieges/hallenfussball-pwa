/**
 * phaseViewOf: `eingetragenImSpielplan` (@FU-112, @FU-115) -- ein angepfiffenes Spiel, das die Turnierleitung im Spielplan
 * mit dem Ergebnis beendet hat (ein RESULT_ENTRY aus dem laufenden Spiel). Gegenbeispiele: Abpfiff im Cockpit,
 * Direkteintrag eines nie angepfiffenen Spiels (@FU-080), wieder eröffnet und danach abgepfiffen.
 */
import { describe, expect, it } from 'vitest';
import { applyBatch, initialState, type EngineEvent } from '../../../../core/match';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import { phaseViewOf } from '../phaseView';

const ctx = { matchId: 'spiel-9', teamAId: 'a', teamBId: 'b' };
const ev = (id: string, type: EngineEvent['type'], at: number, extra: Partial<EngineEvent> = {}): EngineEvent =>
  ({ id, type, actor: 'helper', at, section: 1, clockMs: null, teamId: null, payload: {}, ...extra });
const start = ev('start', 'MATCH_START', 1000, { payload: { rules: RULES } });
const eintrag = (id: string, at: number, basedOn: string | null) =>
  ev(id, 'RESULT_ENTRY', at, { actor: 'leitung', section: null, payload: { scores: { a: 3, b: 1 }, basedOn } });
const sicht = (events: EngineEvent[]) => phaseViewOf(applyBatch(initialState(ctx), events, ctx).state, ctx, 500_000);

describe('phaseViewOf: eingetragenImSpielplan', () => {
  it('@FU-112 angepfiffen, im Spielplan mit 3:1 beendet -> ID des Eintrags', () => {
    expect(sicht([start, eintrag('e9', 481_000, null)]).eingetragenImSpielplan).toBe('e9');
  });

  it('Gegenbeispiel: im Cockpit abgepfiffen -> null', () => {
    expect(sicht([start, ev('ende', 'MATCH_END', 481_000)]).eingetragenImSpielplan).toBeNull();
  });

  it('Gegenbeispiel @FU-080: nie angepfiffen, direkt eingetragen -> null', () => {
    expect(sicht([{ ...eintrag('d1', 2000, null), payload: { scores: { a: 3, b: 1 } } }]).eingetragenImSpielplan).toBeNull();
  });

  it('Gegenbeispiel: nach dem Beenden wieder eröffnet (Leitung) und im Cockpit abgepfiffen -> null', () => {
    const events = [start, eintrag('e9', 481_000, null), ev('re', 'REOPEN', 482_000, { actor: 'leitung' }), ev('ende', 'MATCH_END', 490_000)];
    expect(sicht(events).eingetragenImSpielplan).toBeNull();
  });

  it('Gegenbeispiel: läuft noch -> null', () => {
    expect(sicht([start]).eingetragenImSpielplan).toBeNull();
  });
});
