/**
 * BP-1 – Befund C-AUTH-ABGELAUFEN-ANDERE-MUTATIONEN (N0), Szenario @FU-009 (Grundriss über die Eintragsarten).
 *
 * Gherkin (plattform/2026-09-24_fundament-gemeinsamer-stand.md, @FU-009):
 *   Gegeben das Gerät war 6 Stunden ohne Netz, und auf ihm warten <Einträge>; die Anmeldung ist inzwischen abgelaufen
 *   Wenn das Gerät wieder Netz hat
 *   Dann bittet es um erneute Anmeldung, ohne Einträge zu verwerfen
 *   Und kein wartender Eintrag wird als „nicht übernommen“ gezeigt
 *   Und nach der Anmeldung werden alle übertragen
 *
 * Abgelaufene Anmeldung am Datenweg = PostgREST-Antwort HTTP 401 mit Code PGRST301/PGRST302/PGRST303 (PostgREST-Doku,
 * Gruppe 3 JWT; „JWT expired“). Echter `SupabaseRepository` mit einem Fake-Client, damit auch das Einpacken der Fehler
 * (z. B. je Spiel in `updateMatches`) mitgeprüft wird. Gegenbeispiel: 42501 (Rechte) ist keine abgelaufene Anmeldung.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchUpdate, Tournament } from '../../models/types';

const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    setItemPersisted: vi.fn((key: string, value: string) => { mockStorage.set(key, value); return true; }),
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
    getIsAvailable: vi.fn(() => true),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../match/client/guestEngineEntries', () => ({ hasGuestEngineEntries: vi.fn(async () => false) }));

/** Antwort, die jede Abfrage des Fake-Clients liefert (umschaltbar: abgelaufen → gültig). */
const client = vi.hoisted(() => {
  const state: { response: { data: unknown; error: unknown }; calls: number } = {
    response: { data: null, error: null },
    calls: 0,
  };
  /** Kettenfähige Abfrage: jede Methode liefert wieder die Abfrage, `await` liefert `state.response`. */
  function query(): unknown {
    const target: Record<string, unknown> = {};
    const proxy: unknown = new Proxy(target, {
      get(_t, prop) {
        if (prop === 'then') {
          state.calls += 1;
          const response = state.response;
          return (resolve: (v: unknown) => void) => resolve(response);
        }
        return () => proxy;
      },
    });
    return proxy;
  }
  const supabase = {
    from: () => query(),
    auth: {
      getUser: async () => ({ data: { user: { id: 'olli' } }, error: null }),
      getSession: async () => ({ data: { session: { user: { id: 'olli' } } }, error: null }),
    },
  };
  return { state, supabase };
});
vi.mock('../../../lib/supabase', () => ({ supabase: client.supabase, isSupabaseConfigured: true }));

import { MutationQueue, type MutationType } from '../MutationQueue';
import { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { teamSlot } from '../../models/matchSlot';
import { mapTournamentFromSupabase } from '../../repositories/supabaseMappers';
import { createTournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const JWT_EXPIRED = (code: string) => ({ data: null, error: { code, message: 'JWT expired', details: null, hint: null } });
const OK = { data: [{ id: 'row' }], error: null };

/** Vollständiges Turnier aus einer Cloud-Zeile (Fabrik), damit `save()` bis zum Schreiben kommt. */
function tour(id: string): Tournament {
  return mapTournamentFromSupabase(createTournamentRow({ id, version: 3 }), [], []);
}
/** Spielplan-Änderung eines Spiels (Seite A besetzt) – erzeugt eine echte Schreib-Abfrage. */
const update = (id: string): MatchUpdate => ({ id, slotA: teamSlot(testUuid(1)) });

/** Eintragsarten aus den Beispielen von @FU-009 (ohne Voll-Speichern: eigener Fall unten). */
const EINTRAEGE: ReadonlyArray<{ art: string; type: MutationType; payload: () => unknown }> = [
  { art: 'Toms Ergebnis eines Spiels im Spielplan', type: 'UPDATE_MATCH', payload: () => ({ tournamentId: 't1', update: update('m5') }) },
  { art: 'Toms Ergebnisse von 3 Spielen im Spielplan', type: 'UPDATE_MATCHES', payload: () => ({ tournamentId: 't1', updates: [update('m1'), update('m2'), update('m3')] }) },
  { art: 'Ollis Änderung des Turniernamens', type: 'UPDATE_TOURNAMENT_METADATA', payload: () => ({ tournamentId: 't1', metadata: { title: 'Live-Cup Ost' } }) },
  { art: 'Ollis Löschen des „Probe-Cup“', type: 'DELETE_TOURNAMENT', payload: () => 'probe-cup' },
];

let mq: MutationQueue | undefined;
const localRepo = { get: vi.fn(async () => null) } as unknown as LocalStorageRepository;

function storedRetryCounts(): number[] {
  const raw = mockStorage.get('mutation_queue_v1') ?? '[]';
  return (JSON.parse(raw) as Array<{ retryCount: number }>).map((i) => i.retryCount);
}

beforeEach(() => {
  mockStorage.clear();
  client.state.calls = 0;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const nav = { onLine: false };
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
});

afterEach(() => {
  mq?.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setOnline(value: boolean): void {
  (globalThis.navigator as { onLine: boolean }).onLine = value;
}

describe('BP-1 C-AUTH-ABGELAUFEN-ANDERE-MUTATIONEN: PostgREST-401 hält die Warteschlange an (@FU-009)', () => {
  it.each(EINTRAEGE.flatMap((e) => ['PGRST301', 'PGRST303'].map((code) => ({ ...e, code }))))(
    '@FU-009 $art, Antwort $code: Gerät bittet um Anmeldung, nichts „nicht übernommen“, nach der Anmeldung übertragen',
    async ({ type, payload, code }) => {
      mq = new MutationQueue(new SupabaseRepository(), localRepo);
      mq.enqueue(type, payload());
      mq.enqueue('UPDATE_MATCH', { tournamentId: 't1', update: update('m9') });
      client.state.response = JWT_EXPIRED(code);
      setOnline(true);

      await mq.process();
      await vi.advanceTimersByTimeAsync(600000);

      // kein Eintrag verworfen, keiner „nicht übernommen“, kein Fehlversuch gezählt
      expect(mq.getPendingCount()).toBe(2);
      expect(mq.getFailedCount()).toBe(0);
      expect(storedRetryCounts()).toEqual([0, 0]);
      // die Warteschlange hält an: in 10 Minuten kein weiterer Versuch
      const callsWhileExpired = client.state.calls;
      await vi.advanceTimersByTimeAsync(600000);
      expect(client.state.calls).toBe(callsWhileExpired);

      // nach der Anmeldung werden alle übertragen
      client.state.response = OK;
      await mq.resumeAfterAuth();
      expect(mq.getPendingCount()).toBe(0);
      expect(mq.getFailedCount()).toBe(0);
    },
  );

  it('@FU-009 Ollis vollständiges Speichern des Spielplans, Antwort PGRST303 auf jede Abfrage (schon beim ersten Lesen): Anmeldung, kein Fehlversuch', async () => {
    mq = new MutationQueue(new SupabaseRepository(), localRepo);
    mq.enqueue('SAVE_TOURNAMENT', tour('t1'));
    client.state.response = JWT_EXPIRED('PGRST303');
    setOnline(true);

    await mq.process();
    await vi.advanceTimersByTimeAsync(600000);

    expect(mq.getPendingCount()).toBe(1);
    expect(mq.getFailedCount()).toBe(0);
    expect(storedRetryCounts()).toEqual([0]);
  });

  it('@FU-009 Gegenbeispiel: 42501 (Recht fehlt) ist keine abgelaufene Anmeldung – zählt als Fehlversuch', async () => {
    mq = new MutationQueue(new SupabaseRepository(), localRepo);
    mq.enqueue('UPDATE_MATCH', { tournamentId: 't1', update: update('m5') });
    client.state.response = { data: null, error: { code: '42501', message: 'permission denied for table matches', details: null, hint: null } };
    setOnline(true);

    await mq.process();

    expect(storedRetryCounts()).toEqual([1]);
    expect(mq.getFailedCount()).toBe(0);
  });
});
