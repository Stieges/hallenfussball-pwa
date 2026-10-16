/**
 * B-07 / L2, Spur-A-Anteil (Ruling R9, Befund S18): ein Eigentor bleibt in der Anzeige erkennbar.
 * `toRuntimeEvents` fuehrt `OWN_GOAL` weiter als `GOAL` des beguenstigten Teams (Stand,
 * Torschuetzenliste), setzt aber `payload.ownGoal` und `payload.ownGoalTeamId` (Team, das das
 * Eigentor geschossen hat). @SL-022: „Eigentor SV Süd, Nr. 4, 5:40“.
 */
import { describe, it, expect } from 'vitest';
import { toRetractedEvents, toRuntimeEvents } from '../viewAdapters';
import { reduceMatch, type EngineEvent, type MatchContext } from '../../';
import { RULES } from './fixtures';

const CTX: MatchContext = { matchId: 'spiel-11', teamAId: 'fc-nord', teamBId: 'sv-sued' };

function ereignis(partial: Partial<EngineEvent> & Pick<EngineEvent, 'id' | 'type' | 'at'>): EngineEvent {
  return { actor: 'helper', section: 1, clockMs: null, teamId: null, targetId: null, payload: {}, ...partial };
}

const anpfiff = ereignis({ id: 's', type: 'MATCH_START', at: 1_000, clockMs: 0, payload: { rules: RULES } });
const torNord = ereignis({ id: 'g1', type: 'GOAL', at: 2_000, clockMs: 100_000, teamId: 'fc-nord', payload: { playerNumber: 7 } });
const eigentorSued = ereignis({
  id: 'og1',
  type: 'OWN_GOAL',
  at: 3_000,
  clockMs: 340_000,
  teamId: 'sv-sued',
  payload: { playerNumber: 4 },
});

describe('toRuntimeEvents – Eigentor-Kennzeichnung (@SL-022, L2)', () => {
  it('@SL-022 OWN_GOAL von SV Süd bei 5:40 -> GOAL fuer FC Nord mit ownGoal und ownGoalTeamId', () => {
    const log = [anpfiff, torNord, eigentorSued];
    const events = toRuntimeEvents(reduceMatch(log, CTX).state, log, CTX);

    expect(events[1]).toMatchObject({
      id: 'og1',
      type: 'GOAL',
      timestampSeconds: 340,
      payload: { teamId: 'fc-nord', ownGoal: true, ownGoalTeamId: 'sv-sued', playerNumber: 4 },
      scoreAfter: { home: 2, away: 0 },
    });
  });

  it('Gegenbeispiel: ein normales Tor traegt weder ownGoal noch ownGoalTeamId', () => {
    const log = [anpfiff, torNord];
    const [tor] = toRuntimeEvents(reduceMatch(log, CTX).state, log, CTX);

    expect(tor.payload).toEqual({ teamId: 'fc-nord', playerNumber: 7 });
    expect(tor.payload).not.toHaveProperty('ownGoal');
    expect(tor.payload).not.toHaveProperty('ownGoalTeamId');
  });

  it('zurueckgenommenes Eigentor bleibt in der Protokoll-Anzeige als Eigentor erkennbar', () => {
    const log = [anpfiff, eigentorSued, ereignis({ id: 'r1', type: 'RETRACT', at: 4_000, targetId: 'og1' })];
    const [zurueck] = toRetractedEvents(reduceMatch(log, CTX).state, log, CTX);

    expect(zurueck.payload).toMatchObject({ teamId: 'fc-nord', ownGoal: true, ownGoalTeamId: 'sv-sued' });
  });
});
