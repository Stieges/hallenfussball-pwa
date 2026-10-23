/**
 * GA4 A-13b-C: Cloud-Wege für „Gruppe abschließen“ (`complete_group`, `reopen_group`, `record_standing_decision`) und das
 * Lesen der Abschlüsse (`group_completions`). Aus den Anforderungen, nicht am Code abgelesen:
 * @TM-046 (Abschluss lesen), @TM-099 (Wiederöffnen), @W2A-063 (Annahme ohne Grund), @W2A-004/@ET-027 (Reihenfolge mit Grund),
 * @W2A-070 (Zurücknehmen), @W2A-025/@W2A-054 (Nichtantritt `forfeit_absent`). Fehlerpolitik: Review A-13b-S Auflage 2
 * (`40P01`/`55P03` → „Bitte erneut versuchen“, kein stiller Fehlschlag).
 */
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import type { StandingDecision } from '../../../types/tournament';
import { RepositoryError, RetryLaterError } from '../../errors';
import { testUuid } from '../../../test/testIds';
import { createMatchRow } from '../../../../tests/factories/supabase';
import { mapMatchFromSupabase } from '../supabaseMappers';
import { expectedState } from '../../services/GroupCompletionService';
import {
  callCompleteGroup, callRecordStandingDecision, callReopenGroup, completeGroupArgs, mapGroupCompletionRow, readGroupCompletions,
  recordDecisionArgs, type CompleteGroupRequest, type GroupCompletionRow,
} from '../groupCompletionCloud';

type RpcResponse = { data: unknown; error: { code?: string; message: string } | null };

function clientWith(respond: (fn: string, args: Record<string, unknown>) => RpcResponse | Promise<RpcResponse>) {
  const rpc = vi.fn((fn: string, args: Record<string, unknown>) => Promise.resolve(respond(fn, args)));
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

const T = testUuid(1);
const [A, B, C] = [testUuid(11), testUuid(12), testUuid(13)];

const REQUEST: CompleteGroupRequest = {
  groupId: 'A', ranking: [A, B, C], openRanks: [], tieDecisions: [], knownDecisionIds: [],
  expectedState: [{ id: testUuid(21), ta: A, tb: B, a: 2, b: 1, s: 'finished' }],
};

const DECISION: StandingDecision = { id: 'e-1', groupId: '', teamIds: [A, B], order: [B, A], kind: 'shootout', shootout: { winner: 4, loser: 3 }, basis: 'x' };

describe('Abschluss lesen: group_completions → Tournament.groupCompletions (@TM-046, @TM-099)', () => {
  const row: GroupCompletionRow = {
    group_id: 'A', ranking: [A, B, C], open_ranks: [2], completed_at: '2026-12-06T10:00:00Z', stale: true, reopened_at: null,
  };

  it('@TM-046 Rangfolge, offene Plätze, Verfall und Zeitpunkt kommen unverändert an; ohne Wiederöffnen fehlt reopenedAt', () => {
    expect(mapGroupCompletionRow(row)).toEqual({
      groupId: 'A', ranking: [A, B, C], openRanks: [2], stale: true, completedAt: '2026-12-06T10:00:00Z',
    });
  });

  it('@TM-099 eine wieder geöffnete Gruppe trägt reopenedAt (dann gilt der Abschluss nicht)', () => {
    expect(mapGroupCompletionRow({ ...row, reopened_at: '2026-12-06T11:00:00Z' })).toMatchObject({ reopenedAt: '2026-12-06T11:00:00Z' });
  });

  it('@TM-057 Jeder gegen jeden: die Gruppe „“ bleibt „“ (eine Abbildung, kein „all“)', () => {
    expect(mapGroupCompletionRow({ ...row, group_id: '' }).groupId).toBe('');
  });

  it('hin und zurück: was die App an complete_group schickt, kommt als Zeile unverändert wieder an (Rangfolge, offene Plätze)', () => {
    const args = completeGroupArgs(T, { ...REQUEST, openRanks: [2, 3] });
    const gespeichert: GroupCompletionRow = {
      group_id: args.p_group_id as string, ranking: args.p_ranking as string[], open_ranks: args.p_open_ranks as number[],
      completed_at: '2026-12-06T10:00:00Z', stale: (args.p_open_ranks as number[]).length > 0, reopened_at: null,
    };
    expect(mapGroupCompletionRow(gespeichert)).toMatchObject({ groupId: 'A', ranking: [A, B, C], openRanks: [2, 3], stale: true });
  });

  it('readGroupCompletions: Zeilen werden gemappt; die Spalten nennen weder Person noch Rohdaten (@W2A-072)', async () => {
    const select = vi.fn(() => ({ eq: () => Promise.resolve({ data: [row], error: null }) }));
    const client = { from: () => ({ select }) } as unknown as SupabaseClient<Database>;
    expect(await readGroupCompletions(client, T)).toEqual([mapGroupCompletionRow(row)]);
    const columns = String((select.mock.calls[0] as unknown as string[])[0]);
    expect(columns).not.toMatch(/completed_by|tie_orders|based_on_state/);
  });

  it('vor dem Einspielen (Tabelle fehlt) ist das Ergebnis „unbekannt“ (undefined), kein Fehler – Gegenbeispiel: anderer Fehler wirft', async () => {
    const fehlt = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }) }) }) };
    expect(await readGroupCompletions(fehlt as unknown as SupabaseClient<Database>, T)).toBeUndefined();
    const kaputt = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { code: '57014', message: 'timeout' } }) }) }) };
    await expect(readGroupCompletions(kaputt as unknown as SupabaseClient<Database>, T)).rejects.toBeInstanceOf(RepositoryError);
  });
});

describe('Nichtantritt am Spiel: matches.forfeit_absent → Match.forfeitAbsent → Stand für den Abschluss (@W2A-025, @W2A-054)', () => {
  it.each(['A', 'B', 'both'] as const)('forfeit_absent %s wird gelesen und geht als f in den Stand für complete_group', (absent) => {
    const match = mapMatchFromSupabase(createMatchRow({ id: testUuid(30), team_a_id: A, team_b_id: B, forfeit_absent: absent, match_status: 'finished', score_a: 2, score_b: 0, group_letter: 'A' } as never), '2026-12-06');
    expect(match.forfeitAbsent).toBe(absent);
    expect(expectedState({ matches: [match] }, 'A')).toEqual([expect.objectContaining({ id: testUuid(30), f: absent, s: 'finished' })]);
  });

  it('Gegenbeispiel: ohne Nichtantritt fehlt f im Stand (fehlend = null am Server)', () => {
    const match = mapMatchFromSupabase(createMatchRow({ id: testUuid(31), team_a_id: A, team_b_id: B, forfeit_absent: null, match_status: 'finished', score_a: 1, score_b: 1, group_letter: 'A' } as never), '2026-12-06');
    expect(match.forfeitAbsent).toBeUndefined();
    expect(expectedState({ matches: [match] }, 'A')[0]).not.toHaveProperty('f');
  });
});

describe('complete_group (@TM-046, @TM-054, @TM-049, @TM-145)', () => {
  it('schickt Rangfolge, offene Plätze, Entscheidungen, bekannte Kennungen und den Stand unter den Namen der Funktion', async () => {
    const { client, rpc } = clientWith(() => ({ data: { status: 'ok', changed: [{ matchId: testUuid(40), side: 'A', result: 'written' }], tournamentVersion: 8 }, error: null }));
    const result = await callCompleteGroup(client, T, { ...REQUEST, tieDecisions: [{ ...DECISION, reason: undefined }], knownDecisionIds: ['e-0'], fromQueue: true });
    expect(rpc).toHaveBeenCalledWith('complete_group', expect.objectContaining({
      p_tournament_id: T, p_group_id: 'A', p_ranking: [A, B, C], p_open_ranks: [], p_known_decision_ids: ['e-0'], p_from_queue: true,
      p_expected_state: REQUEST.expectedState,
    }));
    expect(result).toEqual({ status: 'ok', alreadyCompleted: false, changed: [{ matchId: testUuid(40), side: 'A', result: 'written' }], tournamentVersion: 8 });
  });

  it('@TM-054 offene Spiele: abgelehnt mit Anzahl, nichts vorgetäuscht', async () => {
    const { client } = clientWith(() => ({ data: { status: 'rejected', code: 'OPEN_MATCHES', open: 2 }, error: null }));
    expect(await callCompleteGroup(client, T, REQUEST)).toEqual({ status: 'rejected', code: 'OPEN_MATCHES', open: 2 });
  });

  it('@TM-116 Konflikt online: abgelehnt mit der letzten Änderung am Server; aus der Warteschlange: Klärung', async () => {
    const last = { actor: testUuid(90), kind: 'reopen_group', at: '2026-12-06T10:00:00Z', detail: {} };
    const online = clientWith(() => ({ data: { status: 'rejected', code: 'STALE_VERSION', last }, error: null }));
    expect(await callCompleteGroup(online.client, T, REQUEST)).toEqual({ status: 'rejected', code: 'STALE_VERSION', last });
    const queue = clientWith(() => ({ data: { status: 'clarification', code: 'DECIDED_ELSEWHERE', clarificationId: 7, last: null }, error: null }));
    expect(await callCompleteGroup(queue.client, T, { ...REQUEST, fromQueue: true })).toEqual({ status: 'clarification', code: 'DECIDED_ELSEWHERE', clarificationId: 7 });
  });

  it('zweimal derselbe Abschluss: ALREADY_COMPLETED ist ein Erfolg ohne Folgeänderung', async () => {
    const { client } = clientWith(() => ({ data: { status: 'ok', code: 'ALREADY_COMPLETED' }, error: null }));
    expect(await callCompleteGroup(client, T, REQUEST)).toEqual({ status: 'ok', alreadyCompleted: true, changed: [] });
  });

  it('@W2A-050 kein Recht (42501) ist das Ergebnis „forbidden“, kein Absturz', async () => {
    const { client } = clientWith(() => ({ data: null, error: { code: '42501', message: 'complete_group: keine Berechtigung' } }));
    expect(await callCompleteGroup(client, T, REQUEST)).toEqual({ status: 'forbidden' });
  });

  it.each(['40P01', '55P03'] as const)('Review A-13b-S Auflage 2: %s wird zu „Bitte erneut versuchen“ (RetryLaterError), nichts still verschluckt', async (code) => {
    const { client } = clientWith(() => ({ data: null, error: { code, message: 'deadlock detected' } }));
    const fehler = await callCompleteGroup(client, T, REQUEST).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(RetryLaterError);
    expect((fehler as RetryLaterError).sqlState).toBe(code);
  });

  it('Gegenbeispiel: ein anderer Fehler (Funktion fehlt vor dem Einspielen) bleibt ein RepositoryError, kein „erneut versuchen“', async () => {
    const { client } = clientWith(() => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }));
    const fehler = await callCompleteGroup(client, T, REQUEST).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(RepositoryError);
    expect(fehler).not.toBeInstanceOf(RetryLaterError);
  });

  it('eine unbekannte Antwort des Servers wirft statt zu raten', async () => {
    const { client } = clientWith(() => ({ data: { status: 'ok-ish' }, error: null }));
    await expect(callCompleteGroup(client, T, REQUEST)).rejects.toBeInstanceOf(RepositoryError);
  });
});

describe('reopen_group (@TM-099)', () => {
  it('schickt den Grund mit; ok, abgelehnt (NOT_COMPLETED) und kein Recht', async () => {
    const ok = clientWith(() => ({ data: { status: 'ok' }, error: null }));
    expect(await callReopenGroup(ok.client, T, 'A', 'Ergebnis falsch')).toEqual({ status: 'ok' });
    expect(ok.rpc).toHaveBeenCalledWith('reopen_group', { p_tournament_id: T, p_group_id: 'A', p_reason: 'Ergebnis falsch', p_from_queue: false });
    const nicht = clientWith(() => ({ data: { status: 'rejected', code: 'NOT_COMPLETED', last: null }, error: null }));
    expect(await callReopenGroup(nicht.client, T, 'A', 'x')).toEqual({ status: 'rejected', code: 'NOT_COMPLETED' });
    const verboten = clientWith(() => ({ data: null, error: { code: '42501', message: 'keine Berechtigung' } }));
    expect(await callReopenGroup(verboten.client, T, 'A', 'x')).toEqual({ status: 'forbidden' });
  });

  it('40P01 beim Wiederöffnen: „Bitte erneut versuchen“', async () => {
    const { client } = clientWith(() => ({ data: null, error: { code: '40P01', message: 'deadlock detected' } }));
    await expect(callReopenGroup(client, T, 'A', 'x')).rejects.toBeInstanceOf(RetryLaterError);
  });
});

describe('record_standing_decision: Grund nur bei einer Reihenfolge (@W2A-063, @W2A-004, @ET-027, @W2A-070)', () => {
  const ORDER: StandingDecision = { id: 'e-3', groupId: '', teamIds: [A, B, C], order: [C, A, B], kind: 'order', basis: 'x' };
  const SHARED: StandingDecision = { id: 'e-2', groupId: '', teamIds: [A, B], order: [A, B], kind: 'shared', basis: 'x' };

  it('@W2A-004 Reihenfolge (3+ Teams): der Grund geht als p_reason mit', () => {
    expect(recordDecisionArgs(T, { action: 'decide', decision: ORDER, reason: 'Strafstoßschießen' }, 4)).toMatchObject({
      p_action: 'decide', p_reason: 'Strafstoßschießen', p_expected_version: 4, p_tournament_id: T,
    });
  });

  it('@W2A-063 „Ergebnis so akzeptieren“: kein Grund, auch wenn einer mitgegeben wird', () => {
    expect(recordDecisionArgs(T, { action: 'decide', decision: SHARED, reason: 'Hallenzeit' }, 4).p_reason).toBeNull();
  });

  it('@ET-027 Strafstoßschießen: kein Grund, das Ergebnis steht in der Entscheidung', () => {
    const args = recordDecisionArgs(T, { action: 'decide', decision: DECISION, reason: 'egal' }, 4);
    expect(args.p_reason).toBeNull();
    expect(args.p_decision).toMatchObject({ kind: 'shootout', shootout: { winner: 4, loser: 3 } });
  });

  it('@W2A-070 Zurücknehmen: nur die Kennung, kein Grund', () => {
    expect(recordDecisionArgs(T, { action: 'withdraw', decision: { id: 'e-1' } }, 4)).toMatchObject({ p_action: 'withdraw', p_decision: { id: 'e-1' }, p_reason: null });
  });

  it('Antworten: ok (neue Version), ALREADY_APPLIED, STALE, WITHDRAW_NOT_ALLOWED, kein Recht', async () => {
    const antwort = (data: unknown) => clientWith(() => ({ data, error: null })).client;
    expect(await callRecordStandingDecision(antwort({ status: 'ok', version: 5 }), T, { action: 'decide', decision: SHARED }, 4)).toEqual({ status: 'ok', alreadyApplied: false, version: 5 });
    expect(await callRecordStandingDecision(antwort({ status: 'ok', code: 'ALREADY_APPLIED', version: 5 }), T, { action: 'decide', decision: SHARED }, 4)).toEqual({ status: 'ok', alreadyApplied: true, version: 5 });
    expect(await callRecordStandingDecision(antwort({ status: 'rejected', code: 'STALE', version: 6 }), T, { action: 'decide', decision: SHARED }, 4)).toEqual({ status: 'rejected', code: 'STALE', version: 6 });
    expect(await callRecordStandingDecision(antwort({ status: 'rejected', code: 'WITHDRAW_NOT_ALLOWED' }), T, { action: 'withdraw', decision: { id: 'e-1' } }, 4)).toEqual({ status: 'rejected', code: 'WITHDRAW_NOT_ALLOWED' });
    const verboten = clientWith(() => ({ data: null, error: { code: '42501', message: 'keine Berechtigung' } })).client;
    expect(await callRecordStandingDecision(verboten, T, { action: 'decide', decision: SHARED }, 4)).toEqual({ status: 'forbidden' });
  });

  it('55P03 (Sperr-Wartezeit) beim Eintragen: RetryLaterError', async () => {
    const { client } = clientWith(() => ({ data: null, error: { code: '55P03', message: 'lock timeout' } }));
    await expect(callRecordStandingDecision(client, T, { action: 'decide', decision: SHARED }, 4)).rejects.toBeInstanceOf(RetryLaterError);
  });
});
