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

/**
 * R3-4 Auflagen aus Review #393: m-1 (Zustandsgrenzen), H-2 (roher Cloud-Stand), H-5 (ALREADY_FINISHED ohne Person).
 * Gegenbeispiele zu @LZ-021 (genau ein Abschluss, dieselbe ID nur beim erneuten Senden) und @LZ-009.
 */
describe('m-1 Zustandsgrenzen: bestätigen und erneut senden nur aus der richtigen Phase', () => {
  it('confirm() ohne vorheriges Prüfen oder nach einer Ablehnung sendet nichts (kein alter Endstand mit alter request_id)', async () => {
    const { result } = render();
    await act(async () => { await result.current.confirm(); });
    expect(calls('finish_tournament')).toEqual([]);

    await act(async () => { await result.current.start(); });
    finishAnswer = () => Promise.resolve(ok({ status: 'rejected', code: 'STALE_STATE' }));
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'STALE_STATE' } });
    expect(calls('finish_tournament')).toHaveLength(1);

    await act(async () => { await result.current.confirm(); }); // zweites Tippen nach der Ablehnung
    await act(async () => { await result.current.retry(); });
    expect(calls('finish_tournament')).toHaveLength(1);
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'STALE_STATE' } });
  });

  it('ein zweites Tippen auf „Turnier abschließen“, während der erste Abschluss läuft, sendet nichts (@LZ-021: genau ein Abschluss)', async () => {
    const { result } = render();
    await act(async () => { await result.current.start(); });
    finishAnswer = () => new Promise<Answer>(() => undefined);
    act(() => { void result.current.confirm(); });
    await waitFor(() => { expect(result.current.state.phase).toBe('sending'); });
    await act(async () => { await result.current.confirm(); });
    await act(async () => { await result.current.retry(); });
    expect(calls('finish_tournament')).toHaveLength(1);
    expect(calls('list_match_reviews')).toHaveLength(2); // Prüfen + einmal direkt vor dem Senden (S2), nicht ein drittes Mal
  });

  it('retry() ist nur nach „nicht bestätigt“ möglich – aus „bereit“ sendet es nichts', async () => {
    const { result } = render();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.retry(); });
    expect(calls('finish_tournament')).toEqual([]);
    expect(result.current.state.phase).toBe('confirming');
  });

  it('E3: nach einer Ablehnung beginnt ein neuer Durchlauf – mit neuer request_id und frisch geprüftem Endstand', async () => {
    const { result } = render();
    await act(async () => { await result.current.start(); });
    finishAnswer = () => Promise.resolve(ok({ status: 'rejected', code: 'STALE_STATE' }));
    await act(async () => { await result.current.confirm(); });
    finishAnswer = () => Promise.resolve(ok({ status: 'ok', finishedAt: '2026-11-28T17:30:00+00:00' }));
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    const ids = calls('finish_tournament').map((args) => args.p_request_id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it('ein langsamer erster Durchlauf überschreibt nicht den Zustand des neueren', async () => {
    let releaseFirst: (answer: Answer) => void = () => undefined;
    let first = true;
    server.rpc.mockImplementation((fn: string) => {
      if (fn === 'finish_preflight' && first) {
        first = false;
        return new Promise<Answer>((resolve) => { releaseFirst = resolve; });
      }
      if (fn === 'finish_preflight') { return Promise.resolve(preflightAnswer()); }
      if (fn === 'list_match_reviews') { return Promise.resolve(ok([])); }
      return Promise.resolve(ok(null));
    });
    const { result } = render();
    let langsam: Promise<void> = Promise.resolve();
    act(() => { langsam = result.current.start(); });
    await act(async () => { await result.current.start(); });
    expect(result.current.state.phase).toBe('confirming');
    await act(async () => {
      releaseFirst(ok({ status: 'ok', lifecycle: 'running', finishedAt: null, canFinish: false, items: [{ kind: 'match_running', matchId: 'x' }], warnings: [], state: serverState }));
      await langsam;
    });
    expect(result.current.state.phase).toBe('confirming'); // der alte Durchlauf meldet „OPEN_ITEMS“ nicht mehr hinein
  });

  it('während des Sendens beginnt kein neuer Durchlauf (keine zweite request_id, kein zweiter Aufruf)', async () => {
    const { result } = render();
    await act(async () => { await result.current.start(); });
    finishAnswer = () => new Promise<Answer>(() => undefined);
    act(() => { void result.current.confirm(); });
    await waitFor(() => { expect(result.current.state.phase).toBe('sending'); });
    await act(async () => { await result.current.start(); });
    act(() => { result.current.reset(); });
    expect(result.current.state.phase).toBe('sending');
    expect(calls('finish_preflight')).toHaveLength(1);
  });
});

describe('H-2 der Dienst bekommt den rohen Cloud-Stand, nicht die Überlagerung der Anzeige', () => {
  it('die Anzeige trägt ein Tor aus der Spielsteuerung, der rohe Stand gleicht dem Server → bereit, gesendet wird der Serverstand', async () => {
    const m = matchOf(tournament, NK.kammer, NK.wagingRot);
    const angezeigt = withMatch(tournament, m.id, { scoreA: (m.scoreA ?? 0) + 1 });
    const loadRaw = vi.fn(() => Promise.resolve(tournament));
    const { result } = renderHook(() => useFinishTournament(angezeigt, { reload, loadRaw }));
    await act(async () => { await result.current.start(); });
    expect(result.current.state.phase).toBe('confirming');
    expect(loadRaw).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.confirm(); });
    expect(calls('finish_tournament')[0].p_expected_state).toEqual(serverState);
  });

  it('Gegenbeispiel: ohne rohen Stand (nur die Überlagerung) endet es in „Stand neu laden“ – der Fehler, den H-2 verhindert', async () => {
    const m = matchOf(tournament, NK.kammer, NK.wagingRot);
    const { result } = render(withMatch(tournament, m.id, { scoreA: (m.scoreA ?? 0) + 1 }));
    await act(async () => { await result.current.start(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'STALE_STATE' } });
  });

  it('der rohe Stand ist nicht lesbar → „Prüfung gescheitert“, kein Abschluss', async () => {
    const { result } = renderHook(() => useFinishTournament(tournament, { reload, loadRaw: () => Promise.resolve(null) }));
    await act(async () => { await result.current.start(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'CHECK_FAILED' } });
    expect(calls('finish_tournament')).toEqual([]);
  });
});

describe('H-5 ALREADY_FINISHED: nie behaupten, jemand anderes habe abgeschlossen', () => {
  it('Prüfung meldet „abgeschlossen“ (ohne Person): Grund ohne Namen, die Ansicht lädt neu', async () => {
    server.rpc.mockImplementation((fn: string) => (fn === 'finish_preflight'
      ? Promise.resolve(ok({ status: 'ok', lifecycle: 'finished', finishedAt: '2026-11-28T12:10:00+00:00', canFinish: false, items: [], warnings: [], state: serverState }))
      : Promise.resolve(ok([]))));
    const { result } = render();
    await act(async () => { await result.current.start(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'ALREADY_FINISHED', at: '2026-11-28T12:10:00+00:00' } });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('der Server nennt beim Abschluss die Person → sie steht im Grund; nennt er sie nicht, fehlt das Feld', async () => {
    const { result } = render();
    await act(async () => { await result.current.start(); });
    finishAnswer = () => Promise.resolve(ok({ status: 'rejected', code: 'ALREADY_FINISHED', by: 'Maria', at: '2026-11-28T12:10:00+00:00' }));
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'ALREADY_FINISHED', at: '2026-11-28T12:10:00+00:00', by: 'Maria' } });

    await act(async () => { await result.current.start(); });
    finishAnswer = () => Promise.resolve(ok({ status: 'rejected', code: 'ALREADY_FINISHED', by: null, at: null }));
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state).toEqual({ phase: 'rejected', reason: { code: 'ALREADY_FINISHED', at: null } });
  });
});

describe('H-6 die Startseite lädt nach dem Abschluss ihre Liste neu', () => {
  it('nach dem Abschluss meldet die App „tournament-updated“ – nach dem Neuladen des Turniers, vor „fertig“', async () => {
    const gehoert = vi.fn();
    window.addEventListener('tournament-updated', gehoert);
    const { result } = render();
    await act(async () => { await result.current.start(); });
    expect(gehoert).not.toHaveBeenCalled();
    await act(async () => { await result.current.confirm(); });
    expect(result.current.state.phase).toBe('done');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(gehoert).toHaveBeenCalledTimes(1);
    window.removeEventListener('tournament-updated', gehoert);
  });

  it('Gegenbeispiel: abgelehnt oder nicht bestätigt (Server sagt „läuft noch“) → keine Meldung', async () => {
    const gehoert = vi.fn();
    window.addEventListener('tournament-updated', gehoert);
    finishAnswer = () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
    const { result } = render();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    await waitFor(() => { expect(result.current.state.phase).toBe('unconfirmed'); });
    expect(gehoert).not.toHaveBeenCalled();
    window.removeEventListener('tournament-updated', gehoert);
  });

  it('meldet der Server nach ausgebliebener Antwort „abgeschlossen“, kommt die Meldung ebenfalls', async () => {
    const gehoert = vi.fn();
    window.addEventListener('tournament-updated', gehoert);
    finishAnswer = () => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } });
    lifecycleAnswer = 'finished';
    const { result } = render();
    await act(async () => { await result.current.start(); });
    await act(async () => { await result.current.confirm(); });
    expect(gehoert).toHaveBeenCalledTimes(1);
    window.removeEventListener('tournament-updated', gehoert);
  });
});
