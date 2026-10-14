/**
 * Abmeldung durch ein anderes Gerät (A-07d2, @AN-024) – Prüfung und Merker.
 * Echter supabase-js-Client mit Map-Speicher und Fake-fetch (wie logoutAction.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeLocalStorage, safeSessionStorage } from '../../../../core/utils/safeStorage';
import { supabase } from '../../../../lib/supabase';
import { applyAuthEventEffects } from '../authEventEffects';
import { hasSignedOutElsewhere, verifySessionOnServer, isSessionRejectedByServer } from '../remoteSignOut';
import { logout } from '../logoutAction';
import { createMockAuthActionDeps } from './mocks/supabaseMock';

const net = vi.hoisted(() => ({
  calls: [] as Array<{ url: string; method: string }>,
  respond: null as null | ((url: string, init?: RequestInit) => Promise<Response>),
}));

vi.mock('../../../../lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
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
  return { supabase: client, isSupabaseConfigured: true };
});

const TOKEN_KEY = 'sb-localhost-auth-token';

function b64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionFixture(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'user-a', role: 'authenticated', exp })}.signature`;
  return JSON.stringify({
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    refresh_token: 'refresh-a',
    user: { id: 'user-a', aud: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('verifySessionOnServer (A-07d2) – Antwort des Servers zur Sitzung', () => {
  beforeEach(() => {
    net.calls.length = 0;
    safeLocalStorage.clear();
    safeSessionStorage.clear();
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture());
    net.respond = null;
  });

  it('Gegenbeispiel: 200 → valid, nichts passiert', async () => {
    net.respond = async () => jsonResponse({ id: 'user-a', aud: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }, 200);
    if (!supabase) {throw new Error('Test-Client fehlt');}

    expect(await verifySessionOnServer(supabase)).toBe('valid');
    expect(net.calls.some((c) => c.url.includes('/auth/v1/user'))).toBe(true);
  });

  it.each([401, 403])('Pflicht: Server antwortet %i (Sitzung serverseitig weg) → rejected', async (status) => {
    net.respond = async () => jsonResponse({ code: 'session_not_found', message: 'gone' }, status);
    if (!supabase) {throw new Error('Test-Client fehlt');}

    expect(await verifySessionOnServer(supabase)).toBe('rejected');
  });

  it.each([500, 503])('Gegenbeispiel: Server-Fehler %i ist keine Antwort über die Sitzung → unknown', async (status) => {
    net.respond = async () => jsonResponse({ message: 'boom' }, status);
    if (!supabase) {throw new Error('Test-Client fehlt');}

    expect(await verifySessionOnServer(supabase)).toBe('unknown');
  });

  it('Gegenbeispiel: Netz weg (fetch wirft) → unknown, Sitzung bleibt', async () => {
    net.respond = async () => {
      throw new TypeError('Failed to fetch');
    };
    if (!supabase) {throw new Error('Test-Client fehlt');}

    expect(await verifySessionOnServer(supabase)).toBe('unknown');
    expect(safeLocalStorage.getItem(TOKEN_KEY)).not.toBeNull();
  });

  it('isSessionRejectedByServer: Nicht-Auth-Fehler und Netzfehler zählen nicht', () => {
    expect(isSessionRejectedByServer(new TypeError('Failed to fetch'))).toBe(false);
    expect(isSessionRejectedByServer(undefined)).toBe(false);
  });
});

describe('Merker eigenes Abmelden (A-07d2) – kein Hinweis bei eigenem Abmelden', () => {
  beforeEach(() => {
    safeLocalStorage.clear();
    safeSessionStorage.clear();
  });

  it('Gegenbeispiel: SIGNED_OUT nach eigenem Abmelden → kein Hinweis', () => {
    // logoutAction setzt den Merker vor dem SIGNED_OUT, das auth-js danach meldet.
    safeLocalStorage.setItem('auth:ownSignOutAt', String(Date.now()));

    applyAuthEventEffects('SIGNED_OUT', null, () => undefined);

    expect(hasSignedOutElsewhere()).toBe(false);
  });

  it('Gegenbeispiel (echter Weg): eigenes Abmelden per logout → SIGNED_OUT danach ohne Hinweis', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture());
    if (!supabase) {throw new Error('Test-Client fehlt');}
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Wie AuthContext: Auswertung nach dem Ereignis, hier synchron.
      applyAuthEventEffects(event, session, () => undefined);
    });

    await logout(createMockAuthActionDeps());
    await new Promise((resolve) => setTimeout(resolve, 0));
    data.subscription.unsubscribe();

    expect(hasSignedOutElsewhere()).toBe(false);
  });

  it('Pflicht: SIGNED_OUT ohne eigenes Abmelden → Hinweis', () => {
    applyAuthEventEffects('SIGNED_OUT', null, () => undefined);

    expect(hasSignedOutElsewhere()).toBe(true);
  });

  it('Merker ist abgelaufen → wieder Hinweis', () => {
    safeLocalStorage.setItem('auth:ownSignOutAt', String(Date.now() - 60_000));

    applyAuthEventEffects('SIGNED_OUT', null, () => undefined);

    expect(hasSignedOutElsewhere()).toBe(true);
  });

  it('SIGNED_IN hebt den Hinweis wieder auf', () => {
    safeSessionStorage.setItem('auth:signedOutElsewhere', '1');
    applyAuthEventEffects('SIGNED_IN', { user: { id: 'user-a' } } as never, () => undefined);

    expect(hasSignedOutElsewhere()).toBe(false);
  });
});
