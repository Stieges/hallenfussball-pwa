/**
 * CA-5 (Befund C-LISTE-NUR-EIGENTUEMER) – Startseiten-Liste aus der Cloud, Fake-Cloud mit Mitgliedschafts-Tabelle.
 *
 * @HE-085 Der Betreiber trägt eine Co-Admin direkt ein:
 *   „Dann sieht Maria nach der Anmeldung mit ihrem Passwort das Nikolaus-Turnier …“
 * @HE-086 Ein Konto, das der Betreiber nicht eingetragen hat, sieht das Turnier nicht:
 *   „Und das Nikolaus-Turnier steht nicht auf ihrer Startseite“
 * @HE-087 Der Betreiber nimmt eine Co-Admin wieder aus dem Turnier:
 *   „Und das Nikolaus-Turnier steht nach dem Neuladen nicht mehr auf ihrer Startseite“
 * @FU-100 (Geist): scheitert die Mitglieder-Abfrage, bleiben die eigenen Turniere sichtbar, der Fehler wird gemeldet.
 * Plan-Review Auflage 10d: anonyme Sitzung fragt keine Mitgliedschaften ab.
 *
 * Die Fake-Cloud wertet die Filter der Abfrage aus und wendet die Lese-Regel `tournaments_select_v3` an
 * (öffentlich ODER Eigentümer ODER aktives Mitglied) – ein Listenweg ohne eigene Mitgliedschafts-Abfrage zeigte
 * hier jedes öffentliche fremde Turnier.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTournamentRow } from '../../../../tests/factories/supabase';

type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

const cloud = vi.hoisted(() => {
  const state = {
    user: null as { id: string; is_anonymous?: boolean } | null,
    tables: new Map<string, Row[]>(),
    failing: new Set<string>(),
    queried: [] as string[],
  };

  function activeMember(tournamentId: unknown, uid: string): boolean {
    return (state.tables.get('tournament_collaborators') ?? []).some((c) =>
      c.tournament_id === tournamentId && c.user_id === uid && c.accepted_at !== null && c.declined_at === null);
  }

  /** Lese-Regeln wie am Server (RLS): `tournaments_select_v3`, `collaborators_select_v3` (nur eigene Zeile). */
  function visible(table: string, row: Row): boolean {
    const uid = state.user?.id ?? '';
    if (table === 'tournaments') {
      return row.is_public === true || row.owner_id === uid || activeMember(row.id, uid);
    }
    return row.user_id === uid;
  }

  function builder(table: string): Record<string, unknown> {
    state.queried.push(table);
    const filters: Filter[] = [];
    let sortKey: string | null = null;
    const self: Record<string, unknown> = {};
    const chain = (fn: (...args: never[]) => void) => (...args: never[]) => { fn(...args); return self; };
    self.select = chain(() => undefined);
    self.eq = chain((col: string, value: unknown) => { filters.push((r) => r[col] === value); });
    self.is = chain((col: string, value: unknown) => { filters.push((r) => r[col] === value); });
    self.not = chain((col: string, op: string, value: unknown) => {
      if (op !== 'is') { throw new Error(`not(${op}) nicht nachgebildet`); }
      filters.push((r) => r[col] !== value);
    });
    self.in = chain((col: string, values: unknown[]) => { filters.push((r) => values.includes(r[col])); });
    self.order = chain((col: string) => { sortKey = col; });
    self.then = (resolve: (r: unknown) => unknown, reject: (e: unknown) => unknown) => {
      if (state.failing.has(table)) {
        return Promise.resolve({ data: null, error: { message: `${table} nicht erreichbar` } }).then(resolve, reject);
      }
      const rows = (state.tables.get(table) ?? []).filter((r) => visible(table, r) && filters.every((f) => f(r)));
      const key = sortKey;
      const sorted = key === null ? rows : [...rows].sort((a, b) => String(b[key]).localeCompare(String(a[key])));
      return Promise.resolve({ data: sorted.map((r) => ({ ...r })), error: null }).then(resolve, reject);
    };
    return self;
  }

  const client = {
    from: (table: string) => builder(table),
    auth: { getUser: () => Promise.resolve({ data: { user: state.user } }) },
  };
  return { state, client };
});

vi.mock('../../../lib/supabase', () => ({ supabase: cloud.client, isSupabaseConfigured: true }));

import { SupabaseRepository } from '../SupabaseRepository';

const OLLI = 'olli';
const MARIA = 'maria';
const GRETA = 'greta';

const NIKOLAUS = createTournamentRow({ id: 'nikolaus', title: 'Nikolaus-Turnier', owner_id: OLLI, is_public: false, updated_at: '2026-12-01T10:00:00.000Z' });
const OST = createTournamentRow({ id: 'ost', title: 'Hallencup Ost', owner_id: 'anna', is_public: true, share_code: 'OST234', updated_at: '2026-12-02T10:00:00.000Z' });
const PAPIERKORB = createTournamentRow({ id: 'alt', title: 'Altes Turnier', owner_id: OLLI, deleted_at: '2026-11-01T10:00:00.000Z' });
const GELOESCHT = createTournamentRow({ id: 'weg', title: 'Gelöschtes Turnier', owner_id: 'anna', deleted_at: '2026-11-01T10:00:00.000Z' });

function member(tournamentId: string, userId: string, role: string, extra: Row = {}): Row {
  return { id: `${tournamentId}:${userId}`, tournament_id: tournamentId, user_id: userId, role, accepted_at: '2026-11-30T10:00:00.000Z', declined_at: null, ...extra };
}

function setCloud(collaborators: Row[], user: { id: string; is_anonymous?: boolean } | null): void {
  cloud.state.tables.set('tournaments', [NIKOLAUS, OST, PAPIERKORB, GELOESCHT]);
  cloud.state.tables.set('tournament_collaborators', collaborators);
  cloud.state.user = user;
}

const titles = (list: Array<{ title: string }>) => list.map((t) => t.title);

beforeEach(() => {
  cloud.state.failing.clear();
  cloud.state.queried.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('CA-5 SupabaseRepository: Startseite zeigt eigene Turniere und aktive Mitgliedschaften', () => {
  it('@HE-085 Maria ist Co-Admin und hat kein eigenes Turnier: das Nikolaus-Turnier steht genau einmal da, mit Rolle Co-Admin', async () => {
    setCloud([member('nikolaus', MARIA, 'co-admin')], { id: MARIA });
    const list = await new SupabaseRepository().listForCurrentUser();
    expect(titles(list)).toEqual(['Nikolaus-Turnier']);
    expect(list[0].myRole).toBe('co-admin');
  });

  it('@HE-085 die Liste mit Angaben: Mitglieder-Abfrage gelungen, Nikolaus nicht unter den eigenen', async () => {
    setCloud([member('nikolaus', MARIA, 'co-admin')], { id: MARIA });
    const result = await new SupabaseRepository().listWithMemberships();
    expect(result.memberships).toBe('known');
    expect(result.ownIds.has('nikolaus')).toBe(false);
    expect(result.tournaments.map((t) => [t.id, t.myRole])).toEqual([['nikolaus', 'co-admin']]);
  });

  it('@HE-086 Greta ist nicht eingetragen: weder das Nikolaus-Turnier noch ein öffentliches fremdes Turnier steht auf ihrer Startseite', async () => {
    setCloud([member('nikolaus', MARIA, 'co-admin')], { id: GRETA });
    const result = await new SupabaseRepository().listWithMemberships();
    expect(result.tournaments).toEqual([]);
    expect(result.memberships).toBe('known');
  });

  it('@HE-087 ausgetragen (Zeile entfernt, wie die Betreiber-Vorlage Block 3): das Nikolaus-Turnier fehlt', async () => {
    setCloud([], { id: MARIA });
    expect(titles((await new SupabaseRepository().listWithMemberships()).tournaments)).toEqual([]);
  });

  // Auch beim öffentlichen Hallencup Ost: dort ließe die Lese-Regel das Turnier durch, nur der Filter der Mitgliedschaft hält es fern.
  it('@HE-087 Gegenbeispiel widerrufene Mitgliedschaft (`declined_at` gesetzt): das Turnier fehlt, auch wenn es öffentlich ist', async () => {
    const declined = { declined_at: '2026-12-01T09:00:00.000Z' };
    setCloud([member('nikolaus', MARIA, 'co-admin', declined), member('ost', MARIA, 'co-admin', declined)], { id: MARIA });
    expect(titles((await new SupabaseRepository().listWithMemberships()).tournaments)).toEqual([]);
  });

  it('Gegenbeispiel nicht angenommene Einladung (`accepted_at` leer): das Turnier fehlt, auch wenn es öffentlich ist', async () => {
    setCloud([member('nikolaus', MARIA, 'co-admin', { accepted_at: null }), member('ost', MARIA, 'co-admin', { accepted_at: null })], { id: MARIA });
    expect(titles((await new SupabaseRepository().listWithMemberships()).tournaments)).toEqual([]);
  });

  it('Gegenbeispiel gelöschtes Turnier (`deleted_at`): auch als Mitglied nicht auf der Startseite', async () => {
    setCloud([member('weg', MARIA, 'co-admin')], { id: MARIA });
    expect(titles((await new SupabaseRepository().listWithMemberships()).tournaments)).toEqual([]);
  });

  it('Rollenumfang (Auflage 10d): ein echtes Konto sieht jede aktive Mitgliedschaft mit ihrer Rolle', async () => {
    setCloud([member('nikolaus', MARIA, 'collaborator'), member('ost', MARIA, 'viewer')], { id: MARIA });
    const result = await new SupabaseRepository().listWithMemberships();
    expect(result.tournaments.map((t) => [t.id, t.myRole]).sort()).toEqual([['nikolaus', 'collaborator'], ['ost', 'viewer']]);
  });

  it('Rollenumfang (Auflage 10d): eine anonyme Sitzung fragt keine Mitgliedschaften ab, die Liste bleibt wie bisher', async () => {
    setCloud([member('nikolaus', MARIA, 'co-admin')], { id: MARIA, is_anonymous: true });
    const result = await new SupabaseRepository().listWithMemberships();
    expect(result.tournaments).toEqual([]);
    expect(result.memberships).toBe('not-queried');
    expect(cloud.state.queried).not.toContain('tournament_collaborators');
  });

  it('Olli (Eigentümer): eigenes Turnier mit Rolle owner; das im Papierkorb steht nicht in der Liste, zählt aber zu den eigenen', async () => {
    setCloud([member('nikolaus', MARIA, 'co-admin')], { id: OLLI });
    const result = await new SupabaseRepository().listWithMemberships();
    expect(result.tournaments.map((t) => [t.id, t.myRole])).toEqual([['nikolaus', 'owner']]);
    expect([...result.ownIds].sort()).toEqual(['alt', 'nikolaus']);
  });

  it('genau einmal: steht der Eigentümer zusätzlich in einer Mitgliedszeile, erscheint sein Turnier nur als eigenes', async () => {
    setCloud([member('nikolaus', OLLI, 'co-admin')], { id: OLLI });
    const list = await new SupabaseRepository().listForCurrentUser();
    expect(list.map((t) => [t.id, t.myRole])).toEqual([['nikolaus', 'owner']]);
  });

  it('@FU-100 Mitglieder-Abfrage scheitert: eigene Turniere bleiben sichtbar, Zustand „unbekannt“ mit Fehler', async () => {
    setCloud([member('nikolaus', MARIA, 'co-admin')], { id: OLLI });
    cloud.state.failing.add('tournament_collaborators');
    const result = await new SupabaseRepository().listWithMemberships();
    expect(titles(result.tournaments)).toEqual(['Nikolaus-Turnier']);
    expect(result.memberships).toBe('unknown');
    expect(result.membershipError?.message).toContain('tournament_collaborators nicht erreichbar');
  });

  it('Gegenbeispiel: scheitert die Abfrage der eigenen Turniere, wirft die Liste (wie bisher)', async () => {
    setCloud([], { id: OLLI });
    cloud.state.failing.add('tournaments');
    await expect(new SupabaseRepository().listWithMemberships()).rejects.toThrow('tournaments nicht erreichbar');
  });

  it('ohne Anmeldung: leere Liste, keine Abfrage', async () => {
    setCloud([], null);
    expect(await new SupabaseRepository().listWithMemberships()).toMatchObject({ tournaments: [], memberships: 'not-queried' });
    expect(cloud.state.queried).toEqual([]);
  });
});
