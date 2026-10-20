/**
 * C-SITZUNG-STILL, Fixrunde 2 (N1), Anmelden @AN-019: „Ein langsamer Server beim Öffnen der App meldet niemanden ab“.
 * Der Kopf darf während eines langsamen Starts weder die Nutzerkopie (`auth:cachedUser`) löschen noch
 * „Anmelden“ zeigen; sobald AuthProvider die Kopie gesetzt hat, ist Olli sichtbar angemeldet (Name, Avatar),
 * auch wenn der Start noch läuft (`isLoading`). Die Kopie endet erst mit dem Ende der Sitzung (Server lehnt ab).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AuthSection } from '../AuthSection';

const CACHED_USER = { id: 'user-a', name: 'Olli Beispiel', email: 'olli@example.test', globalRole: 'user' };

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

vi.mock('../../../core/utils/safeStorage', () => ({
  safeLocalStorage: store.local,
  safeSessionStorage: store.session,
}));

const auth = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  isAuthenticated: false,
  isLoading: true,
}));

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isGuest: false,
    isLoading: auth.isLoading,
    logout: vi.fn(),
    connectionState: 'connecting',
    reconnect: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../../hooks/useCompactHeader', () => ({ useCompactHeader: () => false }));
vi.mock('../../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/contexts/RepositoryContext')>()),
  useRepositories: () => ({ tournamentRepository: {} }),
}));

const NAV = { onNavigateToLogin: vi.fn(), onNavigateToRegister: vi.fn(), onNavigateToProfile: vi.fn() };

describe('AuthSection – langsamer Start (@AN-019)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.local.clear();
    auth.user = null;
    auth.isAuthenticated = false;
    auth.isLoading = true;
  });

  afterEach(() => {
    vi.useRealTimers();
    store.local.clear();
  });

  it('@AN-019 Server antwortet 30 s nicht: Nutzerkopie bleibt, kein „Anmelden“; mit der Kopie Name und Avatar sichtbar', () => {
    store.local.setItem('auth:cachedUser', JSON.stringify(CACHED_USER));

    const { rerender } = render(<AuthSection {...NAV} />);
    act(() => { vi.advanceTimersByTime(4_000); });

    expect(store.local.getItem('auth:cachedUser')).not.toBeNull();
    expect(screen.queryByTestId('auth-login-button')).toBeNull();

    // Nach 5 s setzt AuthProvider die Kopie; der Start läuft weiter (isLoading bis zur Antwort oder 15 s).
    auth.user = CACHED_USER;
    auth.isAuthenticated = true;
    rerender(<AuthSection {...NAV} />);
    act(() => { vi.advanceTimersByTime(26_000); });

    expect(screen.getByTestId('auth-avatar-button')).toBeTruthy();
    expect(screen.getByText('Olli Beispiel')).toBeTruthy();
    expect(screen.queryByTestId('auth-login-button')).toBeNull();
    expect(store.local.getItem('auth:cachedUser')).not.toBeNull();
  });

  it('Gegenbeispiel: ohne Nutzerkopie (nie angemeldet) zeigt der Kopf sofort „Anmelden“', () => {
    render(<AuthSection {...NAV} />);

    expect(screen.getByTestId('auth-login-button')).toBeTruthy();
    expect(screen.queryByTestId('auth-avatar-button')).toBeNull();
  });
});
