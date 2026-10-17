/**
 * A-25a Schritt 3b (@FU-094, Ruling R-A25a-1b): `enterResult` prüft die Regel „K.-o.-Unentschieden braucht ein
 * Strafstoßergebnis, ein Gruppenspiel darf keins haben“ lokal vor dem Senden – mit demselben Grund wie der Server
 * (`append_match_events`, INVALID_PAYLOAD {reason}). Offline über die In-Memory-Engine des Befehls-Harness.
 * Testwerte aus dem Gherkin @FU-094: Halbfinale 1, 2:2, Strafstoßschießen 4:3 für das Heimteam.
 */
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, reduceMatch } from '../../';
import { cacheColumns } from '../cacheColumns';
import { B07_CTX, KICKOFF_AT, makeHarness } from './commandHarness';

const ID = B07_CTX.matchId;
const HEIM = B07_CTX.teamAId;
const GAST = B07_CTX.teamBId;
const ZWEI_ZWEI = { [HEIM]: 2, [GAST]: 2 };
const VIER_DREI = { [HEIM]: 4, [GAST]: 3 };

describe('@FU-094 enterResult prüft das Strafstoßergebnis lokal wie der Server', () => {
  it('@FU-094 K.-o. 2:2 ohne Strafstoß → abgelehnt (SHOOTOUT_REQUIRED), nichts gespeichert, nichts gesendet', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await expect(h.commands.enterResult(ID, B07_CTX, 'leitung', ZWEI_ZWEI, undefined, true)).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_PAYLOAD,
      detail: { reason: 'SHOOTOUT_REQUIRED' },
    });
    expect(h.stored).toHaveLength(0);
    expect(h.kick).not.toHaveBeenCalled();
  });

  it('@FU-094 K.-o. 2:2 + Strafstoß 4:3 für das Heimteam → gespeichert, beendet 2:2, Sieger Heimteam', async () => {
    const h = makeHarness([], KICKOFF_AT);
    const id = await h.commands.enterResult(ID, B07_CTX, 'leitung', ZWEI_ZWEI, VIER_DREI, true);
    expect(h.stored).toHaveLength(1);
    expect(id).toBe(h.stored[0].id);
    expect(h.stored[0].payload).toEqual({ scores: ZWEI_ZWEI, shootout: VIER_DREI });
    const state = reduceMatch(h.log, B07_CTX).state;
    expect(cacheColumns(state, B07_CTX)).toMatchObject({
      match_status: 'finished', score_a: 2, score_b: 2, penalty_score_a: 4, penalty_score_b: 3, decided_by: 'penalty',
    });
    expect(h.kick).toHaveBeenCalledWith(ID);
  });

  it('@FU-094 Gegenbeispiel: Gruppenspiel 2:2 ohne Strafstoß → gespeichert wie bisher', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.enterResult(ID, B07_CTX, 'leitung', ZWEI_ZWEI, undefined, false);
    expect(h.stored).toHaveLength(1);
    expect(h.stored[0].payload).toEqual({ scores: ZWEI_ZWEI });
  });

  it('@FU-094 Gegenbeispiel: Gruppenspiel 2:2 mit Strafstoß → abgelehnt (SHOOTOUT_NOT_ALLOWED), nichts gespeichert', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await expect(h.commands.enterResult(ID, B07_CTX, 'leitung', ZWEI_ZWEI, VIER_DREI, false)).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_PAYLOAD,
      detail: { reason: 'SHOOTOUT_NOT_ALLOWED' },
    });
    expect(h.stored).toHaveLength(0);
    expect(h.kick).not.toHaveBeenCalled();
  });
});
