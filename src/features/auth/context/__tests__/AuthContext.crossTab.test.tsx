/**
 * Abgleich zwischen Fenstern (useCrossTabAuthSync, Nachkontrolle #279 MR4), Anmelden Ü1.2 „Mehrere Fenster“
 * (Ableitung): Abmelden in einem Fenster gilt im anderen. Ein fremder Speicher-Schlüssel ändert nichts.
 * Eigene Datei: der Client ist ein Singleton.
 */

import { useContext } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';
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

import { supabase } from '../../../../lib/supabase';
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


const PROFILE = { display_name: 'A', avatar_url: null, role: 'user' };

async function renderSignedIn(): Promise<ReturnType<typeof vi.spyOn>> {
  store.local.setItem(TOKEN_KEY, sessionRaw());
  net.respond = async (url) => (url.includes('/rest/v1/profiles') ? json(PROFILE) : new Response(null, { status: 204 }));
  if (!supabase) { throw new Error('Test-Client fehlt'); }
  const getSession = vi.spyOn(supabase.auth, 'getSession');
  renderProvider();
  await advance(1_000);
  expect(screen.getByTestId('probe').textContent).toBe('user');
  return getSession;
}

describe('AuthProvider – Abgleich zwischen Fenstern (useCrossTabAuthSync)', () => {
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

  it('Abmelden in einem anderen Fenster: dieses Fenster ist danach abgemeldet', async () => {
    await renderSignedIn();

    // Das andere Fenster meldet sich selbst ab: Schlüssel weg, Merker „eigenes Abmelden“ gesetzt.
    store.local.setItem('auth:ownSignOut', '1');
    store.local.removeItem(TOKEN_KEY);
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY, oldValue: 'x', newValue: null })); });
    await advance(1_000);

    expect(screen.getByTestId('probe').textContent).toBe('none');
    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
  });

  it('Gegenbeispiel: fremder Speicher-Schlüssel ändert nichts – angemeldet, keine Abfrage', async () => {
    const getSession = await renderSignedIn();
    const callsBefore = getSession.mock.calls.length;

    store.local.removeItem(TOKEN_KEY); // würde bei einer Abfrage „abgemeldet“ ergeben
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'app:theme', oldValue: 'dark', newValue: 'light' })); });
    await advance(1_000);

    expect(screen.getByTestId('probe').textContent).toBe('user');
    expect(getSession.mock.calls.length).toBe(callsBefore);
  });
});
