/**
 * B-12 (@W2A-022, @W2A-024, @TM-063, @W2A-025, @W2A-026, @FU-119): `MatchCommands.forfeit` und die Rücknahme per `reopen`.
 * Testwerte aus dem Gherkin: Team C tritt gegen Team D nicht an → 2:0 für D; beide fehlen → 0:0 (je 0:2 Tore rechnet die
 * Tabelle); Wertung 3:0 (@W2A-025); Rücknahme → Spiel wieder offen (@W2A-026); angepfiffenes Spiel nicht (@FU-119).
 * Die Tore je Seite liefert `forfeitResultFor` (Modell), der Befehl schreibt sie nur in den Eintrag.
 */
import { describe, expect, it } from 'vitest';
import { ERROR_CODES, reduceMatch } from '../../';
import { forfeitResultFor } from '../../../models/forfeit';
import { cacheColumns } from '../cacheColumns';
import { B07_CTX, KICKOFF_AT, kickoff, makeHarness } from './commandHarness';

const ID = B07_CTX.matchId;
const C = B07_CTX.teamAId;
const D = B07_CTX.teamBId;
const ZWEI_NULL = { winner: 2, loser: 0 };

describe('@W2A-022 forfeit schreibt den Nichtantritt als Ergebniseintrag', () => {
  it('@W2A-022 Team C fehlt: gewertet 0:2 für D, decided_by forfeit, forfeit_absent A', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.forfeit(ID, B07_CTX, 'leitung', 'A', forfeitResultFor({ forfeitScore: ZWEI_NULL }, 'A'));
    expect(h.stored).toHaveLength(1);
    expect(h.stored[0].type).toBe('RESULT_ENTRY');
    expect(h.stored[0].payload).toEqual({ scores: { [C]: 0, [D]: 2 }, forfeit: { absent: 'A' } });
    expect(cacheColumns(reduceMatch(h.log, B07_CTX).state, B07_CTX)).toMatchObject({
      match_status: 'finished', score_a: 0, score_b: 2, decided_by: 'forfeit', forfeit_absent: 'A',
    });
    expect(h.kick).toHaveBeenCalledWith(ID);
  });

  it('@W2A-022 Gegenbeispiel: Team D fehlt → 2:0 für C (nicht seitenvertauscht)', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.forfeit(ID, B07_CTX, 'leitung', 'B', forfeitResultFor({ forfeitScore: ZWEI_NULL }, 'B'));
    expect(h.stored[0].payload).toEqual({ scores: { [C]: 2, [D]: 0 }, forfeit: { absent: 'B' } });
  });

  it('@W2A-025 Wertung 3:0 eingestellt → 3:0', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.forfeit(ID, B07_CTX, 'leitung', 'B', forfeitResultFor({ forfeitScore: { winner: 3, loser: 0 } }, 'B'));
    expect(h.stored[0].payload).toEqual({ scores: { [C]: 3, [D]: 0 }, forfeit: { absent: 'B' } });
  });
});

describe('@W2A-024 @TM-063 beide Teams fehlen', () => {
  it('Gruppenspiel: 0:0 mit absent both, entschieden, kein Sieger', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.forfeit(ID, B07_CTX, 'leitung', 'both', forfeitResultFor({ forfeitScore: ZWEI_NULL }, 'both'));
    expect(h.stored[0].payload).toEqual({ scores: { [C]: 0, [D]: 0 }, forfeit: { absent: 'both' } });
    expect(cacheColumns(reduceMatch(h.log, B07_CTX).state, B07_CTX)).toMatchObject({
      match_status: 'finished', score_a: 0, score_b: 0, decided_by: 'forfeit', forfeit_absent: 'both',
    });
  });

  it('K.-o.: beide fehlen braucht kein Strafstoßergebnis (@TM-062)', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.forfeit(ID, B07_CTX, 'leitung', 'both', { a: 0, b: 0 });
    expect(h.stored).toHaveLength(1);
    expect(h.stored[0].payload).not.toHaveProperty('shootout');
  });
});

describe('@FU-119 nur aus geplant, nur Turnierleitung', () => {
  it('@FU-119 angepfiffenes Spiel → abgelehnt, nichts gespeichert', async () => {
    const h = makeHarness([kickoff()], KICKOFF_AT + 1000);
    await expect(h.commands.forfeit(ID, B07_CTX, 'leitung', 'A', { a: 0, b: 2 })).rejects.toBeInstanceOf(Error);
    expect(h.stored).toHaveLength(0);
    expect(h.kick).not.toHaveBeenCalled();
  });

  it('@HE-042 Helfer → abgelehnt (FORBIDDEN_ACTOR), nichts gespeichert', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await expect(h.commands.forfeit(ID, B07_CTX, 'helper', 'A', { a: 0, b: 2 })).rejects.toMatchObject({
      code: ERROR_CODES.FORBIDDEN_ACTOR,
    });
    expect(h.stored).toHaveLength(0);
  });
});

describe('@W2A-026 Wertung zurücknehmen', () => {
  it('Zurücknehmen per reopen → Spiel wieder geplant, ohne Wertung', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.forfeit(ID, B07_CTX, 'leitung', 'A', { a: 0, b: 2 });
    await h.commands.reopen(ID, B07_CTX, 'leitung');
    const columns = cacheColumns(reduceMatch(h.log, B07_CTX).state, B07_CTX);
    expect(columns).toMatchObject({ match_status: 'scheduled', forfeit_absent: null });
    expect(columns.decided_by).not.toBe('forfeit');
  });

  it('Gegenbeispiel: Helfer nimmt die Wertung nicht zurück', async () => {
    const h = makeHarness([], KICKOFF_AT);
    await h.commands.forfeit(ID, B07_CTX, 'leitung', 'A', { a: 0, b: 2 });
    await expect(h.commands.reopen(ID, B07_CTX, 'helper')).rejects.toMatchObject({ code: ERROR_CODES.FORBIDDEN_ACTOR });
  });
});
