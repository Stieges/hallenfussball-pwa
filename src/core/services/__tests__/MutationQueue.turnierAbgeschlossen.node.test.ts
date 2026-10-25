/**
 * R3-2a (Plan R3 Fassung 3.1, Nachblick #344 A3): Nach dem Abschluss lehnt der Server jede Änderung am Turnier mit SQLSTATE
 * 55000 und dem Text TOURNAMENT_FINISHED ab (Migration 20261113_003, R-EA-6). Die Turnier-Warteschlange wertet das als
 * eindeutig endgültig: beim ersten Versuch „nicht übernommen – Turnier ist abgeschlossen“, kein neuer Versuch, keine Schleife.
 *
 * Szenarien:
 * - @LZ-038 Z. 2: Ollis Konto setzt das Ergebnis des Finales auf 1:2 → abgelehnt, der Endstand ist unverändert.
 * - @HE-070 Z. 1 / @FU-057 Z. 1: ein Eintrag nach dem Abschluss wird abgelehnt mit „Turnier ist abgeschlossen“.
 * - @FU-126: eindeutige Ablehnung → „nicht übernommen“ mit Grund, nicht noch einmal von selbst, die übrigen Einträge gehen weiter.
 * Gegenbeispiel @FU-127: ein unklarer Fehler (hier 42501) wird weiter wiederholt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from '../../models/types';

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
vi.mock('../../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock('../../match/client/guestEngineEntries', () => ({ hasGuestEngineEntries: vi.fn(async () => false) }));

import { MutationQueue } from '../MutationQueue';
import { RepositoryError, definitiveRejectionReason } from '../../errors';
import type { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { LocalStorageRepository } from '../../repositories/LocalStorageRepository';

const FAILED_KEY = 'mutation_queue_failed_v1';
const localRepo = { get: vi.fn(async () => null), confirmUpload: vi.fn(async () => undefined) } as unknown as LocalStorageRepository;

/** Antwort des Servers wie in `guard_closed_tournament` / `tournaments_guard_lifecycle` (20261113_003). */
const finishedRow = { code: '55000', message: 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (Turnier live-cup).', details: null, hint: null };
const finishedChild = { code: '55000', message: 'TOURNAMENT_FINISHED: Turnier ist abgeschlossen (matches, Turnier live-cup).', details: null, hint: null };

/** So packt `SupabaseRepository` die Ablehnung ein: `save` als Objekt, `updateMatches` als Liste je Spiel (Code kopiert). */
const saveRejected = () => new RepositoryError('save', finishedRow.message, finishedRow);
const updateMatchesRejected = () => {
  const perMatch = Object.assign(new Error(`Match finale: ${finishedChild.message}`), { code: finishedChild.code });
  return new RepositoryError('updateMatches', perMatch.message, [perMatch]);
};

function tour(id: string, title: string): Tournament {
  return { id, title, version: 7, matches: [], teams: [] } as unknown as Tournament;
}

function makeRepo() {
  return {
    save: vi.fn(async (_t: Tournament): Promise<number> => 8),
    updateMatch: vi.fn(async () => undefined),
    updateMatches: vi.fn(async (): Promise<void> => undefined),
    updateTournamentMetadata: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}

let mq: MutationQueue | undefined;

beforeEach(() => {
  mockStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
});

afterEach(() => {
  mq?.dispose();
  vi.useRealTimers();
});

function setOnline(value: boolean): void {
  (globalThis.navigator as { onLine: boolean }).onLine = value;
}

describe('R3-2a 55000 TOURNAMENT_FINISHED ist endgültig (@LZ-038, @HE-070, @FU-057, @FU-126)', () => {
  it('@LZ-038 Ollis Ergebnis des Finales auf 1:2 nach dem Abschluss: beim ersten Versuch „nicht übernommen – Turnier ist abgeschlossen“, kein zweiter Versuch, Rest geht weiter', async () => {
    const repo = makeRepo();
    repo.updateMatches.mockImplementation(async () => { throw updateMatchesRejected(); });
    mq = new MutationQueue(repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('UPDATE_MATCHES', { tournamentId: 'live-cup', updates: [{ id: 'finale', scoreA: 1, scoreB: 2 }] });
    mq.enqueue('UPDATE_MATCH', { tournamentId: 'anderer-cup', update: { id: 'm5' } });
    setOnline(true);

    await mq.process();
    await vi.advanceTimersByTimeAsync(10000);

    const [failed] = mq.getFailedMutations();
    expect(mq.getFailedCount()).toBe(1);
    expect(failed.type).toBe('UPDATE_MATCHES');
    expect(failed.rejection).toBe('tournamentFinished');
    expect(failed.retryCount).toBe(0);
    expect(failed.conflict).toBeUndefined();
    expect(repo.updateMatch).toHaveBeenCalledTimes(1);
    expect(mq.getPendingCount()).toBe(0);
    // keine Schleife: auch nach 10 Minuten kein neuer Versuch
    await vi.advanceTimersByTimeAsync(600000);
    expect(repo.updateMatches).toHaveBeenCalledTimes(1);
    expect(mq.getFailedCount()).toBe(1);
  });

  it('@HE-070 @FU-057 Speichern des abgeschlossenen Turniers: Grund „Turnier ist abgeschlossen“, einmal versucht, bleibt nach Neustart mit Grund erhalten', async () => {
    const repo = makeRepo();
    repo.save.mockImplementation(async () => { throw saveRejected(); });
    mq = new MutationQueue(repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('SAVE_TOURNAMENT', tour('live-cup', 'Live-Cup'));
    setOnline(true);

    await mq.process();
    await vi.advanceTimersByTimeAsync(600000);

    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(mq.getFailedMutations().map((f) => [f.rejection, f.retryCount])).toEqual([['tournamentFinished', 0]]);

    // Neustart der App: der gespeicherte Grund ist bekannt und bleibt (Nachblick #344 A3)
    mq.dispose();
    mq = new MutationQueue(repo as unknown as SupabaseRepository, localRepo);
    expect(mq.getFailedMutations().map((f) => f.rejection)).toEqual(['tournamentFinished']);
    expect(JSON.parse(mockStorage.get(FAILED_KEY) ?? '[]')).toEqual([expect.objectContaining({ rejection: 'tournamentFinished' })]);
  });

  it('@FU-126 Erkennung: 55000 mit TOURNAMENT_FINISHED in jeder Hülle des Repositorys', () => {
    expect(definitiveRejectionReason(saveRejected())).toBe('tournamentFinished');
    expect(definitiveRejectionReason(updateMatchesRejected())).toBe('tournamentFinished');
    expect(definitiveRejectionReason(finishedRow)).toBe('tournamentFinished');
  });

  it('Gegenbeispiel: 55000 ohne TOURNAMENT_FINISHED (Spiel nicht mehr beschreibbar, Turnier gelöscht) ist kein „Turnier abgeschlossen“', () => {
    const gone = { code: '55000', message: 'append_match_events: Spiel m1 nicht mehr beschreibbar' };
    expect(definitiveRejectionReason(new RepositoryError('save', gone.message, gone))).not.toBe('tournamentFinished');
  });

  it('@FU-127 Gegenbeispiel: 42501 (Rechte, unklar) wird weiter wiederholt und kommt danach an', async () => {
    const repo = makeRepo();
    let first = true;
    repo.save.mockImplementation(async () => {
      if (first) { first = false; throw new RepositoryError('save', 'permission denied', { code: '42501', message: 'permission denied' }); }
      return 8;
    });
    mq = new MutationQueue(repo as unknown as SupabaseRepository, localRepo);
    mq.enqueue('SAVE_TOURNAMENT', tour('live-cup', 'Live-Cup'));
    setOnline(true);

    await mq.process();
    expect(mq.getFailedCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(30000);
    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(mq.getFailedCount()).toBe(0);
  });
});
