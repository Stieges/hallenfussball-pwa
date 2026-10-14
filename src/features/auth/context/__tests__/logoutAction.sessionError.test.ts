/**
 * Abmelden auf anderen Geräten (A-07d1, R-1 aus dem Re-Review): Fehler von getSession() bei abgelaufener,
 * serverseitig beendeter Sitzung. Eigene Datei, weil ein hängender Refresh aus einem Nachbartest des
 * geteilten Supabase-Clients sonst als Netzfehler durchschlägt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockAuthActionDeps } from './mocks/supabaseMock';
import { safeLocalStorage } from '../../../../core/utils/safeStorage';

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

/** Eigenes Refresh-Token je Test: auth-js cached Refresh-Fehler pro Token im geteilten Client. */
function sessionFixture(expiresAtSeconds: number, refreshToken = 'refresh-a'): string {
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
    refresh_token: refreshToken,
    user: { id: 'user-a', aud: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  });
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('logout (A-07d1 R-1) – Sitzung beim Abmelden auf anderen Geräten', () => {
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

  it('R-1: Refresh scheitert mit 400 refresh_token_not_found → reason session, kein Server-Aufruf', async () => {
    // Sitzung abgelaufen und serverseitig beendet (z. B. anderes Gerät hat abgemeldet): getSession() liefert 400.
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() - 600));
    net.respond = async (url) => {
      if (url.includes('grant_type=refresh_token')) {
        return new Response(
          JSON.stringify({ error: 'invalid_grant', error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(null, { status: 204 });
    };
    const deps = createMockAuthActionDeps();

    const result = await logout(deps, { scope: 'others' });

    expect(result).toEqual({ ok: false, reason: 'session' });
    expect(net.calls.filter((c) => c.url.includes('/auth/v1/logout'))).toHaveLength(0);
    expect(deps.setUser).not.toHaveBeenCalled();
  });

  // N3: Positivliste. Nur Sitzung-weg-Codes sind `session`; Netz ist `network`; alles andere ist `server`.
  it.each(['refresh_token_already_used', 'session_expired'])('N3: Refresh mit Code %s → reason session', async (code) => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() - 600, `refresh-code-${code}`));
    net.respond = async (url) => (url.includes('grant_type=refresh_token')
      ? new Response(JSON.stringify({ code, message: 'gone' }), { status: 400, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } })
      : new Response(null, { status: 204 }));

    expect(await logout(createMockAuthActionDeps(), { scope: 'others' })).toEqual({ ok: false, reason: 'session' });
  });

  it('N3: Refresh-Antwort ist keine JSON-Seite (Proxy, AuthUnknownError) → reason server, nicht session', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() - 600, 'refresh-html'));
    net.respond = async (url) => (url.includes('grant_type=refresh_token')
      ? new Response('<html><body>Anmeldeportal</body></html>', { status: 404, headers: { 'Content-Type': 'text/html' } })
      : new Response(null, { status: 204 }));

    expect(await logout(createMockAuthActionDeps(), { scope: 'others' })).toEqual({ ok: false, reason: 'server' });
    expect(net.calls.filter((c) => c.url.includes('/auth/v1/logout'))).toHaveLength(0);
  });

  it('N3: Netz weg beim Refresh (fetch wirft, status 0) → reason network', async () => {
    // auth-js wiederholt Netzfehler beim Refresh mit Backoff: Fake-Timer, damit der Test nicht wartet.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      safeLocalStorage.setItem(TOKEN_KEY, sessionFixture(nowSeconds() - 600, 'refresh-network'));
      net.respond = async (url) => {
        if (url.includes('grant_type=refresh_token')) {
          throw new TypeError('Failed to fetch');
        }
        return new Response(null, { status: 204 });
      };

      const pending = logout(createMockAuthActionDeps(), { scope: 'others' });
      await vi.advanceTimersByTimeAsync(120_000);

      expect(await pending).toEqual({ ok: false, reason: 'network' });
    } finally {
      vi.useRealTimers();
    }
  });
});
