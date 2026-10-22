/**
 * Gerätesitzung (A-17a; R-GA5-1, S-5). Tests aus den Szenarien:
 * @HE-074 (bleibt auf dem Gerät: zweiter Start ohne neues signInAnonymously), @HE-079 (kein Konto entsteht),
 * @HE-089 (echtes Konto → nie signInAnonymously), @HE-015/@HE-093 (ohne Netz keine neue Sitzung), § 3.2 Auth 429.
 */
import { describe, expect, it, vi } from 'vitest';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import {
  ensureDeviceSession,
  readSessionInfo,
  sessionKind,
  type DeviceSessionAuth,
  type DeviceSessionLike,
} from '../deviceSession';

function device(id = 'dev-1'): DeviceSessionLike {
  return { user: { id, is_anonymous: true } };
}
function account(id = 'greta'): DeviceSessionLike {
  return { user: { id, is_anonymous: false } };
}

type AuthResp = { data: { session: DeviceSessionLike | null }; error: unknown };

/** Auth-Attrappe mit Speicher wie auth-js: `signInAnonymously` legt eine Sitzung an, die `getSession` danach liefert. */
function fakeAuth(initial: DeviceSessionLike | null = null) {
  let stored: DeviceSessionLike | null = initial;
  let counter = 0;
  const auth = {
    getSession: vi.fn(async (): Promise<AuthResp> => ({ data: { session: stored }, error: null })),
    signInAnonymously: vi.fn(async (): Promise<AuthResp> => {
      counter += 1;
      stored = device(`anon-${counter}`);
      return { data: { session: stored }, error: null };
    }),
    signUp: vi.fn(),
    updateUser: vi.fn(),
  };
  return auth;
}

describe('sessionKind', () => {
  it('unterscheidet keine Sitzung, Gerätesitzung und Konto', () => {
    expect(sessionKind(null)).toBe('none');
    expect(sessionKind(device())).toBe('device');
    expect(sessionKind(account())).toBe('account');
    expect(sessionKind({ user: { id: 'x' } })).toBe('account');
  });
});

describe('ensureDeviceSession', () => {
  it('@HE-074 zweiter Start: vorhandene Gerätesitzung wird weiterverwendet, kein neues signInAnonymously', async () => {
    const auth = fakeAuth();
    const first = await ensureDeviceSession(auth);
    expect(first).toEqual({ ok: true, userId: 'anon-1', created: true });

    // App geschlossen und neu geöffnet: auth-js liest das Token aus dem Speicher.
    const second = await ensureDeviceSession(auth);
    expect(second).toEqual({ ok: true, userId: 'anon-1', created: false });
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('@HE-074 Doppeltipp: zwei gleichzeitige Aufrufe legen nur eine Gerätesitzung an', async () => {
    const auth = fakeAuth();
    const [a, b] = await Promise.all([ensureDeviceSession(auth), ensureDeviceSession(auth)]);
    expect(a).toEqual(b);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    // Nach dem Lauf ist der Merker frei: der nächste Aufruf liest die Sitzung neu.
    await ensureDeviceSession(auth);
    expect(auth.getSession).toHaveBeenCalledTimes(2);
  });

  it('@HE-079 ohne Sitzung entsteht nur eine anonyme Gerätesitzung, nie ein Konto', async () => {
    const auth = fakeAuth();
    const result = await ensureDeviceSession(auth);
    expect(result.ok).toBe(true);
    expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('@HE-089 mit echtem Konto angemeldet → nie signInAnonymously, Ergebnis accountSession', async () => {
    const auth = fakeAuth(account());
    await expect(ensureDeviceSession(auth)).resolves.toEqual({ ok: false, reason: 'accountSession' });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('@HE-015 ohne Netz: Auffrischen der vorhandenen Sitzung scheitert → network, keine neue Geräte-Identität', async () => {
    const auth = fakeAuth(device('tom'));
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    await expect(ensureDeviceSession(auth)).resolves.toEqual({ ok: false, reason: 'network' });
    expect(auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('@HE-015 ohne Netz beim Anlegen → network (fetch wirft TypeError bzw. auth-js meldet Netzfehler)', async () => {
    const thrown = fakeAuth();
    thrown.signInAnonymously.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(ensureDeviceSession(thrown)).resolves.toEqual({ ok: false, reason: 'network' });

    const returned = fakeAuth();
    returned.signInAnonymously.mockResolvedValueOnce({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) });
    await expect(ensureDeviceSession(returned)).resolves.toEqual({ ok: false, reason: 'network' });
  });

  it('§ 3.2 Auth 429: zu viele anonyme Anmeldungen aus diesem Netz → rateLimited', async () => {
    const auth = fakeAuth();
    auth.signInAnonymously.mockResolvedValueOnce({
      data: { session: null },
      error: new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit'),
    });
    await expect(ensureDeviceSession(auth)).resolves.toEqual({ ok: false, reason: 'rateLimited' });
  });

  it('anonyme Anmeldung abgeschaltet (422) → unexpected mit Meldung; ohne Client → unavailable', async () => {
    const auth = fakeAuth();
    auth.signInAnonymously.mockResolvedValueOnce({
      data: { session: null },
      error: new AuthApiError('Anonymous sign-ins are disabled', 422, 'anonymous_provider_disabled'),
    });
    await expect(ensureDeviceSession(auth)).resolves.toEqual({
      ok: false, reason: 'unexpected', message: 'Anonymous sign-ins are disabled',
    });
    await expect(ensureDeviceSession(null)).resolves.toEqual({ ok: false, reason: 'unavailable' });
  });

  it('Antwort ohne Sitzung oder geworfener Fehler beim Lesen → unexpected statt Absturz', async () => {
    const noSession = fakeAuth();
    noSession.signInAnonymously.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(ensureDeviceSession(noSession)).resolves.toMatchObject({ ok: false, reason: 'unexpected' });

    const throwing = fakeAuth();
    throwing.getSession.mockRejectedValueOnce('kaputt');
    await expect(ensureDeviceSession(throwing)).resolves.toEqual({ ok: false, reason: 'unexpected', message: 'kaputt' });
    expect(throwing.signInAnonymously).not.toHaveBeenCalled();
  });

  it('abgelaufene Sitzung ohne Netzfehler (Server lehnt ab) → neue Gerätesitzung', async () => {
    const auth = fakeAuth(device('alt'));
    auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found') });
    await expect(ensureDeviceSession(auth)).resolves.toEqual({ ok: true, userId: 'anon-1', created: true });
  });
});

describe('readSessionInfo (S-5: liest nur, legt nie an)', () => {
  it('liefert Art und Nutzer-ID, ohne signInAnonymously', async () => {
    const none = fakeAuth();
    await expect(readSessionInfo(none)).resolves.toEqual({ kind: 'none', userId: null });
    expect(none.signInAnonymously).not.toHaveBeenCalled();
    await expect(readSessionInfo(fakeAuth(device('tom')))).resolves.toEqual({ kind: 'device', userId: 'tom' });
    await expect(readSessionInfo(fakeAuth(account('greta')))).resolves.toEqual({ kind: 'account', userId: 'greta' });
  });

  it('ohne Client oder bei Lesefehler: keine Sitzung', async () => {
    await expect(readSessionInfo(null)).resolves.toEqual({ kind: 'none', userId: null });
    const throwing: DeviceSessionAuth = {
      getSession: () => Promise.reject(new Error('weg')),
      signInAnonymously: vi.fn(),
    };
    await expect(readSessionInfo(throwing)).resolves.toEqual({ kind: 'none', userId: null });
  });
});
