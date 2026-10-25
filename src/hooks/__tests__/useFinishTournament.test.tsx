/**
 * R3-2b Abschluss-Dienst `useFinishTournament` (Plan R3 E3–E5, S1, S2; Übergabe A-21a-C1). Erwartungen aus dem Gherkin
 * docs/anforderungen/2026-10-01_turnier-lebenszyklus.md, nicht am Code abgelesen; Server-Antworten in der Form von
 * Migration 20261113_003. Das Turnier ist das echt erzeugte Nikolaus-Turnier (finishKit).
 *
 * Szenarien: @LZ-009 (Abschluss, neu laden), @LZ-010/@LZ-012 (Liste offener Punkte inkl. Klärungen), @LZ-019 (nur mit Netz,
 * nichts gemerkt), @LZ-021 (15 s, dieselbe request_id, genau einmal), @LZ-022/@LZ-023 (kein Aufruf ohne manageLifecycle),
 * @LZ-024 (Client: kein Teilzustand), @LZ-029 (Korrektur vor dem Abschluss), E9 (Gast), S2 (Klärungsliste direkt vor dem
 * Senden erneut lesen), E4 (eigener Ausgang → „Erst übertragen“), S1 (wer abschließen darf, liest auch die Klärungsliste).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';

type Answer = { data: unknown; error: { code?: string; message: string } | null };
const server = vi.hoisted(() => ({
  rpc: vi.fn<(fn: string, args: Record<string, unknown>) => Promise<Answer>>(),
}));
const env = vi.hoisted(() => ({ online: true, canManage: true, local: false, pending: 0, tournamentId: '' }));

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: server.rpc } }));
vi.mock('../useOnlineStatus', () => ({ useIsOnline: () => env.online }));
vi.mock('../../features/auth/hooks/useCan', () => ({ useCan: (permission: string) => permission === 'manageLifecycle' && env.canManage }));
vi.mock('../../features/match-engine/loadEngineEventsForExport', () => ({ loadEngineEventsForExport: () => Promise.resolve(new Map()) }));
const engineContext = vi.hoisted(() => ({
  sender: { getStatus: () => ({ pendingByTournament: env.pending > 0 ? { [env.tournamentId]: env.pending } : {} }) },
}));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({ useMatchEngineContextOptional: () => engineContext }));
vi.mock('../../core/contexts/RepositoryContext', async () => {
  const { LocalStorageRepository } = await import('../../core/repositories/LocalStorageRepository');
  const local = Object.create(LocalStorageRepository.prototype) as object;
  const cloud = {};
  return { useRepositories: () => ({ tournamentRepository: env.local ? local : cloud }) };
});

import rolePermissions from '../../features/auth/permissions/rolePermissions.json';
import { review } from '../../core/match/review/__tests__/reviewFixtures';
import { expectedTournamentState } from '../../core/services/lifecycle';
import { matchOf, NK, withMatch } from '../../core/standings/__tests__/groupCompletionKit';
import { N7C, nikolausFertig } from '../../core/services/__tests__/finishKit';
import { useFinishTournament } from '../useFinishTournament';

const ok = (data: unknown): Answer => ({ data, error: null });
let serverState: unknown[] = [];
let preflightItems: unknown[] = [];
let reviewsAnswers: unknown[][] = [];
let finishAnswer: () => Promise<Answer> = () => Promise.resolve(ok({ status: 'ok', finishedAt: '2026-11-28T17:30:00+00:00' }));
let lifecycleAnswer: unknown = 'running';

const calls = (fn: string) => server.rpc.mock.calls.filter(([name]) => name === fn).map(([, args]) => args);

function preflightAnswer(): Answer {
  return ok({ status: 'ok', lifecycle: 'running', finishedAt: null, canFinish: preflightItems.length === 0, items: preflightItems, warnings: [], state: serverState });
}

let tournament: Tournament;
const reload = vi.fn();

beforeEach(async () => {
  env.online = true;
  env.canManage = true;
  env.local = false;
  env.pending = 0;
  tournament = await nikolausFertig();
  env.tournamentId = tournament.id;
  serverState = expectedTournamentState(tournament);
  preflightItems = [];
  reviewsAnswers = [];
  finishAnswer = () => Promise.resolve(ok({ status: 'ok', finishedAt: '2026-11-28T17:30:00+00:00' }));
  lifecycleAnswer = 'running';
  reload.mockReset();
  server.rpc.mockReset();
  server.rpc.mockImplementation((fn: string) => {
    switch (fn) {
      case 'finish_preflight': return Promise.resolve(preflightAnswer());
      case 'list_match_reviews': return Promise.resolve(ok(reviewsAnswers.length > 1 ? reviewsAnswers.shift() : (reviewsAnswers[0] ?? [])));
      case 'finish_tournament': return finishAnswer();
      case 'tournament_lifecycle': return Promise.resolve(ok(lifecycleAnswer));
      default: return Promise.resolve(ok(null));
    }
  });
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => env.online);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function render(t: Tournament = tournament) {
  return renderHook(() => useFinishTournament(t, { reload }));
}

describe('@LZ-009 Turnier abschließen, wenn alles entschieden ist', () => {
  it('prüfen → bestätigen → abgeschlossen: ein Aufruf mit bestätigtem Stand, Endstand N7c und request_id; danach neu laden', async () => {
    const { result } = render();
    await act(async () => { await result.current.start(); });
    expect(result.current.state.phase).toBe('confirming');
    await act(async () => { await result.current.confirm(); });

    expect(result.current.state).toEqual({ phase: 'done', finishedAt: '2026-11-28T17:30:00+00:00', alreadyApplied: false });
    expect(calls('finish_tournament')).toHaveLength(1);
    const args = calls('finish_tournament')[0];
    expect(args.p_tournament_id).toBe(tournament.id);
    expect(args.p_expected_state).toEqual(serverState);
    expect((args.p_final_standings as { ranking: Array<{ teamName: string }> }).ranking.map((row) => row.teamName)).toEqual(N7C);
    expect(args.p_request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('@LZ-021 Bleibt die Antwort aus, wird nicht doppelt abgeschlossen', () => {
  it('nach 15 s „nicht bestätigt“ und Stand beim Server abgefragt; erneutes Tippen mit DERSELBEN request_id → genau ein Abschluss', async () => {
    const { result } = render();
    await act(async () => { await result.current.start(); });
    vi.useFakeTimers();
    finishAnswer = () => new Promise<Answer>(() => undefined); // die Antwort bleibt aus
    act(() => { void result.current.confirm(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(14_900); });
    expect(result.current.state.phase).toBe('sending');
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(result.current.state).toEqual({ phase: 'unconfirmed', serverLifecycle: 'running' });
    expect(calls('tournament_lifecycle')).toHaveLength(1);

    finishAnswer = () => Promise.resolve(ok({ status: 'ok', alreadyApplied: true, finishedAt: '2026-11-28T17:30:00+00:00' }));
    await act(async () => { await result.current.retry(); });
    expect(result.current.state).toEqual({ phase: 'done', finishedAt: '2026-11-28T17:30:00+00:00', alreadyApplied: true });
    const ids = calls('finish_tournament').map((args) => args.p_request_id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
  });

  it('Gegenprobe E3: ein neuer Durchlauf (neu prüfen) bekommt eine neue request_id', async () => {
    const { result } = render();
    await act(async () => { await result.current.start(); });
    finishAnswer = () => Promise.resolve(ok({ status: 'rejected', code: 'STALE_STATE' }));
    await act(async () => { await result.current.confirm(); });
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    const ids = calls('finish_tournament').map((args) => args.p_request_id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it('meldet der Server nach ausgebliebener Antwort „abgeschlossen“, lädt die App neu', async () => {
    finishAnswer = () => Promise.resolve({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    lifecycleAnswer = 'finished';
    const { result } = render();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({ phase: 'unconfirmed', serverLifecycle: 'finished' });
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('@LZ-019 Turnier abschließen nur mit Netz', () => {
  it('ohne Netz: Hinweis, kein Aufruf – und auch nachdem das Gerät wieder Netz hat, wird nichts nachgereicht', async () => {
    env.online = false;
    const { result, rerender } = render();
    await act(async () => { await result.current.start(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'OFFLINE' } });
    env.online = true;
    rerender();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(server.rpc).not.toHaveBeenCalled();
  });

  it('Netz weg zwischen Prüfen und Bestätigen: kein Abschluss-Aufruf', async () => {
    const { result, rerender } = render();
    await act(async () => { await result.current.start(); });
    env.online = false;
    rerender();
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'OFFLINE' } });
    expect(calls('finish_tournament')).toEqual([]);
  });
});

describe('@LZ-022 @LZ-023 Rechte', () => {
  it('Tom (Helfer, ohne manageLifecycle): kein Aufruf an den Server', async () => {
    env.canManage = false;
    const { result } = render();
    await act(async () => { await result.current.start(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'FORBIDDEN' } });
    expect(server.rpc).not.toHaveBeenCalled();
  });

  it('der Server lehnt ab (42501) → kein Recht, kein Abschluss', async () => {
    finishAnswer = () => Promise.resolve({ data: null, error: { code: '42501', message: 'keine Berechtigung' } });
    const { result } = render();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'FORBIDDEN' } });
    expect(reload).not.toHaveBeenCalled();
  });

  it('E9 Gast-Turnier (nur lokal): kein Abschluss, kein Aufruf', async () => {
    env.local = true;
    const { result } = render();
    await act(async () => { await result.current.start(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'LOCAL' } });
    expect(server.rpc).not.toHaveBeenCalled();
  });
});

describe('@LZ-010 @LZ-012 Liste offener Punkte', () => {
  it('@LZ-012 Spiel um Platz 3 läuft und 2 Klärungen offen → 3 Einträge, kein Abschluss-Aufruf', async () => {
    preflightItems = [{ kind: 'match_running', matchId: 'p3', matchNumber: 15, field: 2, finalType: 'thirdPlace' }];
    reviewsAnswers = [[review({ eventId: 'k1' }), review({ eventId: 'k2' })]];
    const { result } = render();
    await act(async () => { await result.current.start(); });
    const state = result.current.state;
    if (state.phase !== 'rejected' || state.reason.code !== 'OPEN_ITEMS') { throw new Error(`erwartet OPEN_ITEMS, war ${JSON.stringify(state)}`); }
    expect(state.reason.items.map((item) => item.kind)).toEqual(['match_running', 'review_open', 'review_open']);
    expect(calls('finish_tournament')).toEqual([]);
  });

  it('S2: kommt zwischen Prüfen und Bestätigen eine Klärung dazu, liest die App die Liste vor dem Senden neu und schließt nicht ab', async () => {
    reviewsAnswers = [[], [review({ eventId: 'spaet', matchId: 'm15', matchNumber: 15, field: 1 })]];
    const { result } = render();
    await act(async () => { await result.current.start(); });
    expect(result.current.state.phase).toBe('confirming');
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({
      phase: 'rejected', reason: { code: 'OPEN_ITEMS', items: [{ kind: 'review_open', eventId: 'spaet', matchId: 'm15', matchNumber: 15, field: 1 }] },
    });
    expect(calls('list_match_reviews')).toHaveLength(2);
    expect(calls('finish_tournament')).toEqual([]);
  });
});

describe('E4 eigener Ausgang und @LZ-029 Korrektur vor dem Abschluss', () => {
  it('das Gerät zeigt ein Tor, das noch wartet → „Erst übertragen“, kein Aufruf (kein STALE_STATE-Kreis)', async () => {
    env.pending = 1;
    const m = matchOf(tournament, NK.kammer, NK.wagingRot);
    const { result } = render(withMatch(tournament, m.id, { scoreA: (m.scoreA ?? 0) + 1 }));
    await act(async () => { await result.current.start(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'OWN_OUTBOX', pending: 1 } });
    expect(calls('finish_tournament')).toEqual([]);
  });

  it('@LZ-029 Marias Korrektur kam zuerst: der Server meldet den Folgen-Hinweis → Liste, Turnier bleibt „Läuft“', async () => {
    finishAnswer = () => Promise.resolve(ok({ status: 'rejected', code: 'OPEN_ITEMS', items: [{ kind: 'notice_open', noticeId: 4, matchId: 'final', side: 'A' }] }));
    const { result } = render();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({
      phase: 'rejected', reason: { code: 'OPEN_ITEMS', items: [{ kind: 'notice_open', noticeId: 4, matchId: 'final', side: 'A' }] },
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('der Server hält den Endstand für vorläufig → „Endstand ist noch vorläufig“', async () => {
    finishAnswer = () => Promise.resolve(ok({ status: 'rejected', code: 'INVALID_STANDINGS', reason: 'PROVISIONAL' }));
    const { result } = render();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'PROVISIONAL' } });
  });
});

describe('@LZ-024 Client: kein Teilzustand', () => {
  it('abgelehnt oder unbestätigt: die App lädt nicht neu und hält nichts als abgeschlossen fest', async () => {
    finishAnswer = () => Promise.resolve(ok({ status: 'rejected', code: 'STALE_STATE' }));
    const { result } = render();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'STALE_STATE' } });

    finishAnswer = () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    await waitFor(() => { expect(result.current.state).toEqual({ phase: 'unconfirmed', serverLifecycle: 'running' }); });
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('S1: wer abschließen darf, sieht auch die Klärungsliste (sonst bestünde E5 still mit „[]“)', () => {
  it('jede Rolle mit manageLifecycle hat auch leadMatches – heute nur Co-Admin (Eigentümer hat immer alle Rechte)', () => {
    const roles = rolePermissions.roles as Record<string, string[]>;
    const mitAbschluss = Object.entries(roles).filter(([, rights]) => rights.includes('manageLifecycle'));
    expect(mitAbschluss.map(([role]) => role)).toEqual(['co-admin']);
    expect(mitAbschluss.filter(([, rights]) => !rights.includes('leadMatches'))).toEqual([]);
  });
});
