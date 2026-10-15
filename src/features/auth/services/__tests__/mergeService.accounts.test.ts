/**
 * mergeService — Kontenzusammenführung (mergeAccounts) und Zwischenspeicher der anonymen ID (A-07h, Abdeckung features/auth).
 *
 * Jeder Fall hat ein Gegenbeispiel (Flag aus, keine Sitzung, Fehler der Edge Function, ...).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface FakeClient {
  auth: { getSession: ReturnType<typeof vi.fn> };
  functions: { invoke: ReturnType<typeof vi.fn> };
}

const shared = vi.hoisted(() => ({
  client: null as FakeClient | null,
  configured: true,
  flag: true,
}));

vi.mock('../../../../lib/supabase', () => ({
  get supabase() {
    return shared.client;
  },
  get isSupabaseConfigured() {
    return shared.configured;
  },
}));

vi.mock('../../../../config', () => ({
  isFeatureEnabled: () => shared.flag,
}));

import {
  mergeAccounts,
  storeAnonymousUserIdForMerge,
  getPendingMergeUserId,
  clearPendingMerge,
} from '../mergeService';

function makeClient(): FakeClient {
  return {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } }, error: null }) },
    functions: { invoke: vi.fn() },
  };
}

function makeSessionStorage(): Storage {
  // Minimaler Speicher für die Tests; nur die genutzten Methoden werden gebraucht.
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

describe('mergeAccounts', () => {
  beforeEach(() => {
    shared.client = makeClient();
    shared.configured = true;
    shared.flag = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bricht ab, wenn das Feature-Flag MERGE_ACCOUNTS aus ist, und ruft nichts auf', async () => {
    shared.flag = false;

    expect(await mergeAccounts('anon-1')).toEqual({
      success: false,
      error: 'Kontenzusammenführung ist nicht aktiviert',
    });
    expect(shared.client!.functions.invoke).not.toHaveBeenCalled();
  });

  it('meldet ohne Supabase, dass Cloud-Funktionen fehlen', async () => {
    shared.configured = false;

    expect(await mergeAccounts('anon-1')).toEqual({
      success: false,
      error: 'Cloud-Funktionen sind nicht verfügbar',
    });
  });

  it('verlangt eine anonyme Benutzer-ID', async () => {
    expect(await mergeAccounts('')).toEqual({ success: false, error: 'Keine anonyme Benutzer-ID angegeben' });
  });

  it('verlangt eine Sitzung des Zielkontos', async () => {
    shared.client!.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    expect(await mergeAccounts('anon-1')).toEqual({ success: false, error: 'Nicht angemeldet' });
    expect(shared.client!.functions.invoke).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ein Fehler beim Sitzungslesen ist ebenfalls „Nicht angemeldet“', async () => {
    shared.client!.auth.getSession.mockResolvedValue({ data: { session: null }, error: { message: 'x' } });

    expect(await mergeAccounts('anon-1')).toEqual({ success: false, error: 'Nicht angemeldet' });
  });

  it('übergibt die anonyme ID an die Edge Function merge-accounts', async () => {
    shared.client!.functions.invoke.mockResolvedValue({ data: { success: true, tournamentsMerged: 2 }, error: null });

    await mergeAccounts('anon-1');

    expect(shared.client!.functions.invoke).toHaveBeenCalledWith('merge-accounts', {
      body: { anonymousUserId: 'anon-1' },
    });
  });

  it('meldet den Erfolg mit der Anzahl übertragener Turniere', async () => {
    shared.client!.functions.invoke.mockResolvedValue({ data: { success: true, tournamentsMerged: 3 }, error: null });

    expect(await mergeAccounts('anon-1')).toEqual({ success: true, tournamentsMerged: 3 });
  });

  it('Gegenbeispiel: fehlt die Anzahl in der Antwort, gilt sie als 0 statt als Fehler', async () => {
    shared.client!.functions.invoke.mockResolvedValue({ data: { success: true }, error: null });

    expect(await mergeAccounts('anon-1')).toEqual({ success: true, tournamentsMerged: 0 });
  });

  it('reicht die Meldung eines Edge-Function-Fehlers durch', async () => {
    shared.client!.functions.invoke.mockResolvedValue({ data: null, error: { message: 'Edge down' } });

    expect(await mergeAccounts('anon-1')).toEqual({ success: false, error: 'Edge down' });
  });

  it('nimmt die Standardmeldung, wenn der Fehler keine Meldung trägt', async () => {
    shared.client!.functions.invoke.mockResolvedValue({ data: null, error: {} });

    expect(await mergeAccounts('anon-1')).toEqual({
      success: false,
      error: 'Fehler beim Zusammenführen der Konten',
    });
  });

  it('meldet eine leere Antwort als fehlende Serverantwort', async () => {
    shared.client!.functions.invoke.mockResolvedValue({ data: null, error: null });

    expect(await mergeAccounts('anon-1')).toEqual({
      success: false,
      error: 'Keine Antwort vom Server erhalten',
    });
  });

  it('übernimmt die Fehlermeldung der Antwort, wenn der Server ablehnt', async () => {
    shared.client!.functions.invoke.mockResolvedValue({ data: { success: false, error: 'Konto gesperrt' }, error: null });

    expect(await mergeAccounts('anon-1')).toEqual({ success: false, error: 'Konto gesperrt' });
  });

  it('nimmt die unbekannte Standardmeldung, wenn der Server ohne Begründung ablehnt', async () => {
    shared.client!.functions.invoke.mockResolvedValue({ data: { success: false }, error: null });

    expect(await mergeAccounts('anon-1')).toEqual({
      success: false,
      error: 'Unbekannter Fehler beim Zusammenführen',
    });
  });

  it('reicht die Meldung einer Ausnahme durch', async () => {
    shared.client!.functions.invoke.mockRejectedValue(new Error('Timeout'));

    expect(await mergeAccounts('anon-1')).toEqual({ success: false, error: 'Timeout' });
  });

  it('Gegenbeispiel: eine Ausnahme ohne Error-Objekt wird als unbekannter Fehler gemeldet', async () => {
    shared.client!.functions.invoke.mockRejectedValue('kaputt');

    expect(await mergeAccounts('anon-1')).toEqual({ success: false, error: 'Unbekannter Fehler' });
  });
});

describe('Zwischenspeicher der anonymen ID für die Zusammenführung', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', makeSessionStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gibt die gespeicherte ID einmal zurück und löscht sie danach', () => {
    storeAnonymousUserIdForMerge('anon-7');

    expect(getPendingMergeUserId()).toBe('anon-7');
    expect(getPendingMergeUserId()).toBeNull();
  });

  it('Gegenbeispiel: ohne Speichern ist nichts zu holen', () => {
    expect(getPendingMergeUserId()).toBeNull();
  });

  it('clearPendingMerge verwirft die gespeicherte ID', () => {
    storeAnonymousUserIdForMerge('anon-8');

    clearPendingMerge();

    expect(getPendingMergeUserId()).toBeNull();
  });

  it('wirft nicht, wenn sessionStorage nicht verfügbar ist', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blockiert');
      },
      setItem: () => {
        throw new Error('blockiert');
      },
      removeItem: () => {
        throw new Error('blockiert');
      },
    });

    expect(() => storeAnonymousUserIdForMerge('anon-9')).not.toThrow();
    expect(() => clearPendingMerge()).not.toThrow();
    expect(getPendingMergeUserId()).toBeNull();
  });
});
