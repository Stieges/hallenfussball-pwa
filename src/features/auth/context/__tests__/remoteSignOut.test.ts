/**
 * Abmeldung durch ein anderes Gerät (A-07d2, @AN-024) – Prüfung und Merker.
 * Echter supabase-js-Client mit Map-Speicher und Fake-fetch (wie logoutAction.test.ts).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthRefreshDiscardedError, type SupabaseClient } from '@supabase/supabase-js';
import { safeLocalStorage, safeSessionStorage } from '../../../../core/utils/safeStorage';
import { supabase } from '../../../../lib/supabase';
import { applyAuthEventEffects } from '../authEventEffects';
import {
  hasSignedOutElsewhere,
  isOwnSignOut,
  markOwnSignOut,
  REMOTE_CHECK_TIMEOUT_MS,
  verifySessionOnServer,
  isSessionRejectedByServer,
} from '../remoteSignOut';
import { logout } from '../logoutAction';
import { captureFeatureError } from '../../../../lib/sentry';
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

vi.mock('../../../../lib/sentry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../lib/sentry')>()),
  captureFeatureError: vi.fn(),
}));

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

/** Wie GoTrue: jede JSON-Antwort trägt den API-Versions-Header (M1). Ohne ihn liest auth-js `code` nicht. */
function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
  });
}

function requireClient() {
  if (!supabase) {throw new Error('Test-Client fehlt');}
  return supabase;
}

describe('verifySessionOnServer (A-07d2) – Antwort des Servers zur Sitzung', () => {
  beforeEach(() => {
    net.calls.length = 0;
    safeLocalStorage.clear();
    safeSessionStorage.clear();
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture());
    net.respond = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Gegenbeispiel: 200 → valid, nichts passiert', async () => {
    net.respond = async () => jsonResponse({ id: 'user-a', aud: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }, 200);

    expect(await verifySessionOnServer(requireClient())).toBe('valid');
    expect(net.calls.some((c) => c.url.includes('/auth/v1/user'))).toBe(true);
  });

  it.each([401, 403])('Pflicht: Server antwortet %i mit session_not_found (Sitzung serverseitig weg) → rejected, ohne /logout', async (status) => {
    net.respond = async () => jsonResponse({ code: 'session_not_found', message: 'gone' }, status);

    expect(await verifySessionOnServer(requireClient())).toBe('rejected');
    expect(net.calls.some((c) => c.url.includes('/logout'))).toBe(false);
  });

  it.each(['refresh_token_already_used', 'refresh_token_not_found', 'session_expired', 'user_not_found'])(
    'Positivliste: Code %s → rejected',
    async (code) => {
      net.respond = async () => jsonResponse({ code, message: 'gone' }, 400);

      expect(await verifySessionOnServer(requireClient())).toBe('rejected');
    },
  );

  it.each([500, 503])('Gegenbeispiel: Server-Fehler %i ist keine Antwort über die Sitzung → unknown', async (status) => {
    net.respond = async () => jsonResponse({ message: 'boom' }, status);

    expect(await verifySessionOnServer(requireClient())).toBe('unknown');
  });

  it('Gegenbeispiel: Netz weg (fetch wirft) → unknown, Sitzung bleibt', async () => {
    net.respond = async () => {
      throw new TypeError('Failed to fetch');
    };

    expect(await verifySessionOnServer(requireClient())).toBe('unknown');
    expect(safeLocalStorage.getItem(TOKEN_KEY)).not.toBeNull();
  });

  // B1: Nur die Positivliste meldet ab. Alles andere lässt die Sitzung stehen.
  it.each([
    ['429 Rate-Limit (viele Geräte hinter einer IP)', { code: 'over_request_rate_limit', message: 'slow down' }, 429],
    ['403 bad_jwt (falsch gehende Uhr des Geräts)', { code: 'bad_jwt', message: 'token issued in the future' }, 403],
  ])('B1 Gegenbeispiel: %s → unknown, Sitzung bleibt, kein /logout', async (_label, body, status) => {
    net.respond = async () => jsonResponse(body, status);

    expect(await verifySessionOnServer(requireClient())).toBe('unknown');
    expect(safeLocalStorage.getItem(TOKEN_KEY)).not.toBeNull();
    expect(net.calls.some((c) => c.url.includes('/logout'))).toBe(false);
  });

  it('B1 Gegenbeispiel: HTML-Seite eines Proxys/Hallen-WLANs (404, kein JSON; AuthUnknownError) → unknown, Sitzung bleibt', async () => {
    net.respond = async () => new Response('<html><body>Anmeldeportal</body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    });

    expect(await verifySessionOnServer(requireClient())).toBe('unknown');
    expect(safeLocalStorage.getItem(TOKEN_KEY)).not.toBeNull();
  });

  it('B1 Gegenbeispiel: AuthRefreshDiscardedError (Refresh-Wettlauf zweier Fenster) → kein Abmelden', () => {
    expect(isSessionRejectedByServer(new AuthRefreshDiscardedError())).toBe(false);
  });

  // M3: Ein hängender Aufruf sperrt die Prüfung nicht dauerhaft.
  it('M3: hängender getUser → nach der Zeitgrenze unknown', async () => {
    vi.mocked(captureFeatureError).mockClear();
    net.respond = async () => new Promise<Response>(() => undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const pending = verifySessionOnServer(requireClient());
    await vi.advanceTimersByTimeAsync(REMOTE_CHECK_TIMEOUT_MS);

    expect(await pending).toBe('unknown');
    expect(safeLocalStorage.getItem(TOKEN_KEY)).not.toBeNull();
    // Zeitüberschreitung wird nicht an Sentry gemeldet.
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: anderer unerwarteter Fehler (kein Timeout) wird weiterhin gemeldet → unknown', async () => {
    const stub = { auth: { getUser: async () => { throw new TypeError('kaputt'); } } } as unknown as SupabaseClient;

    expect(await verifySessionOnServer(stub)).toBe('unknown');
    expect(captureFeatureError).toHaveBeenCalledWith(expect.any(TypeError), 'auth', 'remoteSessionCheck');
  });

  it('isSessionRejectedByServer: Nicht-Auth-Fehler und Netzfehler zählen nicht', () => {
    expect(isSessionRejectedByServer(new TypeError('Failed to fetch'))).toBe(false);
    expect(isSessionRejectedByServer(undefined)).toBe(false);
  });
});

describe('Merker eigenes Abmelden (A-07d2) – kein Hinweis bei eigenem Abmelden', () => {
  beforeEach(() => {
    net.calls.length = 0;
    net.respond = null;
    safeLocalStorage.clear();
    safeSessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Gegenbeispiel: SIGNED_OUT nach eigenem Abmelden → kein Hinweis', () => {
    markOwnSignOut();

    applyAuthEventEffects('SIGNED_OUT', null, () => undefined);

    expect(hasSignedOutElsewhere()).toBe(false);
  });

  it('Gegenbeispiel (echter Weg): eigenes Abmelden per logout → SIGNED_OUT danach ohne Hinweis', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture());
    const { data } = requireClient().auth.onAuthStateChange((event, session) => {
      // Wie AuthContext: Auswertung nach dem Ereignis, hier synchron.
      applyAuthEventEffects(event, session, () => undefined);
    });

    await logout(createMockAuthActionDeps());
    await new Promise((resolve) => setTimeout(resolve, 0));
    data.subscription.unsubscribe();

    expect(safeLocalStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(hasSignedOutElsewhere()).toBe(false);
  });

  // M2: kein Zeitfenster. Ein Merker von vor 60 s gilt noch.
  it('M2: Merker 60 s alt → SIGNED_OUT ohne Hinweis', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
    markOwnSignOut();
    vi.setSystemTime(new Date('2026-10-15T10:01:00Z'));

    applyAuthEventEffects('SIGNED_OUT', null, () => undefined);

    expect(hasSignedOutElsewhere()).toBe(false);
  });

  // M2: auth-js meldet SIGNED_OUT erst nach der Antwort auf POST /logout. Dauert die Antwort länger als 10 s, bleibt der Merker.
  it('M2: langsame Logout-Antwort (> 10 s) → SIGNED_OUT danach ohne Hinweis', async () => {
    safeLocalStorage.setItem(TOKEN_KEY, sessionFixture());
    vi.useFakeTimers({ toFake: ['Date'] });
    const startedAt = Date.now();
    let releaseLogout: (() => void) | null = null;
    net.respond = async (url) => {
      if (url.includes('/logout')) {
        return new Promise<Response>((resolve) => {
          releaseLogout = () => resolve(new Response(null, { status: 204 }));
        });
      }
      return new Response(null, { status: 204 });
    };
    const { data } = requireClient().auth.onAuthStateChange((event, session) => {
      applyAuthEventEffects(event, session, () => undefined);
    });

    const pending = logout(createMockAuthActionDeps());
    for (let i = 0; i < 100 && releaseLogout === null; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    vi.setSystemTime(startedAt + 12_000);
    (releaseLogout as (() => void) | null)?.();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));
    data.subscription.unsubscribe();

    expect(safeLocalStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(hasSignedOutElsewhere()).toBe(false);
  });

  it('Pflicht: SIGNED_OUT ohne eigenes Abmelden → Hinweis', () => {
    applyAuthEventEffects('SIGNED_OUT', null, () => undefined);

    expect(hasSignedOutElsewhere()).toBe(true);
  });

  it('SIGNED_IN hebt Hinweis und Merker auf; danach wieder Hinweis bei SIGNED_OUT vom Server', () => {
    safeSessionStorage.setItem('auth:signedOutElsewhere', '1');
    markOwnSignOut();
    applyAuthEventEffects('SIGNED_IN', { user: { id: 'user-a' } } as never, () => undefined);

    expect(hasSignedOutElsewhere()).toBe(false);
    expect(isOwnSignOut()).toBe(false);

    applyAuthEventEffects('SIGNED_OUT', null, () => undefined);
    expect(hasSignedOutElsewhere()).toBe(true);
  });
});
