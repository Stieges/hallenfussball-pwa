/**
 * A-02 (MVP-Bauplan Spur A, GA1): Lesewege des SupabaseRepository liefern die gespeicherte
 * Besetzung als Slots – jedes Gerät (Leitung über `get`, Zuschauer über `getByShareCode`) sieht
 * dieselbe Seite, ohne Namens-Map. Dazu die Fehlerzweige der Lese-/Verwaltungsmethoden, die bisher
 * ungetestet waren.
 *
 * Anforderung: @TM-027 (alle Geräte zeigen dieselbe Besetzung).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

type Result = { data?: unknown; error?: { message: string; code?: string; name?: string } | null };

const hoisted = vi.hoisted(() => {
  const queues = new Map<string, Result[]>();
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const getUser = vi.fn();
  const rpc = vi.fn();

  /** Kettenfähiger Abfrage-Stub: jede Methode protokolliert und liefert sich selbst; `await` holt das nächste Ergebnis der Tabelle. */
  function builder(table: string): Record<string, unknown> {
    const self: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'order', 'single', 'update', 'delete', 'insert']) {
      self[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return self;
      };
    }
    self.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => {
      const next = queues.get(table)?.shift();
      return next ? Promise.resolve(next).then(resolve, reject) : Promise.reject(new Error(`kein Ergebnis für ${table}`)).then(resolve, reject);
    };
    return self;
  }

  const supabaseMock = { from: (table: string) => builder(table), auth: { getUser }, rpc };
  return { queues, calls, getUser, rpc, supabaseMock };
});

vi.mock('../../../lib/supabase', () => ({
  supabase: hoisted.supabaseMock,
  isSupabaseConfigured: true,
}));

import { SupabaseRepository } from '../SupabaseRepository';
import { OptimisticLockError, RepositoryError } from '../../errors';

const { queues, calls, getUser, rpc } = hoisted;

function enqueue(table: string, ...results: Result[]): void {
  queues.set(table, [...(queues.get(table) ?? []), ...results]);
}

const NORD = testUuid(1);
const SUED = testUuid(2);
const HF1 = testUuid(50);
const TOURNAMENT = createTournamentRow({ id: 'tournament-1', share_code: 'ABC123' });
const TEAMS = [createTeamRow({ id: NORD, name: 'FC Nord' }), createTeamRow({ id: SUED, name: 'SV Süd' })];
const MATCHES = [
  createMatchRow({ id: 'm-group', team_a_id: NORD, team_b_id: SUED, match_number: 1 }),
  createMatchRow({
    id: 'm-final',
    team_a_id: NORD,
    slot_a_source: { kind: 'matchResult', matchId: HF1, role: 'winner' },
    team_b_id: null,
    slot_b_source: { kind: 'matchResult', matchId: testUuid(51), role: 'winner' },
    is_final: true,
    match_number: 2,
  } as Parameters<typeof createMatchRow>[0]),
];

beforeEach(() => {
  queues.clear();
  calls.length = 0;
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('SupabaseRepository.get / getByShareCode – Besetzung als Slots (@TM-027)', () => {
  it('@TM-027 get(): aufgelöste und offene Seiten kommen als Slot zurück, ohne Namens-Map', async () => {
    enqueue('tournaments', { data: TOURNAMENT, error: null });
    enqueue('teams', { data: TEAMS, error: null });
    enqueue('matches', { data: MATCHES, error: null });

    const t = await new SupabaseRepository().get('tournament-1');

    expect(t?.matches[0].slotA).toEqual({ kind: 'team', teamId: NORD });
    expect(t?.matches[1].slotA).toEqual({ kind: 'team', teamId: NORD, resolvedFrom: { kind: 'matchResult', matchId: HF1, role: 'winner' } });
    expect(t?.matches[1].slotB).toEqual({ kind: 'pending', source: { kind: 'matchResult', matchId: testUuid(51), role: 'winner' } });
  });

  it('@TM-027 getByShareCode(): Zuschauer sieht dieselbe Besetzung wie die Leitung', async () => {
    enqueue('tournaments', { data: TOURNAMENT, error: null }, { data: TOURNAMENT, error: null });
    enqueue('teams', { data: TEAMS, error: null }, { data: TEAMS, error: null });
    enqueue('matches', { data: MATCHES, error: null }, { data: MATCHES, error: null });
    const repo = new SupabaseRepository();

    const leitung = await repo.get('tournament-1');
    const zuschauer = await repo.getByShareCode(' abc123 ');

    expect(zuschauer?.matches.map((m) => [m.slotA, m.slotB])).toEqual(leitung?.matches.map((m) => [m.slotA, m.slotB]));
    expect(calls).toContainEqual({ table: 'tournaments', method: 'eq', args: ['share_code', 'ABC123'] });
  });

  it('@TM-027 Gegenbeispiel: kaputte Zeile (Seite ohne Team-ID und Herkunft) lässt get() laut scheitern statt „TBD“', async () => {
    enqueue('tournaments', { data: TOURNAMENT, error: null });
    enqueue('teams', { data: TEAMS, error: null });
    enqueue('matches', { data: [createMatchRow({ id: 'kaputt', team_a_id: NORD, team_b_id: null })], error: null });

    await expect(new SupabaseRepository().get('tournament-1')).rejects.toThrow(RepositoryError);
  });

  it('get(): nicht gefunden (PGRST116) → null', async () => {
    enqueue('tournaments', { data: null, error: { message: 'none', code: 'PGRST116' } });

    await expect(new SupabaseRepository().get('x')).resolves.toBeNull();
  });

  it('get(): Abbruch (AbortError) in jeder Teilabfrage → null', async () => {
    const abort = { message: 'aborted', name: 'AbortError' };
    enqueue('tournaments', { data: null, error: abort }, { data: TOURNAMENT, error: null }, { data: TOURNAMENT, error: null });
    enqueue('teams', { data: null, error: abort }, { data: TEAMS, error: null });
    enqueue('matches', { data: null, error: abort });
    const repo = new SupabaseRepository();

    await expect(repo.get('t')).resolves.toBeNull();
    await expect(repo.get('t')).resolves.toBeNull();
    await expect(repo.get('t')).resolves.toBeNull();
  });

  it('get(): echte Fehler der Teilabfragen werfen RepositoryError', async () => {
    enqueue('tournaments', { data: null, error: { message: 'boom-t' } }, { data: TOURNAMENT, error: null }, { data: TOURNAMENT, error: null });
    enqueue('teams', { data: null, error: { message: 'boom-teams' } }, { data: TEAMS, error: null });
    enqueue('matches', { data: null, error: { message: 'boom-matches' } });
    const repo = new SupabaseRepository();

    await expect(repo.get('t')).rejects.toThrow('boom-t');
    await expect(repo.get('t')).rejects.toThrow('boom-teams');
    await expect(repo.get('t')).rejects.toThrow('boom-matches');
  });

  it('getByShareCode(): ungültiges Format, nicht gefunden und Teilfehler → null', async () => {
    enqueue('tournaments',
      { data: null, error: { message: 'none', code: 'PGRST116' } },
      { data: null, error: { message: 'boom' } },
      { data: TOURNAMENT, error: null },
      { data: TOURNAMENT, error: null });
    enqueue('teams', { data: null, error: { message: 'boom-teams' } }, { data: TEAMS, error: null });
    enqueue('matches', { data: null, error: { message: 'boom-matches' } });
    const repo = new SupabaseRepository();

    await expect(repo.getByShareCode('zu-lang!')).resolves.toBeNull();
    await expect(repo.getByShareCode('ABC123')).resolves.toBeNull();
    await expect(repo.getByShareCode('ABC123')).resolves.toBeNull();
    await expect(repo.getByShareCode('ABC123')).resolves.toBeNull();
    await expect(repo.getByShareCode('ABC123')).resolves.toBeNull();
  });
});

describe('SupabaseRepository – Verwaltungsmethoden', () => {
  it('updateTournamentMetadata(): ohne Felder kein Schreibzugriff', async () => {
    await new SupabaseRepository().updateTournamentMetadata('t', {});

    expect(calls).toHaveLength(0);
  });

  it('updateTournamentMetadata(): mappt Felder, Version als optimistische Sperre', async () => {
    enqueue('tournaments', { data: [{ id: 't' }], error: null });

    await new SupabaseRepository().updateTournamentMetadata('t', {
      title: 'Neu', date: '2026-10-23', status: 'published', startTime: '09:00', isPublic: true, shareCode: 'ABC123',
      location: { name: 'Halle', street: 'Weg 1', city: 'Ort', postalCode: '12345', country: 'DE' },
      version: 4,
    });

    const payload = calls.find((c) => c.method === 'update')?.args[0] as Record<string, unknown>;
    expect(payload).toMatchObject({ title: 'Neu', location_city: 'Ort', is_public: true, share_code: 'ABC123', version: 5 });
    expect(calls).toContainEqual({ table: 'tournaments', method: 'eq', args: ['version', 4] });
  });

  it('updateTournamentMetadata(): 0 Zeilen mit Version → OptimisticLockError; DB-Fehler → RepositoryError', async () => {
    enqueue('tournaments', { data: [], error: null }, { data: null, error: { message: 'boom' } });
    const repo = new SupabaseRepository();

    await expect(repo.updateTournamentMetadata('t', { title: 'x', version: 1 })).rejects.toThrow(OptimisticLockError);
    await expect(repo.updateTournamentMetadata('t', { title: 'x' })).rejects.toThrow('boom');
  });

  it('delete/softDelete/restore: Erfolg und Fehler', async () => {
    enqueue('tournaments',
      { error: null }, { error: { message: 'd' } },
      { error: null }, { error: { message: 's' } },
      { error: null }, { error: { message: 'r' } });
    const repo = new SupabaseRepository();

    await expect(repo.delete('t')).resolves.toBeUndefined();
    await expect(repo.delete('t')).rejects.toThrow('d');
    await expect(repo.softDelete('t')).resolves.toBeUndefined();
    await expect(repo.softDelete('t')).rejects.toThrow('s');
    await expect(repo.restore('t')).resolves.toBeUndefined();
    await expect(repo.restore('t')).rejects.toThrow('r');
  });

  it('listForCurrentUser(): ohne Nutzer leer, sonst Turniere ohne Spiele; Fehler wirft', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
      .mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    enqueue('tournaments', { data: [TOURNAMENT], error: null }, { data: null, error: { message: 'list' } });
    const repo = new SupabaseRepository();

    await expect(repo.listForCurrentUser()).resolves.toEqual([]);
    const list = await repo.listForCurrentUser();
    expect(list).toHaveLength(1);
    expect(list[0].matches).toEqual([]);
    await expect(repo.listForCurrentUser()).rejects.toThrow('list');
  });

  it('addTeam(): Erfolg und Fehler', async () => {
    enqueue('teams', { error: null }, { error: { message: 'team' } });
    const repo = new SupabaseRepository();

    await expect(repo.addTeam('t', { id: NORD, name: 'FC Nord', group: 'A' })).resolves.toBeUndefined();
    await expect(repo.addTeam('t', { id: SUED, name: 'SV Süd' })).rejects.toThrow('team');
  });

  it('Share-Code-RPCs: Ergebnis, leeres Ergebnis und Fehler', async () => {
    const row = [{ share_code: 'ABC123', share_code_created_at: '2026-10-03T10:00:00Z' }];
    rpc.mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'pub' } })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'priv' } })
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'regen' } });
    const repo = new SupabaseRepository();

    await expect(repo.makeTournamentPublic('t')).resolves.toEqual({ shareCode: 'ABC123', createdAt: '2026-10-03T10:00:00Z' });
    await expect(repo.makeTournamentPublic('t')).resolves.toBeNull();
    await expect(repo.makeTournamentPublic('t')).rejects.toThrow('pub');
    await expect(repo.makeTournamentPrivate('t')).resolves.toBeUndefined();
    await expect(repo.makeTournamentPrivate('t')).rejects.toThrow('priv');
    await expect(repo.regenerateShareCode('t')).resolves.toEqual({ shareCode: 'ABC123', createdAt: '2026-10-03T10:00:00Z' });
    await expect(repo.regenerateShareCode('t')).resolves.toBeNull();
    await expect(repo.regenerateShareCode('t')).rejects.toThrow('regen');
  });

  it('getTournamentVisibility(): Werte, fehlende Zeile und Fehler', async () => {
    enqueue('tournaments',
      { data: { is_public: null, share_code: null, share_code_created_at: null }, error: null },
      { data: null, error: null },
      { data: null, error: { message: 'vis' } });
    const repo = new SupabaseRepository();

    await expect(repo.getTournamentVisibility('t')).resolves.toEqual({ isPublic: false, shareCode: null, shareCodeCreatedAt: null });
    await expect(repo.getTournamentVisibility('t')).resolves.toBeNull();
    await expect(repo.getTournamentVisibility('t')).resolves.toBeNull();
  });
});
