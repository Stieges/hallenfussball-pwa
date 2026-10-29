/**
 * R3-2b Client der Abschluss-Funktionen (Übergabe A-21a-C1, `A-21a-sql-freigabe.md` § 9; Migration 20261113_003): jede Antwort
 * von `finish_tournament` und `finish_preflight` wird gelesen, nichts Unbekanntes wird still übernommen.
 *
 * Szenarien: @LZ-021 (höchstens 15 s, dieselbe `request_id`), @LZ-022/@LZ-023 (42501 = kein Recht), @LZ-010/@LZ-012/@LZ-013
 * (offene Punkte), @LZ-018 (Warnungen), @LZ-029 (STALE_STATE, Folgen-Hinweis), @LZ-024 (eine ausgebliebene Antwort ist kein
 * Abschluss – `noAnswer`, kein zweiter Versuch im Client).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import type { FinalStandingsSnapshot } from '../../standings/finalStandings/types';
import { callFinishTournament, FINISH_TIMEOUT_MS, readFinishPreflight, readTournamentLifecycle, type FinishTournamentResult } from '../lifecycleRpc';

type Answer = { data: unknown; error: { code?: string; message: string } | null };
const rpc = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<Answer>>();
const client = { rpc } as unknown as SupabaseClient<Database>;
const ok = (data: unknown): Answer => ({ data, error: null });

const SNAPSHOT = { format: 1, ranking: [], scorers: [], appVersion: 'test', computedAt: '2026-10-25T10:00:00.000Z' } as unknown as FinalStandingsSnapshot;
const REQUEST = { tournamentId: 'live-cup', expectedState: [{ id: 'm1', s: 'finished', a: 1, b: 0 }], snapshot: SNAPSHOT, requestId: 'req-1' };

beforeEach(() => { rpc.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('R3-2b finish_tournament: Aufruf und alle Antworten (A-21a-C1)', () => {
  it('@LZ-009 sendet Turnier, erwarteten Stand, Endstand und request_id unter den Namen der Funktion', async () => {
    rpc.mockResolvedValue(ok({ status: 'ok', finishedAt: '2026-11-28T17:30:00+00:00' }));
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual({ status: 'ok', finishedAt: '2026-11-28T17:30:00+00:00', alreadyApplied: false });
    expect(rpc).toHaveBeenCalledWith('finish_tournament', {
      p_tournament_id: 'live-cup', p_expected_state: REQUEST.expectedState, p_final_standings: SNAPSHOT, p_request_id: 'req-1',
    });
  });

  it('@LZ-021 Wiederholung mit derselben request_id: ok mit alreadyApplied', async () => {
    rpc.mockResolvedValue(ok({ status: 'ok', alreadyApplied: true, finishedAt: '2026-11-28T17:30:00+00:00' }));
    await expect(callFinishTournament(client, REQUEST)).resolves.toMatchObject({ status: 'ok', alreadyApplied: true });
  });

  const abgelehnt: Array<[string, unknown, FinishTournamentResult]> = [
    ['INVALID_INPUT', { status: 'rejected', code: 'INVALID_INPUT' }, { status: 'rejected', code: 'INVALID_INPUT' }],
    ['REQUEST_ID_CONFLICT', { status: 'rejected', code: 'REQUEST_ID_CONFLICT' }, { status: 'rejected', code: 'REQUEST_ID_CONFLICT' }],
    ['@LZ-029 STALE_STATE', { status: 'rejected', code: 'STALE_STATE' }, { status: 'rejected', code: 'STALE_STATE' }],
    ['ALREADY_FINISHED mit Person und Zeit',
      { status: 'rejected', code: 'ALREADY_FINISHED', by: 'Maria', byUserId: 'u-maria', at: '2026-11-28T17:29:00+00:00' },
      { status: 'rejected', code: 'ALREADY_FINISHED', by: 'Maria', at: '2026-11-28T17:29:00+00:00' }],
    ['ALREADY_FINISHED ohne Namen', { status: 'rejected', code: 'ALREADY_FINISHED', by: null, byUserId: 'u', at: null },
      { status: 'rejected', code: 'ALREADY_FINISHED', by: null, at: null }],
    ['NOT_RUNNING', { status: 'rejected', code: 'NOT_RUNNING', lifecycle: 'fixed' }, { status: 'rejected', code: 'NOT_RUNNING', lifecycle: 'fixed' }],
    ['@LZ-029 OPEN_ITEMS mit Folgen-Hinweis', { status: 'rejected', code: 'OPEN_ITEMS', items: [{ kind: 'notice_open', noticeId: 7, matchId: 'final', side: 'A' }] },
      { status: 'rejected', code: 'OPEN_ITEMS', items: [{ kind: 'notice_open', noticeId: 7, matchId: 'final', side: 'A' }] }],
    ['INVALID_STANDINGS PROVISIONAL', { status: 'rejected', code: 'INVALID_STANDINGS', reason: 'PROVISIONAL' },
      { status: 'rejected', code: 'INVALID_STANDINGS', reason: 'PROVISIONAL' }],
    ['INVALID_STANDINGS TEAM_SET', { status: 'rejected', code: 'INVALID_STANDINGS', reason: 'TEAM_SET' },
      { status: 'rejected', code: 'INVALID_STANDINGS', reason: 'TEAM_SET' }],
  ];
  it.each(abgelehnt)('Ablehnung %s wird gelesen', async (_name, answer, expected) => {
    rpc.mockResolvedValue(ok(answer));
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual(expected);
  });

  it('@LZ-022 @LZ-023 ohne Recht (42501) → forbidden', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'finish_tournament: keine Berechtigung' } });
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual({ status: 'forbidden' });
  });

  it('@LZ-021 bleibt die Antwort 15 s aus → noAnswer (nicht vorher), genau ein Aufruf', async () => {
    vi.useFakeTimers();
    rpc.mockReturnValue(new Promise<Answer>(() => undefined));
    let result: FinishTournamentResult | undefined;
    void callFinishTournament(client, REQUEST).then((r) => { result = r; });
    await vi.advanceTimersByTimeAsync(FINISH_TIMEOUT_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ status: 'noAnswer' });
    expect(FINISH_TIMEOUT_MS).toBe(15000);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('Netzfehler ohne Code → noAnswer (ob der Abschluss gilt, ist offen); anderer Server-Fehler → unexpected', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual({ status: 'noAnswer' });
    rpc.mockRejectedValueOnce(new Error('offline'));
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual({ status: 'noAnswer' });
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'kaputt' } });
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual({ status: 'unexpected' });
  });

  it('Gegenbeispiel: unbekannter Code oder unbekannter Grund wird nicht als Ablehnung gelesen → unexpected', async () => {
    rpc.mockResolvedValueOnce(ok({ status: 'rejected', code: 'NEU' }));
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual({ status: 'unexpected' });
    rpc.mockResolvedValueOnce(ok({ status: 'rejected', code: 'INVALID_STANDINGS', reason: 'NEU' }));
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual({ status: 'unexpected' });
  });
});

describe('R3-2b finish_preflight: Punkte, Warnungen, Stand (B-33-Übergabe)', () => {
  const ANTWORT = {
    status: 'ok', lifecycle: 'running', finishedAt: null, canFinish: false,
    items: [
      { kind: 'match_running', matchId: 'p3', matchNumber: 15, field: 2, finalType: 'thirdPlace' },
      { kind: 'match_undecided', matchId: 'final', matchNumber: 16, field: 1, finalType: 'final' },
      { kind: 'group_open', groupId: '' },
      { kind: 'group_stale', groupId: 'B' },
      { kind: 'tie_open', groupId: '', places: [3, 4], teamIds: ['petting', 'otting'] },
      { kind: 'notice_open', noticeId: 3, matchId: 'hf1', side: 'A' },
      { kind: 'clarification_open', clarificationId: 9, matchId: 'hf2' },
      { kind: 'kuenftig_neu', irgendwas: 1 },
    ],
    warnings: [
      { kind: 'outbox_pending', field: 2, pending: 3, reportedAt: '2026-11-28T17:28:00+00:00', deviceId: 'clara-handy' },
      { kind: 'device_silent', field: 1, deviceId: 'tom-handy', deviceLabel: 'phone', since: '2026-11-28T17:20:00+00:00' },
    ],
    state: [{ id: 'm1', ta: 'a', tb: 'b', a: 1, b: 0, s: 'finished' }],
  };

  it('@LZ-010 @LZ-013 @LZ-018 liest alle Arten offener Punkte und Warnungen; eine unbekannte Art bleibt als Punkt stehen', async () => {
    rpc.mockResolvedValue(ok(ANTWORT));
    const result = await readFinishPreflight(client, 'live-cup');
    expect(rpc).toHaveBeenCalledWith('finish_preflight', { p_tournament_id: 'live-cup' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') { return; }
    expect(result.preflight.items).toEqual([...ANTWORT.items.slice(0, 7), { kind: 'unknown', serverKind: 'kuenftig_neu' }]);
    expect(result.preflight.warnings).toEqual(ANTWORT.warnings);
    expect(result.preflight.state).toEqual(ANTWORT.state);
    expect(result.preflight).toMatchObject({ lifecycle: 'running', canFinish: false, finishedAt: null });
  });

  it('ohne Recht → forbidden; Netz/Form → failed', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'keine Berechtigung' } });
    await expect(readFinishPreflight(client, 'x')).resolves.toEqual({ status: 'forbidden' });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    await expect(readFinishPreflight(client, 'x')).resolves.toEqual({ status: 'failed' });
    rpc.mockResolvedValueOnce(ok({ status: 'ok', lifecycle: 'running' }));
    await expect(readFinishPreflight(client, 'x')).resolves.toEqual({ status: 'failed' });
  });
});

describe('W-M (a) der Server meldet offene Klärungen selbst (Migration 20261118_004, Punkt review_open)', () => {
  const KLAERUNG = { kind: 'review_open', eventId: 'tor-tom', matchId: 'hf2', matchNumber: 14, field: 1 };

  it('@LZ-010 Zeile Klärung: finish_preflight nennt „Tor Heim, von Tom“ zum Halbfinale 2 als offene Klärung, nicht als unbekannten Punkt', async () => {
    rpc.mockResolvedValue(ok({ status: 'ok', lifecycle: 'running', finishedAt: null, canFinish: false, items: [KLAERUNG], warnings: [], state: [] }));
    const result = await readFinishPreflight(client, 'live-cup');
    expect(result).toMatchObject({ status: 'ok', preflight: { canFinish: false, items: [KLAERUNG] } });
  });

  it('@LZ-012 finish_tournament lehnt mit dem laufenden Spiel um Platz 3 und zwei Klärungen ab → drei lesbare Punkte', async () => {
    const items = [
      { kind: 'match_running', matchId: 'p3', matchNumber: 15, field: 2, finalType: 'thirdPlace' },
      KLAERUNG,
      { kind: 'review_open', eventId: 'tor-kai', matchId: 'final', matchNumber: 16 },
    ];
    rpc.mockResolvedValue(ok({ status: 'rejected', code: 'OPEN_ITEMS', items }));
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual({ status: 'rejected', code: 'OPEN_ITEMS', items });
  });

  it('Gegenbeispiel: ein Klärungs-Punkt ohne Kennung des Eintrags hält trotzdem auf (unbekannt, verschwindet nicht still)', async () => {
    rpc.mockResolvedValue(ok({ status: 'rejected', code: 'OPEN_ITEMS', items: [{ kind: 'review_open', matchId: 'hf2' }] }));
    await expect(callFinishTournament(client, REQUEST)).resolves.toEqual({
      status: 'rejected', code: 'OPEN_ITEMS', items: [{ kind: 'unknown', serverKind: 'review_open' }],
    });
  });
});

describe('R3-2b tournament_lifecycle: Zustand vom Server', () => {
  it('liest running/finished/fixed; unbekanntes Turnier → null; keine Antwort → undefined', async () => {
    rpc.mockResolvedValueOnce(ok('running'));
    await expect(readTournamentLifecycle(client, 't')).resolves.toBe('running');
    rpc.mockResolvedValueOnce(ok('finished'));
    await expect(readTournamentLifecycle(client, 't')).resolves.toBe('finished');
    rpc.mockResolvedValueOnce(ok(null));
    await expect(readTournamentLifecycle(client, 't')).resolves.toBeNull();
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    await expect(readTournamentLifecycle(client, 't')).resolves.toBeUndefined();
    expect(rpc).toHaveBeenLastCalledWith('tournament_lifecycle', { p_tournament_id: 't' });
  });
});
