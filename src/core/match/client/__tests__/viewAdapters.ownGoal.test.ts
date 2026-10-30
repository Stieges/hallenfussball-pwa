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

  // Befund C-RUECKGAENGIG-DOPPELTE-ZEILEN: das Eigentor entsteht im Cockpit als Tor-Tipp, RETRACT und OWN_GOAL (@SL-022). Gespeichert
  // ist nichts doppelt; im Protokoll darf der Zwischenschritt nach „Rückgängig“ aber nicht als zweites „Tor“ auftauchen.
  describe('Eigentor-Weg des Cockpits: Tor-Tipp, RETRACT, OWN_GOAL, dann Rückgängig', () => {
    const tipp = ereignis({ id: 'tipp', type: 'GOAL', at: 2_000, clockMs: 340_000, teamId: 'fc-nord' });
    const tippZurueck = ereignis({ id: 'r-tipp', type: 'RETRACT', at: 2_050, targetId: 'tipp' });
    const eigentor = ereignis({ id: 'og', type: 'OWN_GOAL', at: 2_100, clockMs: 340_000, teamId: 'sv-sued' });
    const rueckgaengig = ereignis({ id: 'r-og', type: 'RETRACT', at: 5_000, targetId: 'og' });

    it('@SL-022 nach einmal „Rückgängig“ steht genau eine zurückgenommene Zeile, und zwar das Eigentor', () => {
      const log = [anpfiff, tipp, tippZurueck, eigentor, rueckgaengig];
      const state = reduceMatch(log, CTX).state;
      const zurueck = toRetractedEvents(state, log, CTX);
      expect(zurueck.map((e) => e.id)).toEqual(['og']);
      expect(zurueck[0].payload).toMatchObject({ ownGoal: true, ownGoalTeamId: 'sv-sued' });
      expect(toRuntimeEvents(state, log, CTX)).toEqual([]);
    });

    it('@SL-022 ohne „Rückgängig“ steht das Eigentor als wirksame Zeile und der Zwischenschritt nicht als zurückgenommen', () => {
      const log = [anpfiff, tipp, tippZurueck, eigentor];
      const state = reduceMatch(log, CTX).state;
      expect(toRuntimeEvents(state, log, CTX).map((e) => e.id)).toEqual(['og']);
      expect(toRetractedEvents(state, log, CTX)).toEqual([]);
    });

    it('Gegenbeispiel: ein zurückgenommenes Tor bleibt sichtbar, auch wenn danach zur selben Spielsekunde ein Eigentor des Gegners fällt', () => {
      const spaeter = ereignis({ id: 'og2', type: 'OWN_GOAL', at: 3_000, clockMs: 340_000, teamId: 'fc-nord' });
      const log = [anpfiff, tipp, tippZurueck, ereignis({ id: 'x', type: 'FOUL', at: 2_060, clockMs: 341_000, teamId: 'sv-sued' }), spaeter];
      const state = reduceMatch(log, CTX).state;
      expect(toRetractedEvents(state, log, CTX).map((e) => e.id)).toEqual(['tipp']);
    });

    it('Gegenbeispiel: ein zurückgenommenes Tor zu einer anderen Spielsekunde bleibt sichtbar', () => {
      const andere = ereignis({ id: 'og3', type: 'OWN_GOAL', at: 2_100, clockMs: 400_000, teamId: 'sv-sued' });
      const log = [anpfiff, tipp, tippZurueck, andere];
      const state = reduceMatch(log, CTX).state;
      expect(toRetractedEvents(state, log, CTX).map((e) => e.id)).toEqual(['tipp']);
    });
  });
});
