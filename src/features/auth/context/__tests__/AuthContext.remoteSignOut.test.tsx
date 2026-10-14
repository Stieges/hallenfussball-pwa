/**
 * A-07d2 (@AN-024) am AuthProvider: Prüfung bei visibilitychange, Netzfehler ohne Abmelden,
 * und der Race zwischen einem älteren TOKEN_REFRESHED und einem SIGNED_OUT (Fake-Timer).
 */

import { useContext } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, cleanup } from '@testing-library/react';

const net = vi.hoisted(() => ({
  calls: [] as Array<{ url: string; method: string }>,
  respond: null as null | ((url: string, init?: RequestInit) => Promise<Response>),
}));

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
  restoreUserFromCache: vi.fn(async () => null),
}));

vi.mock('../../../../lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const fakeFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    net.calls.push({ url, method: init?.method ?? 'GET' });
    return net.respond ? net.respond(url, init) : Promise.resolve(new Response(null, { status: 204 }));
  };
  const client = createClient('http://localhost:54321', 'anon-key', {
    auth: { storage: store.local, autoRefreshToken: false, persistSession: true },
    global: { fetch: fakeFetch },
  });
  return { supabase: client, isSupabaseConfigured: true, supabaseProjectUrl: 'http://localhost:54321' };
});

import { supabase } from '../../../../lib/supabase';
import { captureFeatureError } from '../../../../lib/sentry';
import { AuthProvider } from '../AuthContext';
import { AuthContext } from '../authContextInstance';

const TOKEN_KEY = 'sb-localhost-auth-token';
const QUEUE_KEY = 'mutation_queue_v1:user-a';
const QUEUE_VALUE = JSON.stringify([{ id: 'e1' }]);

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

const USER = { id: 'user-a', aud: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

function sessionFixture(): { raw: string; access: string } {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'user-a', role: 'authenticated', exp })}.signature`;
  const raw = JSON.stringify({ access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-a', user: USER });
  return { raw, access };
}

/** Wie GoTrue: JSON-Antworten tragen `X-Supabase-Api-Version` (M1). Ohne ihn liest auth-js `code` nicht. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
  });
}

function Probe() {
  const ctx = useContext(AuthContext);
  return <div data-testid="probe">{ctx?.user ? 'user' : 'none'}</div>;
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

describe('AuthProvider – Prüfung der Sitzung durch ein anderes Gerät (A-07d2)', () => {
  beforeEach(() => {
    store.local.clear();
    store.session.clear();
    net.calls.length = 0;
    net.respond = null;
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it('Pflicht: nach visibilitychange (Server: session_not_found) ist der Nutzer abgemeldet, Hinweis gesetzt, Ausgang unverändert', async () => {
    const { raw } = sessionFixture();
    store.local.setItem(TOKEN_KEY, raw);
    store.local.setItem(QUEUE_KEY, QUEUE_VALUE);
    net.respond = async (url) => {
      if (url.includes('/rest/v1/profiles')) {return json({ display_name: 'A', avatar_url: null, role: 'user' });}
      if (url.includes('/auth/v1/user')) {return json(USER);}
      return new Response(null, { status: 204 });
    };

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('user'));

    // Anderes Gerät hat „alle anderen“ abgemeldet: der Server kennt die Sitzung nicht mehr.
    net.respond = async (url) => {
      if (url.includes('/auth/v1/user')) {return json({ code: 'session_not_found', message: 'gone' }, 403);}
      return new Response(null, { status: 204 });
    };
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('none'));
    await waitFor(() => expect(store.session.getItem('auth:signedOutElsewhere')).toBe('1'));
    expect(store.local.getItem(TOKEN_KEY)).toBeNull();
    expect(store.local.getItem(QUEUE_KEY)).toBe(QUEUE_VALUE);
    expect(net.calls.filter((c) => c.url.includes('/auth/v1/logout'))).toHaveLength(0);
  });

  it.each([
    ['Netzfehler', async () => { throw new TypeError('Failed to fetch'); }],
    ['503', async () => json({ message: 'down' }, 503)],
  ])('Gegenbeispiel: getUser mit %s → bleibt angemeldet, kein Hinweis', async (_label, failure) => {
    const { raw } = sessionFixture();
    store.local.setItem(TOKEN_KEY, raw);
    net.respond = async (url) => {
      if (url.includes('/rest/v1/profiles')) {return json({ display_name: 'A', avatar_url: null, role: 'user' });}
      if (url.includes('/auth/v1/user')) {return json(USER);}
      return new Response(null, { status: 204 });
    };

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('user'));

    net.respond = async (url) => (url.includes('/auth/v1/user') ? failure() : new Response(null, { status: 204 }));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(net.calls.some((c) => c.url.includes('/auth/v1/user'))).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });

    expect(screen.getByTestId('probe').textContent).toBe('user');
    expect(store.local.getItem(TOKEN_KEY)).not.toBeNull();
    expect(store.session.getItem('auth:signedOutElsewhere')).toBeNull();
  });
});

describe('AuthProvider – Race: SIGNED_OUT während eines älteren TOKEN_REFRESHED (A-07d2, Fake-Timer)', () => {
  beforeEach(() => {
    store.local.clear();
    store.session.clear();
    net.calls.length = 0;
    net.respond = null;
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it('Endzustand abgemeldet, kein Hänger, auch wenn das Profil des älteren Ereignisses erst später kommt', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // Sitzung liegt im Speicher, damit die Prüfung den Server fragt (nicht ohne Sitzung kurzschließt).
    store.local.setItem(TOKEN_KEY, sessionFixture().raw);
    if (!supabase) {throw new Error('Test-Client fehlt');}
    const subscribeSpy = vi.spyOn(supabase.auth, 'onAuthStateChange');

    net.respond = async (url) => {
      if (url.includes('/rest/v1/profiles')) {return json({ display_name: 'A', avatar_url: null, role: 'user' });}
      return new Response(null, { status: 204 });
    };
    renderProvider();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const callback = subscribeSpy.mock.calls[0]?.[0] as (event: string, session: unknown) => void;
    expect(callback).toBeTypeOf('function');

    // Profil des älteren Ereignisses hängt, bis der Test es freigibt.
    const gate: { release: (() => void) | null } = { release: null };
    net.respond = async (url) => {
      if (url.includes('/rest/v1/profiles')) {
        await new Promise<void>((resolve) => { gate.release = resolve; });
        return json({ display_name: 'A', avatar_url: null, role: 'user' });
      }
      if (url.includes('/auth/v1/user')) {return json(USER);}
      return new Response(null, { status: 204 });
    };
    const session = { access_token: sessionFixture().access, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: USER };

    // Älteres Ereignis startet, SIGNED_OUT kommt, während dessen Profil noch lädt.
    // Der Callback gibt nichts zurück (synchron): auth-js wartet nicht auf die Arbeit darin.
    let returned: unknown = 'x';
    act(() => { returned = callback('TOKEN_REFRESHED', session); });
    expect(returned).toBeUndefined();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => { callback('SIGNED_OUT', null); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.getByTestId('probe').textContent).toBe('none');
    expect(store.session.getItem('auth:signedOutElsewhere')).toBe('1');

    // Das alte Profil kommt jetzt: es darf den Endzustand nicht zurückholen.
    gate.release?.();
    for (let step = 0; step < 100; step++) {
      await act(async () => {
        await new Promise((resolve) => setImmediate(resolve));
        await vi.advanceTimersByTimeAsync(0);
      });
    }

    expect(screen.getByTestId('probe').textContent).toBe('none');
  });
});

describe('AuthProvider – Zeitgrenze und Fehlerfang (A-07d2, M3 und N2)', () => {
  beforeEach(() => {
    store.local.clear();
    store.session.clear();
    net.calls.length = 0;
    net.respond = null;
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    cleanup();
  });

  it('M3: hängende Prüfung blockiert nicht – nach der Zeitgrenze läuft die nächste Prüfung wieder', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.local.setItem(TOKEN_KEY, sessionFixture().raw);
    let userCalls = 0;
    net.respond = async (url) => {
      if (url.includes('/rest/v1/profiles')) {return json({ display_name: 'A', avatar_url: null, role: 'user' });}
      if (url.includes('/auth/v1/user')) {
        userCalls++;
        // Erste Prüfung hängt (z. B. langsamer Start), die zweite antwortet.
        return userCalls === 1 ? new Promise<Response>(() => undefined) : json(USER);
      }
      return new Response(null, { status: 204 });
    };

    renderProvider();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(userCalls).toBe(1);

    // Zeitgrenze der Prüfung (8 s) abwarten, dann sichtbar werden.
    await act(async () => { await vi.advanceTimersByTimeAsync(8_500); });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });

    expect(userCalls).toBe(2);
    expect(store.local.getItem(TOKEN_KEY)).not.toBeNull();
  });

  it('N2: Fehler im onAuthStateChange-Zweig wird gemeldet, kein unbehandeltes Promise', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    if (!supabase) {throw new Error('Test-Client fehlt');}
    const subscribeSpy = vi.spyOn(supabase.auth, 'onAuthStateChange');
    net.respond = async () => new Response(null, { status: 204 });
    renderProvider();
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const callback = subscribeSpy.mock.calls[0]?.[0] as (event: string, session: unknown) => void;

    // Ab jetzt wirft das Lesen des Gast-Schlüssels: updateAuthState lehnt ab.
    const realGetItem = store.local.getItem.bind(store.local);
    vi.spyOn(store.local, 'getItem').mockImplementation((key: string) => {
      if (key === 'auth:guestUser') {throw new Error('Speicher nicht lesbar');}
      return realGetItem(key);
    });
    act(() => { callback('SIGNED_OUT', null); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(captureFeatureError).toHaveBeenCalledWith(expect.any(Error), 'auth', 'onAuthStateChange');
  });
});

