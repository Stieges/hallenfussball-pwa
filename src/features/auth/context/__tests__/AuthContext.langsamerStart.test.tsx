/**
 * C-SITZUNG-STILL (Anmelden Ü1.2): Ein langsamer Server beim Öffnen der App meldet niemanden ab
 * (@AN-019), heißt „Server antwortet langsam“ und nicht „offline“ (@AN-032); eine wirklich
 * abgelaufene Anmeldung kommt mit klarer Meldung (Ü1.2 „Nie still abmelden“, Wortlaut @AN-021).
 * i18n ist im Test ein Durchreicher: Schlüssel statt Text.
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

import { supabase } from '../../../../lib/supabase';
import { AuthProvider } from '../AuthContext';
import { AuthContext } from '../authContextInstance';

const TOKEN_KEY = 'sb-localhost-auth-token';
const SLOW_MS = 30_000;

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

const PROFILE = { display_name: 'A', avatar_url: null, role: 'user' };

/** Antwortet erst nach `ms` (Fake-Timer) – der „langsame Server“. */
function after(ms: number, make: () => Response): Promise<Response> {
  return new Promise((resolve) => { setTimeout(() => resolve(make()), ms); });
}

function Probe() {
  const ctx = useContext(AuthContext);
  return (
    <div>
      <div data-testid="probe">{ctx?.user ? 'user' : 'none'}</div>
      <button data-testid="do-logout" onClick={() => { void ctx?.logout(); }}>logout</button>
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
const SLOW_KEY = 'auth:notices.serverSlow';
const EXPIRED_KEY = 'auth:errors.sessionExpired';

describe('AuthProvider – langsamer Start (@AN-019, @AN-032)', () => {
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

  it('@AN-019 fehlende Nutzerkopie: 30 s ohne Antwort löschen die gespeicherte Anmeldung nicht', async () => {
    store.local.setItem(TOKEN_KEY, sessionRaw());
    net.respond = async (url) => (url.includes('/rest/v1/profiles') ? after(SLOW_MS, () => json(PROFILE)) : new Response(null, { status: 204 }));

    renderProvider();
    await advance(20_000); // über der 15-s-Zeitgrenze des Starts

    expect(store.local.getItem(TOKEN_KEY)).not.toBeNull();
  });

  it('@AN-019 fehlende Nutzerkopie: nach der späten Antwort ist der Nutzer angemeldet, ohne Eingabe', async () => {
    store.local.setItem(TOKEN_KEY, sessionRaw());
    net.respond = async (url) => (url.includes('/rest/v1/profiles') ? after(SLOW_MS, () => json(PROFILE)) : new Response(null, { status: 204 }));

    renderProvider();
    await advance(SLOW_MS + 1_000);

    expect(screen.getByTestId('probe').textContent).toBe('user');
    expect(store.local.getItem(TOKEN_KEY)).not.toBeNull();
  });

  it('@AN-019 gespeicherte Nutzerkopie: bleibt angemeldet mit Stand auf dem Gerät, Sitzung bleibt', async () => {
    cache.user = CACHED_USER;
    store.local.setItem(TOKEN_KEY, sessionRaw());
    net.respond = async (url) => (url.includes('/rest/v1/profiles') ? after(SLOW_MS, () => json(PROFILE)) : new Response(null, { status: 204 }));

    renderProvider();
    await advance(20_000);

    expect(screen.getByTestId('probe').textContent).toBe('user');
    expect(store.local.getItem(TOKEN_KEY)).not.toBeNull();
  });

  it('@AN-019 gespeicherte Nutzerkopie: der Nutzer gilt schon mit dem Hinweis (nach 5 s) als angemeldet, nicht erst nach 15 s', async () => {
    cache.user = CACHED_USER;
    store.local.setItem(TOKEN_KEY, sessionRaw());
    net.respond = async (url) => (url.includes('/rest/v1/profiles') ? after(SLOW_MS, () => json(PROFILE)) : new Response(null, { status: 204 }));

    renderProvider();
    await advance(6_000);

    expect(screen.getByTestId('server-slow')).toBeTruthy();
    expect(screen.getByTestId('probe').textContent).toBe('user');
  });

  it('@AN-019 @AN-032 Hinweis „Server antwortet langsam“ erst nach 5 s, nicht als „offline“', async () => {
    cache.user = CACHED_USER;
    store.local.setItem(TOKEN_KEY, sessionRaw());
    net.respond = async (url) => (url.includes('/rest/v1/profiles') ? after(SLOW_MS, () => json(PROFILE)) : new Response(null, { status: 204 }));

    renderProvider();
    await advance(4_000);
    expect(screen.queryByTestId('server-slow')).toBeNull();

    await advance(2_000);
    const hint = screen.getByTestId('server-slow');
    expect(hint.getAttribute('role')).toBe('status');
    expect(hint.textContent).toContain(SLOW_KEY);
    expect(hint.textContent).not.toMatch(/offline|noConnection/i);
  });

  it('@AN-019 der Hinweis verschwindet von selbst, sobald der Server antwortet', async () => {
    store.local.setItem(TOKEN_KEY, sessionRaw());
    net.respond = async (url) => (url.includes('/rest/v1/profiles') ? after(SLOW_MS, () => json(PROFILE)) : new Response(null, { status: 204 }));

    renderProvider();
    await advance(10_000);
    expect(screen.getByTestId('server-slow')).toBeTruthy();

    await advance(SLOW_MS);
    expect(screen.queryByTestId('server-slow')).toBeNull();
  });

  it('Gegenbeispiel: schnelle Antwort zeigt nie einen Hinweis', async () => {
    store.local.setItem(TOKEN_KEY, sessionRaw());
    net.respond = async (url) => (url.includes('/rest/v1/profiles') ? json(PROFILE) : new Response(null, { status: 204 }));

    renderProvider();
    await advance(10_000);

    expect(screen.getByTestId('probe').textContent).toBe('user');
    expect(screen.queryByTestId('server-slow')).toBeNull();
  });
});

describe('AuthProvider – abgelaufene Anmeldung und Gegenbeispiele (Ü1.2 „Nie still abmelden“)', () => {
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

  it('@AN-021 Server sagt „Erneuerungsschlüssel ungültig“: Meldung „Sitzung abgelaufen“, nicht still und nicht „anderes Gerät“', async () => {
    store.local.setItem(TOKEN_KEY, sessionRaw(true));
    net.respond = async (url) => (url.includes('/auth/v1/token')
      ? json({ code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' }, 400)
      : new Response(null, { status: 204 }));

    renderProvider();
    await advance(2_000);

    expect(screen.getByTestId('probe').textContent).toBe('none');
    const notice = screen.getByTestId('session-expired');
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.textContent).toContain(EXPIRED_KEY);
    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
  });

  it('@AN-021 Anmeldung geht beim Start verloren (SIGNED_OUT während der Erneuerung): „Sitzung abgelaufen“, nicht „anderes Gerät“', async () => {
    // Wie im Browser: der Client erneuert beim Laden selbst und meldet ein Abmelden, bevor getSession antwortet.
    store.local.setItem(TOKEN_KEY, sessionRaw(true));
    net.respond = async (url) => (url.includes('/auth/v1/token') ? new Promise<Response>(() => undefined) : new Response(null, { status: 204 }));
    if (!supabase) { throw new Error('Test-Client fehlt'); }
    const subscribeSpy = vi.spyOn(supabase.auth, 'onAuthStateChange');

    renderProvider();
    await advance(10);
    const callback = subscribeSpy.mock.calls[0]?.[0] as (event: string, session: unknown) => void;
    act(() => { callback('SIGNED_OUT', null); });
    await advance(10);

    expect(screen.getByTestId('session-expired').textContent).toContain(EXPIRED_KEY);
    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
  });

  it('Gegenbeispiel: Abmelden durch den Nutzer bleibt Abmelden – keine Ablauf-Meldung, kein Hinweis „anderes Gerät“', async () => {
    store.local.setItem(TOKEN_KEY, sessionRaw());
    net.respond = async (url) => {
      if (url.includes('/rest/v1/profiles')) { return json(PROFILE); }
      if (url.includes('/auth/v1/user')) { return json(USER); }
      return new Response(null, { status: 204 });
    };

    renderProvider();
    await advance(1_000);
    expect(screen.getByTestId('probe').textContent).toBe('user');

    fireEvent.click(screen.getByTestId('do-logout'));
    await advance(1_000);

    expect(screen.getByTestId('probe').textContent).toBe('none');
    expect(screen.queryByTestId('session-expired')).toBeNull();
    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
    expect(screen.queryByTestId('server-slow')).toBeNull();
  });

  it('Gegenbeispiel: Offline ohne Antwort ist kein Ablauf – Anmeldung bleibt, keine Ablauf-Meldung', async () => {
    cache.user = CACHED_USER;
    store.local.setItem(TOKEN_KEY, sessionRaw(true));
    net.respond = async () => { throw new TypeError('Failed to fetch'); };

    renderProvider();
    await advance(20_000);

    expect(screen.getByTestId('probe').textContent).toBe('user');
    expect(store.local.getItem(TOKEN_KEY)).not.toBeNull();
    expect(screen.queryByTestId('session-expired')).toBeNull();
    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
  });
});
