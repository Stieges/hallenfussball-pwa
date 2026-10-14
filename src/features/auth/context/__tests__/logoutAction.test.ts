/**
 * Abmelden (A-07a) – @AN-023 „Abmelden am Handy, Tablet bleibt“, @FU-006 „Ausgang bleibt beim Abmelden“.
 *
 * Echter supabase-js-Client mit Map-Speicher und Fake-fetch. Gegen den echten Client
 * wird geprüft, was beim Abmelden tatsächlich am Netz und im Speicher passiert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockAuthActionDeps } from './mocks/supabaseMock';
import { safeLocalStorage } from '../../../../core/utils/safeStorage';
import { supabase } from '../../../../lib/supabase';

const net = vi.hoisted(() => ({
  calls: [] as Array<{ url: string; method: string }>,
  // null = Standard-Antwort 204 ohne Body (Logout erfolgreich)
  respond: null as null | ((url: string, init?: RequestInit) => Promise<Response>),
  configured: true,
}));

vi.mock('../../../../lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  // Wie in der Produktion (src/lib/supabase.ts): Sitzung liegt im safeLocalStorage.
  const { safeLocalStorage } = await import('../../../../core/utils/safeStorage');
  const fakeFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    net.calls.push({ url, method: init?.method ?? 'GET' });
    return net.respond ? net.respond(url, init) : Promise.resolve(new Response(null, { status: 204 }));
  };
  const client = createClient('http://localhost:54321', 'anon-key', {
    auth: { storage: safeLocalStorage, autoRefreshToken: false, persistSession: true },
    global: { fetch: fakeFetch },
  });
  return {
    supabase: client,
    get isSupabaseConfigured() {
      return net.configured;
    },
  };
});

import { logout } from '../logoutAction';

const TOKEN_KEY = 'sb-localhost-auth-token';
const QUEUE_KEY = 'mutation_queue_v1';
const QUEUE_VALUE = JSON.stringify([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }]);
const FAILED_KEY = 'mutation_queue_failed_v1';
const FAILED_VALUE = JSON.stringify([{ id: 'f1' }]);

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionFixture(expiresAtSeconds: number): string {
  const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub: 'user-a',
    role: 'authenticated',
    exp: expiresAtSeconds,
  })}.signature`;
  return JSON.stringify({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAtSeconds,
    refresh_token: 'refresh-a',
    user: { id: 'user-a', aud: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  });
}

function hasSupabaseToken(): boolean {
  for (let i = 0; i < safeLocalStorage.length; i++) {
    const key = safeLocalStorage.key(i);
    if (key && /^sb-.*-auth-token$/.test(key)) {
      return true;
    }
  }
  return false;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('logout (A-07a) – nur dieses Gerät, Ausgang bleibt', () => {
  beforeEach(() => {
    net.calls.length = 0;
    safeLocalStorage.clear();
    safeLocalStorage.setItem(QUEUE_KEY, QUEUE_VALUE);
    safeLocalStorage.setItem(FAILED_KEY, FAILED_VALUE);
    net.respond = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Pflicht: Abmelden schickt genau POST …/logout?scope=local, Ausgang bleibt, Gerät ist abgemeldet', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() + 3600));
    const deps = createMockAuthActionDeps();

    await logout(deps);

    const logoutCalls = net.calls.filter((c) => c.url.includes('/auth/v1/logout'));
    expect(logoutCalls).toHaveLength(1);
    expect(logoutCalls[0].method).toBe('POST');
    expect(logoutCalls[0].url).toContain('scope=local');
    expect(hasSupabaseToken()).toBe(false);
    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(QUEUE_VALUE);
    expect(safeLocalStorage.getItem(FAILED_KEY)).toBe(FAILED_VALUE);
    expect(deps.setUser).toHaveBeenCalledWith(null);
  });

  it('Gegenbeispiel: offline + Zugang abgelaufen → Token trotzdem weg, setUser(null), kein throw', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() - 600));
    net.respond = async () => {
      throw new TypeError('Failed to fetch');
    };
    const deps = createMockAuthActionDeps();

    // auth-js wiederholt den Refresh mit Backoff (200, 400, 800 … ms, setTimeout). Fake-Timer spulen ~25 s vor.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let settled = false;
    const pending = logout(deps).finally(() => {
      settled = true;
    });
    // Timer werden erst nach und nach angelegt; so lange in Schritten vorspulen, bis logout fertig ist.
    for (let step = 0; step < 100 && !settled; step++) {
      await vi.advanceTimersByTimeAsync(1_000);
    }
    await expect(pending).resolves.toEqual({ ok: true });
    vi.useRealTimers();

    expect(hasSupabaseToken()).toBe(false);
    expect(deps.setUser).toHaveBeenCalledWith(null);
  });
});

/**
 * A-07d1 – „Auf allen anderen Geräten abmelden“ (@AN-024 „Der Laptop bleibt angemeldet“).
 * Scope `others`: nur der Server-Aufruf, kein lokales Aufräumen, kein SIGNED_OUT am eigenen Gerät.
 */
describe('logout (A-07d1) – auf allen anderen Geräten abmelden', () => {
  beforeEach(() => {
    net.calls.length = 0;
    safeLocalStorage.clear();
    safeLocalStorage.setItem(QUEUE_KEY, QUEUE_VALUE);
    safeLocalStorage.setItem(FAILED_KEY, FAILED_VALUE);
    net.respond = null;
    net.configured = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Pflicht: scope others schickt genau POST …/logout?scope=others, Token bleibt, kein Abmelden hier', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() + 3600));
    const deps = createMockAuthActionDeps();
    const events: string[] = [];
    if (!supabase) {
      throw new Error('Test-Client fehlt');
    }
    const { data } = supabase.auth.onAuthStateChange((event) => {
      events.push(event);
    });

    const result = await logout(deps, { scope: 'others' });
    data.subscription.unsubscribe();

    const logoutCalls = net.calls.filter((c) => c.url.includes('/auth/v1/logout'));
    expect(logoutCalls).toHaveLength(1);
    expect(logoutCalls[0].method).toBe('POST');
    expect(logoutCalls[0].url).toContain('scope=others');
    expect(hasSupabaseToken()).toBe(true);
    expect(deps.setUser).not.toHaveBeenCalled();
    expect(events).not.toContain('SIGNED_OUT');
    expect(safeLocalStorage.getItem(QUEUE_KEY)).toBe(QUEUE_VALUE);
    expect(result).toEqual({ ok: true });
  });

  it.each([500, 503])('Gegenbeispiel: Server antwortet %i → reason server, Sitzung bleibt', async (status) => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() + 3600));
    net.respond = async () =>
      new Response(JSON.stringify({ message: 'boom' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const deps = createMockAuthActionDeps();

    const result = await logout(deps, { scope: 'others' });

    expect(result).toEqual({ ok: false, reason: 'server' });
    expect(hasSupabaseToken()).toBe(true);
    expect(deps.setUser).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])('Gegenbeispiel: Server antwortet %i (Sitzung serverseitig weg) → reason session, kein Erfolg', async (status) => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() + 3600));
    net.respond = async () =>
      new Response(JSON.stringify({ code: 'session_not_found', message: 'gone' }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    const deps = createMockAuthActionDeps();

    const result = await logout(deps, { scope: 'others' });

    expect(result).toEqual({ ok: false, reason: 'session' });
    expect(net.calls.filter((c) => c.url.includes('/auth/v1/logout'))).toHaveLength(1);
    expect(deps.setUser).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: keine Sitzung → reason session, kein Server-Aufruf (kein falscher Erfolg)', async () => {
    const deps = createMockAuthActionDeps();

    const result = await logout(deps, { scope: 'others' });

    expect(result).toEqual({ ok: false, reason: 'session' });
    expect(net.calls.filter((c) => c.url.includes('/auth/v1/logout'))).toHaveLength(0);
    expect(deps.setUser).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Aufruf wirft unerwartet (catch-Zweig) → { ok: false, reason: server }, Sitzung bleibt', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() + 3600));
    if (!supabase) {
      throw new Error('Test-Client fehlt');
    }
    vi.spyOn(supabase.auth.admin, 'signOut').mockRejectedValue(new Error('unerwartet'));
    const deps = createMockAuthActionDeps();

    const result = await logout(deps, { scope: 'others' });

    expect(result).toEqual({ ok: false, reason: 'server' });
    expect(hasSupabaseToken()).toBe(true);
    expect(deps.setUser).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Supabase nicht konfiguriert → reason unavailable, nichts wird angefasst', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() + 3600));
    net.configured = false;
    const deps = createMockAuthActionDeps();

    const result = await logout(deps, { scope: 'others' });

    expect(result).toEqual({ ok: false, reason: 'unavailable' });
    expect(net.calls).toHaveLength(0);
    expect(hasSupabaseToken()).toBe(true);
    expect(deps.setUser).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Netz weg (fetch wirft) → { ok: false, reason: network }, Sitzung bleibt', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() + 3600));
    net.respond = async () => {
      throw new TypeError('Failed to fetch');
    };
    const deps = createMockAuthActionDeps();

    const result = await logout(deps, { scope: 'others' });

    expect(result).toEqual({ ok: false, reason: 'network' });
    expect(hasSupabaseToken()).toBe(true);
    expect(deps.setUser).not.toHaveBeenCalled();
  });
});
