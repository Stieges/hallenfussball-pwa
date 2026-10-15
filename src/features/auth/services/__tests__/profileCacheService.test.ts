/**
 * profileCacheService — Profil-Zwischenspeicher für Offline-Start (A-07h, Abdeckung features/auth).
 *
 * IndexedDB wird durch einen Speicher im Speicher ersetzt, safeLocalStorage durch eine Map.
 * Geprüft: Ablauf nach 30 Tagen, Ignorieren des Ablaufs, Teil-Updates, Fehlertoleranz,
 * und die Reihenfolge beim Wiederherstellen (localStorage vor IndexedDB, Schalter OFFLINE_FIRST).
 * Jeder Fall hat ein Gegenbeispiel.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User } from '../../types/auth.types';

const shared = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  failGet: false,
  local: new Map<string, string>(),
  offlineFirst: true,
}));

vi.mock('../../../../core/storage/IndexedDBAdapter', () => ({
  IndexedDBAdapter: class {
    async init(): Promise<void> {
      return undefined;
    }
    async get<T>(key: string): Promise<T | null> {
      if (shared.failGet) {
        throw new Error('IDB kaputt');
      }
      return (shared.store.get(key) as T | undefined) ?? null;
    }
    async set<T>(key: string, value: T): Promise<void> {
      shared.store.set(key, value);
    }
    async delete(key: string): Promise<void> {
      shared.store.delete(key);
    }
  },
}));

vi.mock('../../../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: (key: string) => shared.local.get(key) ?? null,
    setItem: (key: string, value: string) => shared.local.set(key, value),
    removeItem: (key: string) => shared.local.delete(key),
  },
}));

vi.mock('../../../../config', () => ({
  isFeatureEnabled: () => shared.offlineFirst,
}));

import {
  cacheUserProfile,
  getCachedProfile,
  clearProfileCache,
  updateCachedProfile,
  hasCachedProfile,
  getCacheTimestamp,
  restoreUserFromCache,
} from '../profileCacheService';

const DAY = 24 * 60 * 60 * 1000;
const KEY = 'auth:cachedProfile';

function makeUser(overrides: Partial<User> = {}): User {
  return { id: 'u-1', email: 'max@example.de', name: 'Max', globalRole: 'user', ...overrides } as User;
}

describe('profileCacheService', () => {
  beforeEach(() => {
    shared.store.clear();
    shared.local.clear();
    shared.failGet = false;
    shared.offlineFirst = true;
    vi.useFakeTimers({ now: new Date('2026-10-15T12:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('liefert das zuletzt gespeicherte Profil zurück', async () => {
    await cacheUserProfile(makeUser());

    expect(await getCachedProfile()).toMatchObject({ id: 'u-1', email: 'max@example.de' });
  });

  it('liefert null ohne Zwischenspeicher', async () => {
    expect(await getCachedProfile()).toBeNull();
  });

  it('Gegenbeispiel: ein 29 Tage alter Eintrag gilt noch', async () => {
    shared.store.set(KEY, { user: makeUser(), cachedAt: new Date(Date.now() - 29 * DAY).toISOString() });

    expect(await getCachedProfile()).not.toBeNull();
  });

  it('verwirft einen über 30 Tage alten Eintrag und räumt ihn weg', async () => {
    shared.store.set(KEY, { user: makeUser(), cachedAt: new Date(Date.now() - 31 * DAY).toISOString() });

    expect(await getCachedProfile()).toBeNull();
    expect(shared.store.has(KEY)).toBe(false);
  });

  it('liefert auch abgelaufene Profile, wenn ignoreExpiry gesetzt ist (Offline-Start)', async () => {
    shared.store.set(KEY, { user: makeUser(), cachedAt: new Date(Date.now() - 90 * DAY).toISOString() });

    expect(await getCachedProfile(true)).toMatchObject({ id: 'u-1' });
    expect(shared.store.has(KEY)).toBe(true);
  });

  it('meldet hasCachedProfile je nach Vorhandensein', async () => {
    expect(await hasCachedProfile()).toBe(false);

    await cacheUserProfile(makeUser());

    expect(await hasCachedProfile()).toBe(true);
  });

  it('liefert den Zeitstempel des Eintrags und null ohne Eintrag', async () => {
    expect(await getCacheTimestamp()).toBeNull();

    await cacheUserProfile(makeUser());

    expect(await getCacheTimestamp()).toBe(new Date(Date.now()).toISOString());
  });

  it('clearProfileCache entfernt den Eintrag', async () => {
    await cacheUserProfile(makeUser());

    await clearProfileCache();

    expect(await getCachedProfile(true)).toBeNull();
  });

  it('updateCachedProfile führt Teil-Updates zusammen und setzt updatedAt', async () => {
    await cacheUserProfile(makeUser({ name: 'Max' }));

    await updateCachedProfile({ name: 'Maximilian' });

    const profile = await getCachedProfile();
    expect(profile).toMatchObject({ id: 'u-1', email: 'max@example.de', name: 'Maximilian' });
    expect((profile as User & { updatedAt?: string }).updatedAt).toBe(new Date(Date.now()).toISOString());
  });

  it('Gegenbeispiel: updateCachedProfile legt ohne vorhandenen Eintrag nichts an', async () => {
    await updateCachedProfile({ name: 'Neu' });

    expect(shared.store.has(KEY)).toBe(false);
  });

  it('Gegenbeispiel: ein Fehler im Speicher wirft nicht nach außen und liefert null', async () => {
    shared.failGet = true;

    await expect(cacheUserProfile(makeUser())).resolves.toBeUndefined();
    expect(await getCachedProfile()).toBeNull();
    expect(await getCacheTimestamp()).toBeNull();
    expect(await hasCachedProfile()).toBe(false);
  });

  describe('restoreUserFromCache', () => {
    it('nimmt den Nutzer aus localStorage, wenn dort ein gültiges JSON liegt', async () => {
      shared.local.set('auth:cachedUser', JSON.stringify({ id: 'lokal' }));
      await cacheUserProfile(makeUser({ id: 'idb' }));

      expect(await restoreUserFromCache()).toMatchObject({ id: 'lokal' });
    });

    it('fällt bei kaputtem localStorage-JSON auf IndexedDB zurück', async () => {
      shared.local.set('auth:cachedUser', '{kaputt');
      await cacheUserProfile(makeUser({ id: 'idb' }));

      expect(await restoreUserFromCache()).toMatchObject({ id: 'idb' });
    });

    it('Gegenbeispiel: ohne OFFLINE_FIRST wird IndexedDB nicht gelesen', async () => {
      shared.offlineFirst = false;
      await cacheUserProfile(makeUser({ id: 'idb' }));

      expect(await restoreUserFromCache()).toBeNull();
    });

    it('liefert null ohne jeden Zwischenspeicher', async () => {
      expect(await restoreUserFromCache()).toBeNull();
    });
  });
});
