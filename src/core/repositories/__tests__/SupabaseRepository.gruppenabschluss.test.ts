/**
 * GA4 A-13b-C Punkte 1 bis 3: Lesen und Schreiben im SupabaseRepository.
 * - `get` bringt Abschlüsse (`group_completions`) und Verlauf (`bracket_log_read`) ans Turnier (@TM-046, @W2A-071) und lädt
 *   auch dann, wenn beides fehlt (vor dem Einspielen von `_006`, ohne Recht).
 * - Entscheidungen, Abschluss und Wiederöffnen gehen NUR über die Funktionen (R-GA4v2-1) – nie über einen REST-Zugriff auf
 *   `tournaments` (der Trigger `tournaments_keep_standing_decisions` verwürfe ihn still, @W2A-048/@W2A-060).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

type Result = { data?: unknown; error?: { message: string; code?: string } | null };

const hoisted = vi.hoisted(() => {
  const queues = new Map<string, Result[]>();
  const calls: Array<{ table: string; method: string }> = [];
  const rpc = vi.fn();
  function builder(table: string): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'order', 'single', 'update', 'delete', 'insert', 'upsert']) {
      self[method] = () => { calls.push({ table, method }); return self; };
    }
    self.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => {
      const next = queues.get(table)?.shift() ?? { data: [], error: null };
      return Promise.resolve(next).then(resolve, reject);
    };
    return self;
  }
  return { queues, calls, rpc, supabase: { from: (table: string) => builder(table), auth: { getUser: vi.fn() }, rpc } };
});

vi.mock('../../../lib/supabase', () => ({ supabase: hoisted.supabase, isSupabaseConfigured: true }));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { SupabaseRepository } from '../SupabaseRepository';
import { RetryLaterError } from '../../errors';

const { queues, calls, rpc } = hoisted;
const enqueue = (table: string, ...results: Result[]): void => { queues.set(table, [...(queues.get(table) ?? []), ...results]); };

const [NORD, SUED] = [testUuid(1), testUuid(2)];
const TOURNAMENT = createTournamentRow({ id: 'tournament-1' });
const TEAMS = [createTeamRow({ id: NORD, name: 'FC Nord' }), createTeamRow({ id: SUED, name: 'SV Süd' })];
const MATCHES = [createMatchRow({ id: 'm-1', team_a_id: NORD, team_b_id: SUED, match_number: 1 })];

function ladeAlles(): void {
  enqueue('tournaments', { data: TOURNAMENT, error: null });
  enqueue('teams', { data: TEAMS, error: null });
  enqueue('matches', { data: MATCHES, error: null });
}

const ABSCHLUSS_ZEILE = { group_id: 'A', ranking: [NORD, SUED], open_ranks: [], completed_at: '2026-12-06T10:00:00Z', stale: false, reopened_at: null };
const LOG_ZEILE = { id: 1, kind: 'complete_group', match_id: null, group_id: 'A', detail: {}, reason: null, actor_name: 'Olli', actor_role: 'owner', created_at: '2026-12-06T10:00:00Z' };

beforeEach(() => {
  queues.clear();
  calls.length = 0;
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: [], error: null });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('Lesen: Abschlüsse und Verlauf am Turnier (@TM-046, @W2A-071)', () => {
  it('@TM-046 get() trägt die Abschlüsse der Gruppen, @W2A-071 der Verlauf kommt aus bracket_log_read', async () => {
    ladeAlles();
    enqueue('group_completions', { data: [ABSCHLUSS_ZEILE], error: null });
    rpc.mockResolvedValue({ data: [LOG_ZEILE], error: null });

    const t = await new SupabaseRepository().get('tournament-1');

    expect(t?.groupCompletions).toEqual([{ groupId: 'A', ranking: [NORD, SUED], openRanks: [], stale: false, completedAt: '2026-12-06T10:00:00Z' }]);
    expect(t?.decisionLog).toEqual([expect.objectContaining({ kind: 'complete_group', actorName: 'Olli', groupId: 'A' })]);
    expect(rpc).toHaveBeenCalledWith('bracket_log_read', { p_tournament_id: 'tournament-1' });
  });

  it('@TM-059 ohne Abschluss: leere Liste (keine Gruppe abgeschlossen), nicht „unbekannt“', async () => {
    ladeAlles();
    const t = await new SupabaseRepository().get('tournament-1');
    expect(t?.groupCompletions).toEqual([]);
    expect(t?.decisionLog).toEqual([]);
  });

  it('vor dem Einspielen von _006 (Tabelle und Funktion fehlen) lädt das Turnier trotzdem, ohne die Felder', async () => {
    ladeAlles();
    enqueue('group_completions', { data: null, error: { code: 'PGRST205', message: 'Could not find the table' } });
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    const t = await new SupabaseRepository().get('tournament-1');
    expect(t?.id).toBe('tournament-1');
    expect(t).not.toHaveProperty('groupCompletions');
    expect(t).not.toHaveProperty('decisionLog');
  });

  it('@W2A-071 Helfer: der Server liefert keine Verlaufszeilen → leerer Verlauf, die Abschlüsse liest er (RLS writeMatchData)', async () => {
    ladeAlles();
    enqueue('group_completions', { data: [ABSCHLUSS_ZEILE], error: null });
    const t = await new SupabaseRepository().get('tournament-1');
    expect(t?.decisionLog).toEqual([]);
    expect(t?.groupCompletions).toHaveLength(1);
  });
});

describe('Hallen-Monitor ohne Anmeldung (anon, 42501) lädt weiter', () => {
  it('@W2A-072 group_completions und bracket_log_read ohne Leserecht: das Turnier lädt, die Felder fehlen (unbekannt)', async () => {
    ladeAlles();
    enqueue('group_completions', { data: null, error: { code: '42501', message: 'permission denied for table group_completions' } });
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied for function bracket_log_read' } });
    const t = await new SupabaseRepository().get('tournament-1');
    expect(t?.id).toBe('tournament-1');
    expect(t).not.toHaveProperty('groupCompletions');
    expect(t).not.toHaveProperty('decisionLog');
  });

  it('Gegenbeispiel: ein anderer Fehler beim Lesen der Abschlüsse lässt get() scheitern', async () => {
    ladeAlles();
    enqueue('group_completions', { data: null, error: { code: '57014', message: 'statement timeout' } });
    await expect(new SupabaseRepository().get('tournament-1')).rejects.toThrow(/statement timeout/);
  });

  it('Abschlüsse kommen nach Gruppe sortiert an (gleiche Reihenfolge, kein unnötiges Schreiben der lokalen Kopie)', async () => {
    ladeAlles();
    enqueue('group_completions', { data: [{ ...ABSCHLUSS_ZEILE, group_id: 'B' }, ABSCHLUSS_ZEILE], error: null });
    const t = await new SupabaseRepository().get('tournament-1');
    expect(t?.groupCompletions?.map((c) => c.groupId)).toEqual(['A', 'B']);
  });
});

describe('Schreiben nur über die Funktionen (R-GA4v2-1)', () => {
  it('@W2A-060 recordStandingDecision ruft record_standing_decision – kein einziger Zugriff auf eine Tabelle', async () => {
    rpc.mockResolvedValue({ data: { status: 'ok', version: 4 }, error: null });
    const decision = { id: 'e-1', groupId: '', teamIds: [NORD, SUED], order: [NORD, SUED], kind: 'shared' as const, basis: 'x' };
    const result = await new SupabaseRepository().recordStandingDecision('tournament-1', { action: 'decide', decision }, 3);
    expect(result).toEqual({ status: 'ok', alreadyApplied: false, version: 4 });
    expect(rpc).toHaveBeenCalledWith('record_standing_decision', expect.objectContaining({ p_tournament_id: 'tournament-1', p_action: 'decide', p_expected_version: 3 }));
    expect(calls).toEqual([]); // REST-Weg ausgeschlossen: weder `tournaments`.update noch irgendeine andere Tabelle
  });

  it('@TM-046 completeGroup und @TM-099 reopenGroup rufen complete_group und reopen_group', async () => {
    rpc.mockResolvedValue({ data: { status: 'ok' }, error: null });
    const repo = new SupabaseRepository();
    await repo.completeGroup('tournament-1', { groupId: 'A', ranking: [NORD, SUED], openRanks: [], tieDecisions: [], knownDecisionIds: [], expectedState: [] });
    await repo.reopenGroup('tournament-1', 'A', 'Ergebnis falsch');
    expect(rpc.mock.calls.map(([fn]) => fn)).toEqual(['complete_group', 'reopen_group']);
    expect(calls).toEqual([]);
  });

  it('Review A-13b-S Auflage 2: Verklemmung (40P01) beim Abschluss wird zu RetryLaterError, nichts wird vorgetäuscht', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '40P01', message: 'deadlock detected' } });
    await expect(new SupabaseRepository().completeGroup('tournament-1', { groupId: 'A', ranking: [NORD], openRanks: [], tieDecisions: [], knownDecisionIds: [], expectedState: [] }))
      .rejects.toBeInstanceOf(RetryLaterError);
  });
});
