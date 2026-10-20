/**
 * A-25n – Nichtantritt in der Rechenfunktion (TS-Seite), Rücknahme über REOPEN mit Ziel `@reopen` (R-GA4-4).
 *
 * Testwerte aus dem Gherkin (wörtlich):
 *  - @W2A-022 „Team C tritt zu seinem Spiel gegen Team D nicht an … ‚nicht angetreten‘ für Team C … mit 2:0 und den Punkten
 *    für einen Sieg für Team D gewertet … in allen Ansichten als Wertung gekennzeichnet“
 *    (docs/anforderungen/2026-09-27_wizard-regelinhalte.md).
 *  - @W2A-024 / @TM-063 „Team C und Team D treten … beide nicht an … Das Spiel gilt als entschieden“ (Punkte und Tore der
 *    Tabelle rechnet A-25c; die Rechenfunktion speichert die Wertung 0:0 mit `absent both`).
 *  - @W2A-026 „Wenn die Turnierleitung die Wertung zurücknimmt, dann ist das Spiel wieder offen“.
 * Gegenbeispiele und Mutationen aus dem Plan (task-GA4-plan-v2.md A-25n = v1 A-25a): falscher Sieger, `both` nicht 0:0,
 * REOPEN nach einem gespielten 1:0 bleibt `running`, Helfer nimmt keine Wertung zurück, Korrektur nach der Wertung.
 * Der SQL-Zwilling läuft über die Fixtures 69a–69l (match-engine-parity.sh, append-match-events-check.sh, forfeit-check.sh).
 */
import { describe, expect, it } from 'vitest';
import { isPayloadValid } from '../payloadValidation';
import { reduceMatch } from '../reduceMatch';
import { cacheColumns } from '../client/cacheColumns';
import { shootoutRuleViolation } from '../resultEntryShootout';
import { toServerState } from '../serverState';
import type { EngineEvent, MatchContext } from '../types';

const C = 'team-c';
const D = 'team-d';
const ctx: MatchContext = { matchId: 'spiel-c-d', teamAId: C, teamBId: D };

let seq = 0;
function ev(type: EngineEvent['type'], payload: Record<string, unknown> = {}, extra: Partial<EngineEvent> = {}): EngineEvent {
  seq += 1;
  const id = `0000a25e-0000-4000-8000-${String(seq).padStart(12, '0')}`;
  return { id, type, actor: 'leitung', at: 1000 * seq, section: null, clockMs: null, payload, ...extra };
}
function wertung(absent: string, scores: Record<string, number>, extra: Record<string, unknown> = {}): EngineEvent {
  return ev('RESULT_ENTRY', { scores, forfeit: { absent }, ...extra });
}
const cFehlt = () => wertung('A', { [C]: 0, [D]: 2 });

describe('@W2A-022 Nichtantritt wird gewertet', () => {
  it('@W2A-022 „nicht angetreten“ für Team C: Spiel beendet 0:2, gewertet für Team D, als Wertung gekennzeichnet', () => {
    const { state, results } = reduceMatch([cFehlt()], ctx);
    expect(results[0].status).toBe('accepted');
    expect(toServerState(state)).toMatchObject({ status: 'finished', effectiveScores: { [C]: 0, [D]: 2 }, decidedBy: 'forfeit' });
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'finished',
      score_a: 0,
      score_b: 2,
      decided_by: 'forfeit',
      forfeit_absent: 'A',
    });
  });

  it('@W2A-022 „nicht angetreten“ für Team D (Gastseite): 2:0 für Team C, fehlend B', () => {
    const { state } = reduceMatch([wertung('B', { [C]: 2, [D]: 0 })], ctx);
    expect(cacheColumns(state, ctx)).toMatchObject({ score_a: 2, score_b: 0, decided_by: 'forfeit', forfeit_absent: 'B' });
  });

  it('@W2A-022 die Überschreibung trägt Art „forfeit“ und den Fehlenden (Grundlage für Kennzeichnung und Rücknahme)', () => {
    const { state } = reduceMatch([cFehlt()], ctx);
    expect(state.overrides[0]).toMatchObject({ kind: 'forfeit', absent: 'A', scores: { [C]: 0, [D]: 2 } });
  });

  it('@W2A-022 Gegenbeispiel: ein Direkteintrag 0:2 ohne Nichtantritt bleibt ein gespieltes Ergebnis (regular, kein Fehlender)', () => {
    const { state } = reduceMatch([ev('RESULT_ENTRY', { scores: { [C]: 0, [D]: 2 } })], ctx);
    expect(cacheColumns(state, ctx)).toMatchObject({ decided_by: 'regular', forfeit_absent: null });
    expect(state.overrides[0].kind).toBe('direct');
  });

  it('@W2A-022 Gegenbeispiel: ein Helfer darf keine Wertung eintragen (FORBIDDEN_ACTOR, Spiel bleibt offen)', () => {
    const { state, results } = reduceMatch([{ ...cFehlt(), actor: 'helper' }], ctx);
    expect(results[0]).toMatchObject({ status: 'rejected', code: 'FORBIDDEN_ACTOR' });
    expect(state.status).toBe('scheduled');
  });
});

describe('@W2A-022 Form der Wertung (Gegenbeispiele)', () => {
  it.each([
    { fall: 'C fehlt, aber 2:0 für C (falscher Sieger)', payload: { scores: { [C]: 2, [D]: 0 }, forfeit: { absent: 'A' } } },
    { fall: 'D fehlt, aber 0:2 für D', payload: { scores: { [C]: 0, [D]: 2 }, forfeit: { absent: 'B' } } },
    { fall: 'C fehlt bei 1:1', payload: { scores: { [C]: 1, [D]: 1 }, forfeit: { absent: 'A' } } },
    { fall: 'beide fehlen, aber 2:0', payload: { scores: { [C]: 2, [D]: 0 }, forfeit: { absent: 'both' } } },
    { fall: 'beide fehlen, aber 1:1', payload: { scores: { [C]: 1, [D]: 1 }, forfeit: { absent: 'both' } } },
    { fall: 'unbekannte Seite', payload: { scores: { [C]: 0, [D]: 2 }, forfeit: { absent: 'C' } } },
    { fall: 'leeres forfeit', payload: { scores: { [C]: 0, [D]: 2 }, forfeit: {} } },
    { fall: 'forfeit null', payload: { scores: { [C]: 0, [D]: 2 }, forfeit: null } },
    { fall: 'forfeit mit Zusatzschlüssel', payload: { scores: { [C]: 0, [D]: 2 }, forfeit: { absent: 'A', grund: 'Bus' } } },
    { fall: 'forfeit als Text', payload: { scores: { [C]: 0, [D]: 2 }, forfeit: 'A' } },
    { fall: 'beide fehlen mit Strafstoßergebnis', payload: { scores: { [C]: 0, [D]: 0 }, forfeit: { absent: 'both' }, shootout: { [C]: 4, [D]: 3 } } },
  ])('@W2A-022 $fall ist ungültig (INVALID_PAYLOAD)', ({ payload }) => {
    const event = ev('RESULT_ENTRY', payload);
    expect(isPayloadValid(event, ctx)).toBe(false);
    expect(reduceMatch([event], ctx).results[0]).toMatchObject({ status: 'rejected', code: 'INVALID_PAYLOAD' });
  });
});

describe('@W2A-024 @TM-063 Beide Teams treten nicht an', () => {
  it('@W2A-024 @TM-063 „nicht angetreten“ für beide: das Spiel gilt als entschieden, als Wertung gekennzeichnet', () => {
    const { state, results } = reduceMatch([wertung('both', { [C]: 0, [D]: 0 })], ctx);
    expect(results[0].status).toBe('accepted');
    expect(state.status).toBe('finished');
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'finished',
      score_a: 0,
      score_b: 0,
      decided_by: 'forfeit',
      forfeit_absent: 'both',
    });
  });

  it('@W2A-024 Gegenbeispiel: ein gespieltes 0:0 bleibt ein gespieltes Ergebnis (regular, kein Fehlender)', () => {
    const start = ev('MATCH_START', {
      rules: { sections: 1, sectionSeconds: 600, breakSeconds: 0, knockout: false, tiebreak: null, overtimeSeconds: 0, shootersPerTeam: 0, suddenDeathAfter: 0, penaltySeconds: 0 },
    }, { section: 1, clockMs: 0 });
    const ende = ev('MATCH_END', {}, { section: 1, clockMs: 600000 });
    const { state } = reduceMatch([start, ende], ctx);
    expect(cacheColumns(state, ctx)).toMatchObject({ match_status: 'finished', score_a: 0, score_b: 0, decided_by: 'regular', forfeit_absent: null });
  });

  it('@W2A-024 im K.-o. verlangt „beide fehlen“ kein Strafstoßergebnis (der Server lehnt nicht mit SHOOTOUT_REQUIRED ab)', () => {
    expect(shootoutRuleViolation(true, { scores: { [C]: 0, [D]: 0 }, forfeit: { absent: 'both' } })).toBeNull();
  });

  it('@W2A-024 Gegenbeispiel: K.-o. 0:0 ohne Nichtantritt und ohne Strafstoß bleibt SHOOTOUT_REQUIRED', () => {
    expect(shootoutRuleViolation(true, { scores: { [C]: 0, [D]: 0 } })).toBe('SHOOTOUT_REQUIRED');
  });
});

describe('@W2A-026 Nichtantritt zurücknehmen', () => {
  it('@W2A-026 die Turnierleitung nimmt die Wertung zurück: das Spiel ist wieder offen (geplant, ohne Stand)', () => {
    const { state, results } = reduceMatch([cFehlt(), ev('REOPEN')], ctx);
    expect(results.map((r) => r.status)).toEqual(['accepted', 'accepted']);
    expect(toServerState(state)).toMatchObject({ status: 'scheduled', decidedBy: null, finishedAt: null, effectiveScores: { [C]: 0, [D]: 0 } });
    expect(state.overrides).toEqual([]);
    expect(cacheColumns(state, ctx)).toMatchObject({
      match_status: 'scheduled',
      score_a: null,
      score_b: null,
      decided_by: null,
      forfeit_absent: null,
      started: false,
      running: false,
    });
  });

  it('@W2A-026 danach wird das Spiel normal angepfiffen und gespielt (1:0 regulär)', () => {
    const start = ev('MATCH_START', {
      rules: { sections: 1, sectionSeconds: 600, breakSeconds: 0, knockout: false, tiebreak: null, overtimeSeconds: 0, shootersPerTeam: 0, suddenDeathAfter: 0, penaltySeconds: 0 },
    }, { section: 1, clockMs: 0 });
    const tor = ev('GOAL', {}, { section: 1, clockMs: 1000, teamId: C });
    const ende = ev('MATCH_END', {}, { section: 1, clockMs: 600000 });
    const { state, results } = reduceMatch([cFehlt(), ev('REOPEN'), start, tor, ende], ctx);
    expect(results.every((r) => r.status === 'accepted')).toBe(true);
    expect(cacheColumns(state, ctx)).toMatchObject({ match_status: 'finished', score_a: 1, score_b: 0, decided_by: 'regular', forfeit_absent: null });
  });

  it('@W2A-026 Gegenbeispiel: ein Helfer nimmt keine Wertung zurück (FORBIDDEN_ACTOR, Wertung bleibt)', () => {
    const { state, results } = reduceMatch([cFehlt(), { ...ev('REOPEN'), actor: 'helper' }], ctx);
    expect(results[1]).toMatchObject({ status: 'rejected', code: 'FORBIDDEN_ACTOR' });
    expect(cacheColumns(state, ctx)).toMatchObject({ match_status: 'finished', decided_by: 'forfeit', forfeit_absent: 'A' });
  });

  it('@W2A-026 Gegenbeispiel: REOPEN nach einem gespielten 1:0 lässt das Spiel weiterlaufen (running, Stand bleibt)', () => {
    const start = ev('MATCH_START', {
      rules: { sections: 1, sectionSeconds: 600, breakSeconds: 0, knockout: false, tiebreak: null, overtimeSeconds: 0, shootersPerTeam: 0, suddenDeathAfter: 0, penaltySeconds: 0 },
    }, { section: 1, clockMs: 0 });
    const tor = ev('GOAL', {}, { section: 1, clockMs: 1000, teamId: C });
    const ende = ev('MATCH_END', {}, { section: 1, clockMs: 600000 });
    const { state } = reduceMatch([start, tor, ende, ev('REOPEN')], ctx);
    expect(state.status).toBe('running');
    expect(cacheColumns(state, ctx)).toMatchObject({ match_status: 'running', score_a: 1, score_b: 0, started: true });
  });

  it('@W2A-026 Gegenbeispiel: REOPEN nach einem Direkteintrag ohne Nichtantritt öffnet wie bisher (running)', () => {
    const { state } = reduceMatch([ev('RESULT_ENTRY', { scores: { [C]: 0, [D]: 2 } }), ev('REOPEN')], ctx);
    expect(state.status).toBe('running');
  });
});

describe('@W2A-022 Korrektur nach der Wertung', () => {
  it('@W2A-022 eine Korrektur verdrängt die Wertung: decided_by „regular“ (Korrektur), kein Fehlender mehr', () => {
    const w = cFehlt();
    const korrektur = ev('CORRECTION', { scores: { [C]: 1, [D]: 3 }, reason: 'doch gespielt', basedOn: w.id });
    const { state, results } = reduceMatch([w, korrektur], ctx);
    expect(results[1].status).toBe('accepted');
    expect(toServerState(state).decidedBy).toBe('correction');
    expect(cacheColumns(state, ctx)).toMatchObject({ score_a: 1, score_b: 3, decided_by: 'regular', forfeit_absent: null });
  });
});
