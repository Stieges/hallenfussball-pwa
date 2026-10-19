/**
 * C-SITZUNG-STILL (Anmelden Ü1.2), eigene Datei: der Client ist ein Singleton und bleibt nach einem Netzfehler-Test mit Fake-Zeit im Wiederholen hängen: Ein langsamer Server beim Öffnen der App meldet niemanden ab
 * (@AN-019, @AN-020), heißt „Server antwortet langsam“ und nicht „offline“ (@AN-032); lehnt der Server
 * die Erneuerung ab, kommt die Meldung „von einem anderen Gerät aus abgemeldet“ (@AN-024; solange es
 * keinen Zeitablauf gibt, sind Ablauf und Widerruf nicht unterscheidbar). Nie still abmelden.
 * i18n ist im Test ein Durchreicher: Schlüssel statt Text.
 */

import { useContext } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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

import { advanceInSteps } from './fakeTime';
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


function Probe() {
  const ctx = useContext(AuthContext);
  return (
    <div>
      <div data-testid="probe">{ctx?.user ? 'user' : 'none'}</div>
      <div data-testid="conn">{ctx?.connectionState}</div>
      <button data-testid="do-reconnect" onClick={() => { void ctx?.reconnect(); }}>reconnect</button>
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


const CACHED_USER = { id: 'user-a', email: 'a@example.test', name: 'A', globalRole: 'user' };

describe('AuthProvider – Server nicht erreichbar meldet nicht ab (@AN-019, @AN-020)', () => {
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

  it('@AN-019 @AN-020 Server nicht erreichbar (Browser meldet online), Nutzerkopie da: nach über 60 s weiter angemeldet, Sitzung bleibt', async () => {
    cache.user = CACHED_USER;
    store.local.setItem(TOKEN_KEY, sessionRaw(true));
    net.respond = async () => { throw new TypeError('Failed to fetch'); };

    renderProvider();
    await advanceInSteps(90_000);

    expect(screen.getByTestId('probe').textContent).toBe('user');
    expect(store.local.getItem(TOKEN_KEY)).not.toBeNull();
    expect(screen.queryByTestId('signed-out-elsewhere')).toBeNull();
  });

});
