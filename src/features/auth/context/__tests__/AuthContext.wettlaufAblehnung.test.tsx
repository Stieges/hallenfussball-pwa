/**
 * C-SITZUNG-STILL, Fixrunde 2 (B5): Der Server lehnt die Erneuerung beim Öffnen der App ab, BEVOR die App
 * das Auth-Ereignis abonniert hat (Wettlauf in auth-js `initialize`). Ablauf im echten Client mit
 * `autoRefreshToken: true` (wie in Produktion): `_recoverAndRefresh` → `_callRefreshToken` → `_removeSession`
 * löscht den Zugangsschlüssel und stellt SIGNED_OUT in `_pendingInitNotifications`; die Warteschlange geht an
 * die Abonnenten, die es zu diesem Zeitpunkt gibt – noch keine. Danach liefert `getSession` `null` ohne Fehler.
 *
 * @AN-024: Das verlorene Handy zeigt bei der nächsten Verbindung „Du wurdest von einem anderen Gerät aus
 * abgemeldet“ und keine Daten mehr. Nie still abmelden (Ü1.2).
 *
 * Eigene Datei: der Client ist ein Singleton und erneuert nur einmal, beim Erzeugen. Die gespeicherte
 * Anmeldung muss deshalb schon vor dem Import im Speicher liegen. Fetch ist gemockt, kein Netz.
 */

import { useContext } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const TOKEN_KEY = 'sb-localhost-auth-token';
const CACHED_USER_KEY = 'auth:cachedUser';

const net = vi.hoisted(() => ({ tokenCalls: 0 }));

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
  const local = new MapStorage();
  // Olli war auf dem Handy angemeldet: gespeicherte Anmeldung (Zugangsschlüssel abgelaufen, das Handy lag
  // länger als eine Stunde) und die Nutzerkopie, die die App bei jeder Anmeldung schreibt.
  const b64 = (v: unknown): string => Buffer.from(JSON.stringify(v)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) - 60;
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'user-a', role: 'authenticated', exp })}.signature`;
  local.setItem('sb-localhost-auth-token', JSON.stringify({
    access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-a',
    user: { id: 'user-a', aud: 'authenticated', email: 'a@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
  }));
  local.setItem('auth:cachedUser', JSON.stringify({ id: 'user-a', email: 'a@example.test', name: 'Olli', globalRole: 'user' }));
  return { local, session: new MapStorage() };
});

vi.mock('../../../../core/utils/safeStorage', () => ({
  safeLocalStorage: store.local,
  safeSessionStorage: store.session,
}));

vi.mock('../../../../lib/sentry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../lib/sentry')>()),
  captureFeatureError: vi.fn(),
}));

// Nutzerkopie wie im echten Dienst aus localStorage (ohne IndexedDB).
vi.mock('../../services/profileCacheService', () => ({
  cacheUserProfile: vi.fn(async () => undefined),
  clearProfileCache: vi.fn(async () => undefined),
  restoreUserFromCache: vi.fn(async () => {
    const raw = store.local.getItem('auth:cachedUser');
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }),
}));

vi.mock('../../../../lib/supabase', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  // Der Server lehnt den Erneuerungsschlüssel ab (Widerruf über „Auf allen anderen Geräten abmelden“).
  const fakeFetch = async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.includes('/auth/v1/token')) {
      net.tokenCalls += 1;
      return new Response(
        JSON.stringify({ code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } },
      );
    }
    return new Response(null, { status: 204 });
  };
  const client = createClient('http://localhost:54321', 'anon-key', {
    auth: { storage: store.local, autoRefreshToken: true, persistSession: true },
    global: { fetch: fakeFetch },
  });
  return { supabase: client, isSupabaseConfigured: true, supabaseProjectUrl: 'http://localhost:54321' };
});

import { supabase } from '../../../../lib/supabase';
import { AuthProvider } from '../AuthContext';
import { AuthContext } from '../authContextInstance';

function Probe() {
  const ctx = useContext(AuthContext);
  return <div data-testid="probe">{ctx?.user ? 'user' : 'none'}</div>;
}

describe('AuthProvider – Ablehnung vor dem Abonnieren (Wettlauf, echter Client, autoRefreshToken: true)', () => {
  afterEach(() => {
    cleanup();
  });

  it('@AN-024 verlorenes Handy: Server lehnt beim Öffnen ab, bevor die App abonniert → „von einem anderen Gerät abgemeldet“, keine Daten', async () => {
    if (!supabase) { throw new Error('Test-Client fehlt'); }
    // Der Server war schneller als der erste Render: auth-js hat abgelehnt, gelöscht und SIGNED_OUT ins Leere verteilt.
    await supabase.auth.initialize();
    expect(net.tokenCalls).toBe(1);
    expect(store.local.getItem(TOKEN_KEY)).toBeNull();

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => { expect(screen.getByTestId('signed-out-elsewhere')).toBeTruthy(); });
    expect(screen.getByTestId('probe').textContent).toBe('none');
    // Keine Daten des Hallencup Ost mehr: die Nutzerkopie ist weg, ein Neustart stellt Olli nicht wieder her.
    expect(store.local.getItem(CACHED_USER_KEY)).toBeNull();
  });
});
