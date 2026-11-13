/**
 * Befund C-ENTWURF-WIEDEROEFFNEN-LOESCHT-TEAMS (Ursachensuche 13.11.): Ein Listen-Eintrag der Startseite (Kopfdaten ohne Teams
 * und Spiele) gelangte als „ganzes Turnier“ in den Voll-Ersatz (`SupabaseRepository.save`), der am Server jedes Team und jedes nicht
 * angepfiffene Spiel löscht, das dem Stand fehlt.
 * Szenarien: docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md -- @W5-041 (Sperre in der Datenschicht), @W5-040 (Papierkorb
 * und Wiederherstellen ändern nur die Löschmarke), @W5-039 (frisch laden statt veralteter lokaler Kopie).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tournament } from '../../models/types';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));
const ops = vi.hoisted(() => ({ list: [] as Array<{ table: string; method: string; args: unknown[] }>, rows: [{ id: 'T' }] as Array<{ id: string }> }));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.get(key)),
    set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
  }),
}));
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stores.queue.set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { stores.queue.set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { stores.queue.delete(key); }),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => {
  // Aufzeichnender Client: jeder Aufruf einer Abfrage landet in `ops.list`, jede Antwort ist „leer, ohne Fehler“.
  const chain = (table: string): unknown => new Proxy(() => undefined, {
    get: (_target, property) => {
      if (property === 'then') { return (resolve: (value: unknown) => unknown) => resolve({ data: ops.rows, error: null, count: 0 }); }
      return (...args: unknown[]) => { ops.list.push({ table, method: String(property), args }); return chain(table); };
    },
  });
  return {
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: { user: { id: 'olli' } } }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: 'olli', is_anonymous: false } }, error: null })),
      },
      from: (table: string) => chain(table),
    },
  };
});

import { OfflineRepository } from '../OfflineRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { SupabaseRepository } from '../SupabaseRepository';
import { ListEntrySaveRejectedError } from '../listEntryGuard';
import { readAccountTournamentList } from '../accountTournamentList';
import { executeMetadataMutation } from '../../services/metadataMutation';
import { createFakeCloud } from '../../../test/fakeCloudRepository';
import { createMockMatch, createMockTeams, createMockTournament } from '../../../test/factories';
import { createTournamentRow } from '../../../../tests/factories/supabase';

const SECHS_TEAMS = createMockTeams(6);
const ZWEI_SPIELE = [createMockMatch({ id: 'm1', matchStatus: 'scheduled' }), createMockMatch({ id: 'm2', matchStatus: 'scheduled' })];

function volles(version = 8, extra: Partial<Tournament> = {}): Tournament {
  return createMockTournament({ id: 'T', ownerId: 'olli', version, teams: SECHS_TEAMS, matches: ZWEI_SPIELE, ...extra });
}

/** Der Eintrag, den die Startseite aus der Cloud-Liste kennt: Kopfdaten, keine Teams, keine Spiele. */
function listenEintrag(): Tournament {
  return { ...volles(), teams: [], matches: [], listEntryOnly: true, myRole: 'owner' };
}

function gespeichert(): Tournament | undefined {
  return (stores.raw.get('tournaments') as Tournament[] | undefined)?.find((t) => t.id === 'T');
}

const nurTurnierZeile = (): boolean => ops.list.every((op) => op.table === 'tournaments');

describe('Listen-Eintrag und Datenschicht', () => {
  const created: OfflineRepository[] = [];

  function repoFor(cloud: ReturnType<typeof createFakeCloud>): OfflineRepository {
    const repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    created.push(repo);
    return repo;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.stubGlobal('navigator', { onLine: false }); // die Warteschlange sendet nichts: geprüft wird, was eingereiht wird
    stores.raw.clear();
    stores.queue.clear();
    ops.list = [];
    ops.rows = [{ id: 'T' }];
  });

  afterEach(() => {
    created.splice(0).forEach((repo) => repo.mutationQueue.dispose());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('@W5-041 ein Listen-Eintrag wird nie als ganzes Turnier gespeichert', () => {
    it('die Cloud-Liste kennzeichnet jeden Eintrag als Listen-Eintrag (Produktivcode, nicht von Hand gesetzt)', async () => {
      const client = {
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'olli', is_anonymous: false } }, error: null }) },
        from: (table: string) => {
          const builder: Record<string, unknown> = {};
          for (const m of ['select', 'eq', 'not', 'is', 'order', 'in']) { builder[m] = () => builder; }
          builder.then = (resolve: (r: unknown) => unknown) => resolve({ data: table === 'tournaments' ? [createTournamentRow({ id: 'T', owner_id: 'olli' })] : [], error: null });
          return builder;
        },
      } as unknown as SupabaseClient;
      const list = await readAccountTournamentList(client);
      expect(list.tournaments).toHaveLength(1);
      expect(list.tournaments[0]).toMatchObject({ id: 'T', listEntryOnly: true, teams: [], matches: [] });
    });

    it('@W5-040 Y1: die Cloud-Liste führt gelöschte Turniere des Kontos als Listen-Eintrag mit deletedAt (der Papierkorb zeigt sie auf jedem Gerät)', async () => {
      const client = {
        auth: { getUser: () => Promise.resolve({ data: { user: { id: 'olli', is_anonymous: false } }, error: null }) },
        from: (table: string) => {
          const builder: Record<string, unknown> = {};
          for (const m of ['select', 'eq', 'not', 'is', 'order', 'in']) { builder[m] = () => builder; }
          const rows = [createTournamentRow({ id: 'aktiv', owner_id: 'olli' }), createTournamentRow({ id: 'korb', owner_id: 'olli', deleted_at: '2026-11-13T10:00:00.000Z' })];
          builder.then = (resolve: (r: unknown) => unknown) => resolve({ data: table === 'tournaments' ? rows : [], error: null });
          return builder;
        },
      } as unknown as SupabaseClient;
      const list = await readAccountTournamentList(client);
      const korb = list.tournaments.find((t) => t.id === 'korb');
      expect(korb).toMatchObject({ deletedAt: '2026-11-13T10:00:00.000Z', listEntryOnly: true, teams: [], matches: [] });
      expect(list.tournaments.find((t) => t.id === 'aktiv')?.deletedAt).toBeUndefined();
    });

    it('@W5-040 Y1: endgültig löschen eines Papierkorb-Eintrags ohne lokale Kopie reiht nur das Löschen ein, speichert nichts', async () => {
      const cloud = createFakeCloud({ tournament: volles(), revisions: new Map() });
      const repo = repoFor(cloud);

      await repo.delete('T');

      expect(repo.mutationQueue.hasPendingOf('T', ['DELETE_TOURNAMENT'])).toBe(true);
      expect(repo.mutationQueue.hasPendingOf('T', ['SAVE_TOURNAMENT'])).toBe(false);
      expect(cloud.fake.save).not.toHaveBeenCalled();
    });

    it('SupabaseRepository.save lehnt den Listen-Eintrag ab, bevor eine einzige Abfrage läuft (kein teams.delete, kein matches.delete)', async () => {
      await expect(new SupabaseRepository().save(listenEintrag())).rejects.toBeInstanceOf(ListEntrySaveRejectedError);
      expect(ops.list).toEqual([]);
    });

    it('OfflineRepository.save lehnt den Listen-Eintrag ab: nichts lokal, nichts in der Warteschlange', async () => {
      const repo = repoFor(createFakeCloud({ tournament: volles(), revisions: new Map() }));
      stores.raw.set('tournaments', [volles(7)]);

      await expect(repo.save(listenEintrag())).rejects.toBeInstanceOf(ListEntrySaveRejectedError);

      expect(repo.mutationQueue.getPendingCount()).toBe(0);
      expect(gespeichert()?.teams).toHaveLength(6); // die volle lokale Kopie bleibt unangetastet
    });

    it('Gegenbeispiel: dasselbe Turnier ohne Kennzeichnung (voll geladen) wird gespeichert und eingereiht', async () => {
      const repo = repoFor(createFakeCloud({ tournament: volles(), revisions: new Map() }));

      await repo.save({ ...volles(), title: 'Neuer Name' });

      expect(repo.mutationQueue.hasPendingOf('T', ['SAVE_TOURNAMENT'])).toBe(true);
      expect(gespeichert()).toMatchObject({ title: 'Neuer Name' });
      expect(gespeichert()?.teams).toHaveLength(6);
    });
  });

  describe('@W5-040 Papierkorb und Wiederherstellen ändern nur die Löschmarke', () => {
    const IN_DEN_KORB = '2026-11-13T10:00:00.000Z';

    it('Server: die Warteschlangen-Änderung berührt nur die Turnier-Zeile (deleted_at), nie teams oder matches', async () => {
      const server = new SupabaseRepository();
      const local = new LocalStorageRepository();

      await executeMetadataMutation(server, local, { tournamentId: 'T', metadata: {}, trash: { deletedAt: IN_DEN_KORB } });
      await executeMetadataMutation(server, local, { tournamentId: 'T', metadata: {}, trash: { deletedAt: null } });

      expect(ops.list.length).toBeGreaterThan(0);
      expect(nurTurnierZeile()).toBe(true);
      expect(ops.list.some((op) => op.method === 'delete')).toBe(false);
      const marken = ops.list.filter((op) => op.method === 'update').map((op) => op.args[0]);
      expect(marken).toEqual([{ deleted_at: IN_DEN_KORB }, { deleted_at: null }]);
    });

    it('@W5-040 Y2: lehnt die Zeilen-Sicherheit ab (0 Zeilen, kein Fehler), scheitern Papierkorb und Wiederherstellen laut', async () => {
      ops.rows = [];
      const server = new SupabaseRepository();
      await expect(server.setTrashed('T', IN_DEN_KORB)).rejects.toThrow(/keine Zeile geändert/);
      await expect(server.setTrashed('T', null)).rejects.toThrow(/keine Zeile geändert/);
    });

    it('Gerät mit lokaler Kopie: Papierkorb und Wiederherstellen lassen 6 Teams und 2 Spiele stehen und reihen keinen Voll-Ersatz ein', async () => {
      const repo = repoFor(createFakeCloud({ tournament: volles(), revisions: new Map() }));
      stores.raw.set('tournaments', [volles()]);

      await repo.setTrashed('T', IN_DEN_KORB);
      expect(gespeichert()?.deletedAt).toBe(IN_DEN_KORB);
      await repo.setTrashed('T', null);

      expect(gespeichert()?.deletedAt).toBeUndefined();
      expect(gespeichert()?.teams).toHaveLength(6);
      expect(gespeichert()?.matches).toHaveLength(2);
      expect(repo.mutationQueue.hasPendingOf('T', ['SAVE_TOURNAMENT'])).toBe(false);
      expect(repo.mutationQueue.hasPendingOf('T', ['UPDATE_TOURNAMENT_METADATA'])).toBe(true);
    });

    it('Gerät ohne lokale Kopie (nur der Listen-Eintrag): die Marke geht direkt an den Server, es wird kein Turnier gespeichert', async () => {
      const cloud = createFakeCloud({ tournament: volles(), revisions: new Map() });
      const setTrashed = vi.fn(() => Promise.resolve());
      const repo = new OfflineRepository(new LocalStorageRepository(), { ...cloud.fake, setTrashed } as never, 'olli');
      created.push(repo);

      await repo.setTrashed('T', IN_DEN_KORB);

      expect(setTrashed).toHaveBeenCalledWith('T', IN_DEN_KORB, {});
      expect(cloud.fake.save).not.toHaveBeenCalled();
      expect(gespeichert()).toBeUndefined(); // der Eintrag wird nicht als Kopie abgelegt
      expect(repo.mutationQueue.getPendingCount()).toBe(0);
    });

    it('Gegenbeispiel: ohne Netz scheitert das Verschieben ohne lokale Kopie laut, statt still etwas zu speichern', async () => {
      const cloud = createFakeCloud({ tournament: volles(), revisions: new Map() });
      const setTrashed = vi.fn(() => Promise.reject(new Error('offline')));
      const repo = new OfflineRepository(new LocalStorageRepository(), { ...cloud.fake, setTrashed } as never, 'olli');
      created.push(repo);

      await expect(repo.setTrashed('T', IN_DEN_KORB)).rejects.toThrow('offline');
      expect(cloud.fake.save).not.toHaveBeenCalled();
    });
  });

  describe('@W5-039 frisch laden: eine veraltete lokale Kopie ohne wartende Änderung überschreibt den Server nicht', () => {
    it('Y3: scheitert der Cloud-Abruf, liefert fresh die lokale Kopie UND meldet den Rückfall; mit Cloud-Stand kein Rückfall', async () => {
      stores.raw.set('tournaments', [volles(7)]);
      const cloud = createFakeCloud({ tournament: volles(8), revisions: new Map([['m1', 1], ['m2', 1]]) });
      const repo = repoFor(cloud);
      const fallback = vi.fn();

      await repo.get('T', { fresh: true, onLocalFallback: fallback });
      expect(fallback).not.toHaveBeenCalled();

      cloud.fake.getWithMatchRevisions.mockRejectedValueOnce(new Error('Zeitgrenze'));
      const got = await repo.get('T', { fresh: true, onLocalFallback: fallback });
      expect(got?.id).toBe('T');
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('get ohne fresh liefert die alte lokale Kopie (Risiko), get mit fresh den Server-Stand mit allen 6 Teams', async () => {
      stores.raw.set('tournaments', [volles(7, { teams: SECHS_TEAMS.slice(0, 2) })]);
      const repo = repoFor(createFakeCloud({ tournament: volles(8), revisions: new Map([['m1', 1], ['m2', 1]]) }));

      const schnell = await repo.get('T');
      expect(schnell?.teams).toHaveLength(2);

      const frisch = await repo.get('T', { fresh: true });
      expect(frisch?.teams).toHaveLength(6);
    });
  });
});
