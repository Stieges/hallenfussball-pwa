/**
 * B-07a: Befehle `skip`, `unskip` und der Stapel `unskipAndEnterResult`. Werte aus dem Gherkin:
 * @FU-089 (Ueberspringen ueber den Server), @FU-071 (wieder einplanen nur Leitung),
 * @FU-081 (laufendes Spiel -> abgelehnt), @FU-093 (abgesetztes Spiel bekommt nach Rueckfrage ein
 * Ergebnis, Olli traegt 3:1 fuer Spiel 9 ein).
 */
import { describe, it, expect } from 'vitest';
import { effectiveScoreFor, ERROR_CODES, reduceMatch, type EngineEvent } from '../../';
import { MatchCommandRejectedError } from '../MatchCommands';
import { B07_CTX, KICKOFF_AT, kickoff, makeHarness, plain } from './commandHarness';

const K = KICKOFF_AT;
const ID = B07_CTX.matchId;
const SCORES = { 'fc-nord': 3, 'sv-sued': 1 };

const skipped = (): EngineEvent[] => [plain('SKIP', K - 60_000, null, 1, { actor: 'leitung' })];
const running = (): EngineEvent[] => [kickoff()];
const finished = (): EngineEvent[] => [kickoff(), plain('MATCH_END', K + 400_000, 400_000, 1)];
const statusOf = (log: EngineEvent[]): string => reduceMatch(log, B07_CTX).state.status;

async function rejectionOf(promise: Promise<unknown>): Promise<MatchCommandRejectedError> {
  const error: unknown = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(MatchCommandRejectedError);
  return error as MatchCommandRejectedError;
}

describe('@FU-089 skip', () => {
  it('@FU-089 skip auf einem angesetzten Spiel: Eintrag [SKIP], Ansicht uebersprungen, Ausgang 1, ein kick', async () => {
    const h = makeHarness([], K);
    const id = await h.commands.skip(ID, B07_CTX, 'leitung');
    expect(h.stored.map((event) => event.type)).toEqual(['SKIP']);
    expect(h.stored[0]).toMatchObject({ actor: 'leitung', teamId: null, targetId: null, payload: {} });
    expect(id).toBe(h.stored[0].id);
    expect(statusOf(h.log)).toBe('skipped');
    expect(h.storeCalls).toEqual(['pending:SKIP']);
    expect(h.kick).toHaveBeenCalledTimes(1);
  });

  it('@FU-089 skip mit Grund: der Grund steht in der Payload', async () => {
    const h = makeHarness([], K);
    await h.commands.skip(ID, B07_CTX, 'leitung', 'Platz gesperrt');
    expect(h.stored[0].payload).toEqual({ reason: 'Platz gesperrt' });
  });

  it('@FU-089 Gegenbeispiel: skip sendet kein UNSKIP und keinen anderen Typ', async () => {
    const h = makeHarness([], K);
    await h.commands.skip(ID, B07_CTX, 'leitung');
    expect(h.stored.every((event) => event.type === 'SKIP')).toBe(true);
  });

  it('@FU-089 Gast: skip wird sofort bestaetigt gespeichert, kein kick', async () => {
    const h = makeHarness([], K, 'guest');
    await h.commands.skip(ID, B07_CTX, 'leitung');
    expect(h.storeCalls).toEqual(['confirmed:SKIP']);
    expect(h.kick).not.toHaveBeenCalled();
  });
});

describe('@FU-081 / @FU-071 Gegenbeispiele skip', () => {
  it('@FU-081 skip auf laufendem Spiel -> INVALID_TRANSITION, Store unveraendert, kein kick', async () => {
    const h = makeHarness(running(), K + 1000);
    const rejected = await rejectionOf(h.commands.skip(ID, B07_CTX, 'leitung'));
    expect(rejected.code).toBe(ERROR_CODES.INVALID_TRANSITION);
    expect(h.stored).toHaveLength(0);
    expect(h.kick).not.toHaveBeenCalled();
  });

  it('@FU-081 skip auf beendetem Spiel -> abgelehnt (MATCH_FINISHED), Store unveraendert', async () => {
    const h = makeHarness(finished(), K + 500_000);
    const rejected = await rejectionOf(h.commands.skip(ID, B07_CTX, 'leitung'));
    expect(rejected.code).toBe(ERROR_CODES.MATCH_FINISHED);
    expect(h.stored).toHaveLength(0);
    expect(h.kick).not.toHaveBeenCalled();
  });

  it('@FU-071 skip als Helfer -> FORBIDDEN_ACTOR, Store unveraendert', async () => {
    const h = makeHarness([], K);
    const rejected = await rejectionOf(h.commands.skip(ID, B07_CTX, 'helper'));
    expect(rejected.code).toBe(ERROR_CODES.FORBIDDEN_ACTOR);
    expect(h.stored).toHaveLength(0);
    expect(h.kick).not.toHaveBeenCalled();
  });
});

describe('@FU-071 unskip', () => {
  it('@FU-071 unskip (Leitung) auf uebersprungenem Spiel: Eintrag [UNSKIP], Ansicht angesetzt, ein kick', async () => {
    const h = makeHarness(skipped(), K);
    const id = await h.commands.unskip(ID, B07_CTX, 'leitung');
    expect(h.stored.map((event) => event.type)).toEqual(['UNSKIP']);
    expect(id).toBe(h.stored[0].id);
    expect(statusOf(h.log)).toBe('scheduled');
    expect(h.kick).toHaveBeenCalledTimes(1);
  });

  it('@FU-071 Gegenbeispiel: unskip als Helfer -> FORBIDDEN_ACTOR („nur Turnierleitung“), Store unveraendert', async () => {
    const h = makeHarness(skipped(), K);
    const rejected = await rejectionOf(h.commands.unskip(ID, B07_CTX, 'helper'));
    expect(rejected.code).toBe(ERROR_CODES.FORBIDDEN_ACTOR);
    expect(h.stored).toHaveLength(0);
    expect(statusOf(h.log)).toBe('skipped');
    expect(h.kick).not.toHaveBeenCalled();
  });

  it('@FU-071 Gegenbeispiel: unskip auf angesetztem Spiel -> INVALID_TRANSITION', async () => {
    const h = makeHarness([], K);
    const rejected = await rejectionOf(h.commands.unskip(ID, B07_CTX, 'leitung'));
    expect(rejected.code).toBe(ERROR_CODES.INVALID_TRANSITION);
    expect(h.stored).toHaveLength(0);
  });

  it('@FU-071 Gast: unskip wird sofort bestaetigt gespeichert, kein kick', async () => {
    const h = makeHarness(skipped(), K, 'guest');
    await h.commands.unskip(ID, B07_CTX, 'leitung');
    expect(h.storeCalls).toEqual(['confirmed:UNSKIP']);
    expect(h.kick).not.toHaveBeenCalled();
  });
});

describe('@FU-093 Stapel unskip + enterResult', () => {
  it('@FU-093 abgesetztes Spiel + Ja: UNSKIP und RESULT_ENTRY 3:1, Ansicht beendet 3:1, ein Speichern, ein kick', async () => {
    const h = makeHarness(skipped(), K);
    const id = await h.commands.unskipAndEnterResult(ID, B07_CTX, 'leitung', SCORES);
    expect(h.stored.map((event) => event.type)).toEqual(['UNSKIP', 'RESULT_ENTRY']);
    expect(h.stored.map((event) => event.actor)).toEqual(['leitung', 'leitung']);
    expect(h.stored[1].payload).toEqual({ scores: SCORES });
    expect(id).toBe(h.stored[1].id);
    expect(h.storeCalls).toEqual(['pendingBatch:UNSKIP+RESULT_ENTRY']);
    expect(h.kick).toHaveBeenCalledTimes(1);
    const { state } = reduceMatch(h.log, B07_CTX);
    expect(state.status).toBe('finished');
    expect(effectiveScoreFor(state, 'fc-nord')).toBe(3);
    expect(effectiveScoreFor(state, 'sv-sued')).toBe(1);
  });

  it('@FU-093 die Zeitstempel des Stapels laufen nicht rueckwaerts', async () => {
    const h = makeHarness(skipped(), K);
    await h.commands.unskipAndEnterResult(ID, B07_CTX, 'leitung', SCORES);
    expect(h.stored[1].at).toBeGreaterThanOrEqual(h.stored[0].at);
  });

  it('@FU-093 Gegenbeispiel: Stapel auf angesetztem Spiel (UNSKIP unzulaessig) -> abgelehnt, nichts gespeichert, kein kick', async () => {
    const h = makeHarness([], K);
    const rejected = await rejectionOf(h.commands.unskipAndEnterResult(ID, B07_CTX, 'leitung', SCORES));
    expect(rejected.code).toBe(ERROR_CODES.INVALID_TRANSITION);
    expect(h.stored).toHaveLength(0);
    expect(h.storeCalls).toEqual([]);
    expect(h.kick).not.toHaveBeenCalled();
    expect(statusOf(h.log)).toBe('scheduled');
  });

  it('@FU-093 Gegenbeispiel: Stapel auf beendetem Spiel -> abgelehnt (MATCH_FINISHED), nichts gespeichert', async () => {
    const h = makeHarness(finished(), K + 500_000);
    const rejected = await rejectionOf(h.commands.unskipAndEnterResult(ID, B07_CTX, 'leitung', SCORES));
    expect(rejected.code).toBe(ERROR_CODES.MATCH_FINISHED);
    expect(h.stored).toHaveLength(0);
  });

  it('@FU-093 Gegenbeispiel: ungueltiges Ergebnis -> kein halber Stapel (auch UNSKIP nicht gespeichert)', async () => {
    const h = makeHarness(skipped(), K);
    const rejected = await rejectionOf(h.commands.unskipAndEnterResult(ID, B07_CTX, 'leitung', { 'fc-nord': 3 }));
    expect(rejected.code).toBe(ERROR_CODES.INVALID_PAYLOAD);
    expect(h.stored).toHaveLength(0);
    expect(h.kick).not.toHaveBeenCalled();
    expect(statusOf(h.log)).toBe('skipped');
  });

  it('@FU-093 Gegenbeispiel: Stapel als Helfer -> FORBIDDEN_ACTOR, nichts gespeichert', async () => {
    const h = makeHarness(skipped(), K);
    const rejected = await rejectionOf(h.commands.unskipAndEnterResult(ID, B07_CTX, 'helper', SCORES));
    expect(rejected.code).toBe(ERROR_CODES.FORBIDDEN_ACTOR);
    expect(h.stored).toHaveLength(0);
  });

  it('@FU-093 Gast: beide Eintraege sofort bestaetigt, in einem Speichern, kein kick', async () => {
    const h = makeHarness(skipped(), K, 'guest');
    await h.commands.unskipAndEnterResult(ID, B07_CTX, 'leitung', SCORES);
    expect(h.storeCalls).toEqual(['confirmedBatch:UNSKIP+RESULT_ENTRY']);
    expect(h.kick).not.toHaveBeenCalled();
  });
});
