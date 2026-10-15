// @vitest-environment jsdom
/**
 * authCallbackHelpers — echte Wege der Rückkehr aus dem Anmelde-Link (A-07h, Abdeckung features/auth).
 *
 * Geprüft: HashRouter-Parameter, Wiederherstellungs-Frist, Sitzung vorhanden, PKCE-Austausch,
 * implizierter Fluss mit Zeitgrenze. Jeder Fall hat ein Gegenbeispiel (was NICHT passieren darf).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AUTH_ERRORS } from '../../constants';
import { safeSessionStorage, safeLocalStorage } from '../../../../core/utils/safeStorage';

interface FakeSupabase {
  auth: {
    exchangeCodeForSession: ReturnType<typeof vi.fn>;
    getSession: ReturnType<typeof vi.fn>;
    setSession: ReturnType<typeof vi.fn>;
  };
}

const state = vi.hoisted(() => ({ client: null as FakeSupabase | null }));

vi.mock('../../../../lib/supabase', () => ({
  get supabase() {
    return state.client;
  },
  isSupabaseConfigured: true,
}));

import {
  parseHashRouterParams,
  isPasswordRecoveryPending,
  parseAllAuthParams,
  handleExistingSession,
  handleCodeExchange,
  handleImplicitFlow,
} from '../authCallbackHelpers';

function makeClient(): FakeSupabase {
  return {
    auth: {
      exchangeCodeForSession: vi.fn(),
      getSession: vi.fn(),
      setSession: vi.fn(),
    },
  };
}

function setUrl(path: string): void {
  window.history.replaceState(null, '', path);
}

describe('parseHashRouterParams', () => {
  beforeEach(() => {
    safeSessionStorage.clear();
    safeLocalStorage.clear();
    setUrl('/');
  });

  it('liest Query-Parameter, die innerhalb des Hash-Pfads stehen', () => {
    setUrl('/#/auth/callback?code=abc&type=recovery');

    const { query, fragment } = parseHashRouterParams();

    expect(query.get('code')).toBe('abc');
    expect(query.get('type')).toBe('recovery');
    expect(fragment.toString()).toBe('');
  });

  it('trennt Fragment-Tokens hinter der Query (implizierter Fluss nach Query)', () => {
    setUrl('/#/auth/callback?type=recovery#access_token=AT&refresh_token=RT');

    const { query, fragment } = parseHashRouterParams();

    expect(query.get('type')).toBe('recovery');
    expect(fragment.get('access_token')).toBe('AT');
    expect(fragment.get('refresh_token')).toBe('RT');
  });

  it('liest reine Fragment-Tokens ohne Query', () => {
    setUrl('/#/auth/callback#access_token=AT');

    const { query, fragment } = parseHashRouterParams();

    expect(fragment.get('access_token')).toBe('AT');
    expect(query.get('access_token')).toBeNull();
  });

  it('greift auf window.location.search zurück, wenn der Hash keine Query hat', () => {
    setUrl('/?code=zz#/auth/callback');

    expect(parseHashRouterParams().query.get('code')).toBe('zz');
  });

  it('Gegenbeispiel: window.location.search wird ignoriert, wenn der Hash eine Query hat', () => {
    setUrl('/?code=von-aussen#/auth/callback?code=aus-hash');

    expect(parseHashRouterParams().query.get('code')).toBe('aus-hash');
  });
});

describe('Bestand (geparkt, @AN-010): isPasswordRecoveryPending', () => {
  beforeEach(() => {
    safeSessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ist false ohne gespeicherten Zustand', () => {
    expect(isPasswordRecoveryPending()).toBe(false);
  });

  it('erkennt das alte Format "true"', () => {
    safeSessionStorage.setItem('auth:passwordRecovery', 'true');

    expect(isPasswordRecoveryPending()).toBe(true);
  });

  it('erkennt das neue Format innerhalb der Frist', () => {
    vi.useFakeTimers({ now: new Date('2026-10-15T10:00:00Z') });
    safeSessionStorage.setItem(
      'auth:passwordRecovery',
      JSON.stringify({ pending: true, expiresAt: Date.parse('2026-10-15T10:30:00Z') })
    );

    expect(isPasswordRecoveryPending()).toBe(true);
  });

  it('Gegenbeispiel: abgelaufene Frist liefert false und räumt den Eintrag auf', () => {
    vi.useFakeTimers({ now: new Date('2026-10-15T11:00:00Z') });
    safeSessionStorage.setItem(
      'auth:passwordRecovery',
      JSON.stringify({ pending: true, expiresAt: Date.parse('2026-10-15T10:30:00Z') })
    );

    expect(isPasswordRecoveryPending()).toBe(false);
    expect(safeSessionStorage.getItem('auth:passwordRecovery')).toBeNull();
  });

  it('Gegenbeispiel: pending=false im neuen Format ist keine Wiederherstellung', () => {
    safeSessionStorage.setItem('auth:passwordRecovery', JSON.stringify({ pending: false }));

    expect(isPasswordRecoveryPending()).toBe(false);
  });

  it('Gegenbeispiel: ungültiges JSON ist nur dann eine Wiederherstellung, wenn es "true" ist', () => {
    safeSessionStorage.setItem('auth:passwordRecovery', '{kaputt');

    expect(isPasswordRecoveryPending()).toBe(false);
  });
});

describe('parseAllAuthParams', () => {
  beforeEach(() => {
    setUrl('/');
  });

  it('bevorzugt Fragment-Tokens vor Hash-Query und Router-Suche', () => {
    setUrl('/#/auth/callback?access_token=query-at#access_token=frag-at');

    const params = parseAllAuthParams('?access_token=router-at');

    expect(params.accessToken).toBe('frag-at');
  });

  it('fällt auf die Router-Suche zurück, wenn weder Hash noch Query den Wert haben', () => {
    setUrl('/#/auth/callback');

    const params = parseAllAuthParams('?code=router-code&error_description=link%20kaputt');

    expect(params.code).toBe('router-code');
    expect(params.errorDescription).toBe('link kaputt');
    expect(params.accessToken).toBeNull();
    expect(params.refreshToken).toBeNull();
    expect(params.type).toBeNull();
  });

  it('Gegenbeispiel: ohne irgendeinen Parameter sind alle Felder null', () => {
    setUrl('/#/auth/callback');

    const params = parseAllAuthParams('');

    expect(params).toEqual({
      accessToken: null,
      refreshToken: null,
      code: null,
      type: null,
      errorDescription: null,
    });
  });
});

describe('Bestand (geparkt, @AN-010): handleExistingSession', () => {
  beforeEach(() => {
    safeSessionStorage.clear();
    safeLocalStorage.clear();
  });

  it('leitet zur Startseite und entfernt den Gastzustand, wenn keine Wiederherstellung läuft', () => {
    safeLocalStorage.setItem('auth:guestUser', '{"id":"g"}');

    expect(handleExistingSession(null)).toEqual({ handled: true, redirectTo: '/' });
    expect(safeLocalStorage.getItem('auth:guestUser')).toBeNull();
  });

  it('Bestand (@AN-010): leitet bei type=recovery zum Passwort-Setzen und räumt den Wiederherstellungs-Eintrag auf', () => {
    safeSessionStorage.setItem('auth:passwordRecovery', 'true');

    expect(handleExistingSession('recovery')).toEqual({ handled: true, redirectTo: '/set-password' });
    expect(safeSessionStorage.getItem('auth:passwordRecovery')).toBeNull();
  });

  it('Bestand (@AN-010): ein offener Wiederherstellungs-Eintrag ohne type führt ebenfalls zum Passwort-Setzen', () => {
    safeSessionStorage.setItem('auth:passwordRecovery', 'true');

    expect(handleExistingSession(null).redirectTo).toBe('/set-password');
  });

  it('Gegenbeispiel: type=signup ohne offene Wiederherstellung führt nicht zum Passwort-Setzen', () => {
    expect(handleExistingSession('signup').redirectTo).toBe('/');
  });
});

describe('handleCodeExchange', () => {
  beforeEach(() => {
    state.client = makeClient();
    safeSessionStorage.clear();
    safeLocalStorage.clear();
  });

  afterEach(() => {
    state.client = null;
  });

  it('gibt nicht behandelt zurück, wenn kein Supabase-Client konfiguriert ist', async () => {
    state.client = null;

    expect(await handleCodeExchange('code-1', null)).toEqual({ handled: false });
  });

  it('meldet LINK_EXPIRED bei abgelaufenem Code', async () => {
    state.client!.auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: 'Code has expired' },
    });

    expect(await handleCodeExchange('code-1', null)).toEqual({
      handled: true,
      error: AUTH_ERRORS.LINK_EXPIRED,
    });
  });

  it('meldet LOGIN_FAILED bei sonstigem Austauschfehler', async () => {
    state.client!.auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: 'invalid grant' },
    });

    expect(await handleCodeExchange('code-1', null)).toEqual({
      handled: true,
      error: AUTH_ERRORS.LOGIN_FAILED,
    });
  });

  it('meldet SESSION_CREATE_FAILED, wenn der Austausch ohne Fehler keine Sitzung liefert', async () => {
    state.client!.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    state.client!.auth.getSession.mockResolvedValue({ data: { session: null } });

    expect(await handleCodeExchange('code-1', null)).toEqual({
      handled: true,
      error: AUTH_ERRORS.SESSION_CREATE_FAILED,
    });
  });

  it('Bestand (@AN-010): leitet nach erfolgreichem Austausch bei type=recovery zum Passwort-Setzen', async () => {
    state.client!.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    state.client!.auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });

    expect(await handleCodeExchange('code-1', 'recovery')).toEqual({
      handled: true,
      redirectTo: '/set-password',
    });
    expect(state.client!.auth.exchangeCodeForSession).toHaveBeenCalledWith('code-1');
  });

  it('Gegenbeispiel: nach erfolgreichem Austausch ohne type führt die Anmeldung zur Startseite', async () => {
    state.client!.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    state.client!.auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });

    expect(await handleCodeExchange('code-1', null)).toEqual({ handled: true, redirectTo: '/' });
  });
});

describe('handleImplicitFlow', () => {
  beforeEach(() => {
    state.client = makeClient();
    safeLocalStorage.clear();
  });

  afterEach(() => {
    state.client = null;
    vi.useRealTimers();
  });

  it('gibt nicht behandelt zurück, wenn kein Supabase-Client konfiguriert ist', async () => {
    state.client = null;

    expect(await handleImplicitFlow('AT', 'RT', null)).toEqual({ handled: false });
  });

  it('setzt die Sitzung aus den URL-Tokens und leitet zur Startseite', async () => {
    state.client!.auth.setSession.mockResolvedValue({ error: null });
    state.client!.auth.getSession.mockResolvedValue({ data: { session: { user: { email: 'a@b.de' } } } });
    safeLocalStorage.setItem('auth:guestUser', '{"id":"g"}');

    const result = await handleImplicitFlow('AT', 'RT', null);

    expect(state.client!.auth.setSession).toHaveBeenCalledWith({ access_token: 'AT', refresh_token: 'RT' });
    expect(result).toEqual({ handled: true, redirectTo: '/' });
    expect(safeLocalStorage.getItem('auth:guestUser')).toBeNull();
  });

  it('Bestand (@AN-010): leitet bei type=recovery zum Passwort-Setzen', async () => {
    state.client!.auth.setSession.mockResolvedValue({ error: null });
    state.client!.auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });

    expect(await handleImplicitFlow('AT', 'RT', 'recovery')).toEqual({
      handled: true,
      redirectTo: '/set-password',
    });
  });

  // Bestand: die rohe Server-Meldung wird als Text angezeigt (Befund, Ziel-Record 2026-10-02_anmelden Ü1.1; authCallbackHelpers.ts:258).
  it('Bestand (Befund rohe setSession-Meldung): gibt die Server-Meldung zurück und prüft keine Sitzung', async () => {
    state.client!.auth.setSession.mockResolvedValue({ error: { message: 'token revoked' } });

    expect(await handleImplicitFlow('AT', 'RT', null)).toEqual({ handled: true, error: 'token revoked' });
    expect(state.client!.auth.getSession).not.toHaveBeenCalled();
  });

  it('meldet SESSION_CREATE_FAILED, wenn setSession ohne Fehler keine Sitzung hinterlässt', async () => {
    state.client!.auth.setSession.mockResolvedValue({ error: null });
    state.client!.auth.getSession.mockResolvedValue({ data: { session: null } });

    expect(await handleImplicitFlow('AT', 'RT', null)).toEqual({
      handled: true,
      error: AUTH_ERRORS.SESSION_CREATE_FAILED,
    });
  });

  it('meldet eine Ausnahme aus setSession als Fehlermeldung', async () => {
    state.client!.auth.setSession.mockRejectedValue(new Error('Netzwerk weg'));

    expect(await handleImplicitFlow('AT', 'RT', null)).toEqual({ handled: true, error: 'Netzwerk weg' });
  });

  it('bricht nach 10 Sekunden ab, wenn setSession hängt (Zeitgrenze)', async () => {
    vi.useFakeTimers();
    state.client!.auth.setSession.mockReturnValue(new Promise(() => undefined));

    const pending = handleImplicitFlow('AT', 'RT', null);
    await vi.advanceTimersByTimeAsync(10000);

    expect(await pending).toEqual({ handled: true, error: 'auth:errors.sessionTimeout' });
  });

  it('Gegenbeispiel: antwortet setSession vor der Grenze, gibt es keinen Timeout-Fehler', async () => {
    vi.useFakeTimers();
    state.client!.auth.setSession.mockResolvedValue({ error: null });
    state.client!.auth.getSession.mockResolvedValue({ data: { session: { user: {} } } });

    const pending = handleImplicitFlow('AT', 'RT', null);
    await vi.advanceTimersByTimeAsync(9999);

    expect(await pending).toEqual({ handled: true, redirectTo: '/' });
  });
});
