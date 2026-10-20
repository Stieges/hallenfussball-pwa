/**
 * C-SITZUNG-STILL, Fixrunde 2 (N2, Probe S1): SIGNED_IN kommt von auth-js auch OHNE Serverkontakt, aus dem
 * Speicher (`_recoverAndRefresh`, Zweig „Sitzung nicht abgelaufen“) – beim Start und bei jedem Wechsel des Tabs
 * zurück in den Vordergrund (`_onVisibilityChanged`). Das ist keine Antwort des Servers: kein „verbunden“,
 * die Wiederverbindung läuft weiter, der Hinweis „Server antwortet langsam“ bleibt (@AN-019, @AN-020, @AN-032).
 * „verbunden“ gibt es nur nach echter Antwort: TOKEN_REFRESHED, erfolgreiches Lesen der Sitzung, Anmelden.
 * Eigene Datei: der Client ist ein Singleton.
 */

import { useContext } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const net = vi.hoisted(() => ({
  respond: null as null | ((url: string, init?: RequestInit) => Promise<Response>),
}));

const cache = vi.hoisted(() => ({ user: null as null | Record<string, unknown> }));

const store = vi.hoisted(() => {
  class MapStorage {
    private data = new Map<string, string>();
    getItem(key: string): string | null { return this.data.get(key) ?? null; }
    setItem(key: string, value: string): void { this.data.set(key, String(value)); }
    removeItem(key: string): void { this.data.delete(key); }
    key(index: number): string | null { return Array.from(this.data.keys())[index] ?? null; }
    get length(): number { return this.data.size; }
    clear(): void { this.data.clear(); }
  }
  return { local: new MapStorage(), session: new MapStorage() };
});

vi.mock('../../../../core/utils/safeStorage', () => ({
  safeLocalStorage: store.local,
  safeSessionStorage: store.session,
}));

vi.mock('../../../../lib/sentry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../lib/sentry')>()),
  captureFeatureError: vi.fn(),
}));

vi.mock('../../services/profileCacheService', () => ({
  cacheUserProfile: vi.fn(async () => undefined),
  clearProfileCache: vi.fn(async () => undefined),
  restoreUserFromCache: vi.fn(async () => cache.user),
}));

vi.mock('../../../../lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const fakeFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    return net.respond ? net.respond(url, init) : Promise.resolve(new Response(null, { status: 204 }));
  };
  const client = createClient('http://localhost:54321', 'anon-key', {
    auth: { storage: store.local, autoRefreshToken: false, persistSession: true },
    global: { fetch: fakeFetch },
  });
  return { supabase: client, isSupabaseConfigured: true, supabaseProjectUrl: 'http://localhost:54321' };
});

import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { supabase } from '../../../../lib/supabase';
import { advanceInSteps } from './fakeTime';
import { AuthProvider } from '../AuthContext';
import { AuthContext } from '../authContextInstance';

const TOKEN_KEY = 'sb-localhost-auth-token';

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const USER = { id: 'user-a', aud: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

/** Gespeicherte Sitzung; `expired` = Zugangsschlüssel abgelaufen, die App muss erneuern. */
function sessionRaw(expired = false): string {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -60 : 3600);
  const access = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'user-a', role: 'authenticated', exp })}.signature`;
  return JSON.stringify({ access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-a', user: USER });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
  });
}


function Probe() {
  const ctx = useContext(AuthContext);
  return (
    <div>
      <div data-testid="probe">{ctx?.user ? 'user' : 'none'}</div>
      <div data-testid="conn">{ctx?.connectionState}</div>
      <button data-testid="do-reconnect" onClick={() => { void ctx?.reconnect(); }}>reconnect</button>
      <button data-testid="do-login" onClick={() => { void ctx?.login('a@example.test', 'geheim'); }}>login</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function advance(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

const CACHED_USER = { id: 'user-a', email: 'a@example.test', name: 'A', globalRole: 'user' };

const NETWORK_ERROR = { data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) };

describe('AuthProvider – SIGNED_IN aus dem Speicher ist keine Serverantwort (N2)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.local.clear();
    store.session.clear();
    net.respond = null;
    cache.user = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it('@AN-020 Netz hängt, Tab kommt zurück (SIGNED_IN aus dem Speicher): Zustand bleibt nicht „verbunden“, Wiederverbindung läuft weiter', async () => {
    cache.user = CACHED_USER;
    store.local.setItem(TOKEN_KEY, sessionRaw());
    if (!supabase) { throw new Error('Test-Client fehlt'); }
    const subscribeSpy = vi.spyOn(supabase.auth, 'onAuthStateChange');
    const getSession = vi.spyOn(supabase.auth, 'getSession').mockResolvedValue(NETWORK_ERROR);

    renderProvider();
    await advance(1_000);
    expect(screen.getByTestId('conn').textContent).toBe('offline');
    expect(screen.getByTestId('probe').textContent).toBe('user');

    const callback = subscribeSpy.mock.calls[0]?.[0] as (event: string, session: unknown) => void;
    const callsBefore = getSession.mock.calls.length;
    act(() => { callback('SIGNED_IN', JSON.parse(sessionRaw()) as Record<string, unknown>); });
    await advanceInSteps(120_000);

    expect(screen.getByTestId('conn').textContent).not.toBe('connected');
    // Takt alle 30 s: mindestens drei weitere Versuche in 120 s (ein Aufruf stammt vom Profil-Abruf).
    expect(getSession.mock.calls.length - callsBefore).toBeGreaterThanOrEqual(3);
    expect(screen.getByTestId('probe').textContent).toBe('user');
  });

  it('@AN-019 Server antwortet langsam, SIGNED_IN aus dem Speicher: Hinweis „Server antwortet langsam“ bleibt', async () => {
    cache.user = CACHED_USER;
    store.local.setItem(TOKEN_KEY, sessionRaw());
    if (!supabase) { throw new Error('Test-Client fehlt'); }
    const subscribeSpy = vi.spyOn(supabase.auth, 'onAuthStateChange');
    vi.spyOn(supabase.auth, 'getSession').mockReturnValue(new Promise(() => undefined));

    renderProvider();
    await advance(6_000);
    expect(screen.getByTestId('server-slow')).toBeTruthy();

    const callback = subscribeSpy.mock.calls[0]?.[0] as (event: string, session: unknown) => void;
    net.respond = async (url) => (url.includes('/rest/v1/profiles') ? new Promise<Response>(() => undefined) : new Response(null, { status: 204 }));
    act(() => { callback('SIGNED_IN', JSON.parse(sessionRaw()) as Record<string, unknown>); });
    await advance(1_000);

    expect(screen.getByTestId('server-slow')).toBeTruthy();
    expect(screen.getByTestId('conn').textContent).not.toBe('connected');
  });

  it('Gegenbeispiel: echte Anmeldung während „Server antwortet langsam“ → verbunden, Hinweis endet', async () => {
    if (!supabase) { throw new Error('Test-Client fehlt'); }
    const raw = JSON.parse(sessionRaw()) as { user: typeof USER };
    // Der Start hängt (erste Abfrage ohne Antwort); danach antwortet der Server (Anmeldung, Profil).
    vi.spyOn(supabase.auth, 'getSession')
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValue({ data: { session: raw }, error: null } as unknown as Awaited<ReturnType<NonNullable<typeof supabase>['auth']['getSession']>>);
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { user: raw.user, session: raw },
      error: null,
    } as unknown as Awaited<ReturnType<NonNullable<typeof supabase>['auth']['signInWithPassword']>>);
    net.respond = async (url) => (url.includes('/rest/v1/profiles') ? json({ display_name: 'A', avatar_url: null, role: 'user' }) : new Response(null, { status: 204 }));

    renderProvider();
    await advance(6_000);
    expect(screen.getByTestId('server-slow')).toBeTruthy();

    fireEvent.click(screen.getByTestId('do-login'));
    await advance(1_000);

    expect(screen.getByTestId('conn').textContent).toBe('connected');
    expect(screen.queryByTestId('server-slow')).toBeNull();
  });
});
