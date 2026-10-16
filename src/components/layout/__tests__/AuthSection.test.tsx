/**
 * Fixrunde 1 (Review I3): das Konto-Dropdown ist der ZWEITE Abmeldeweg neben
 * UserProfileScreen -- D-C2 gilt fuer "Abmelden mit wartenden Eintraegen" allgemein, nicht nur
 * fuer einen Screen. Beide Wege nutzen jetzt useGuardedLogout (siehe UserProfileScreen.logout.test.tsx
 * fuer den anderen Weg).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthSection } from '../AuthSection';
import { ResyncNowContext } from '../../../features/match-engine/resyncNowContext';

const logout = vi.fn();
const reconnect = vi.fn();
const resyncNow = vi.fn((): Promise<void> => Promise.resolve());
const authMock: { connectionState: string } = { connectionState: 'online' };

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'acc-1', name: 'Helfer Eins', email: 'helfer@example.de' },
    isAuthenticated: true,
    isGuest: false,
    isLoading: false,
    logout,
    connectionState: authMock.connectionState,
    reconnect,
  }),
}));

vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
const kopf = vi.hoisted(() => ({ kompakt: false }));
vi.mock('../../../hooks/useCompactHeader', () => ({ useCompactHeader: () => kopf.kompakt }));

// A-07c: der Abmelde-Hook liest die Konto-Queue ueber useRepositories(); hier ohne Queue.
vi.mock('../../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/contexts/RepositoryContext')>()),
  useRepositories: () => ({ tournamentRepository: {} }),
}));

function renderWithResync(ui: ReactElement) {
  return render(<ResyncNowContext.Provider value={resyncNow}>{ui}</ResyncNowContext.Provider>);
}

function fakeStore(waiting: number) {
  const copy = {
    formatVersion: 2 as const,
    accountId: 'acc-1',
    matchId: 'm1',
    ctx: { matchId: 'm1', teamAId: 'a', teamBId: 'b' },
    confirmed: [],
    watermarkSeq: 0,
    pending: Array.from({ length: waiting }, (_, i) => ({
      id: `e${i}`,
      type: 'GOAL' as const,
      actor: 'helper' as const,
      at: 0,
      section: 1,
      clockMs: 0,
      teamId: null,
      payload: {},
    })),
    acked: [],
    rejected: [],
    review: [],
    updatedAt: 0,
  };
  const copies = waiting > 0 ? [copy] : [];
  return { forAccount: vi.fn(async () => copies) };
}

function openDropdownAndClickLogout() {
  fireEvent.click(screen.getByTestId('auth-avatar-button'));
  fireEvent.click(screen.getByTestId('auth-logout-button'));
}

describe('AuthSection — Abmelde-Warnung im Konto-Dropdown (Review I3)', () => {
  beforeEach(() => {
    logout.mockClear();
    reconnect.mockClear();
    resyncNow.mockClear();
    authMock.connectionState = 'online';
  });

  it('wartende Eintraege zeigen die D-C2-Warnung, ohne direkt abzumelden', async () => {
    render(
      <AuthSection
        onNavigateToLogin={vi.fn()}
        onNavigateToRegister={vi.fn()}
        onNavigateToProfile={vi.fn()}
        createMatchStore={() => fakeStore(2)}
      />,
    );
    openDropdownAndClickLogout();
    expect(await screen.findByTestId('logout-warning-dialog')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it('„Trotzdem abmelden“ meldet ab', async () => {
    render(
      <AuthSection
        onNavigateToLogin={vi.fn()}
        onNavigateToRegister={vi.fn()}
        onNavigateToProfile={vi.fn()}
        createMatchStore={() => fakeStore(1)}
      />,
    );
    openDropdownAndClickLogout();
    fireEvent.click(await screen.findByTestId('logout-warning-confirm'));
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
  });

  it('ohne wartende Eintraege wird direkt abgemeldet, ohne Dialog', async () => {
    render(
      <AuthSection
        onNavigateToLogin={vi.fn()}
        onNavigateToRegister={vi.fn()}
        onNavigateToProfile={vi.fn()}
        createMatchStore={() => fakeStore(0)}
      />,
    );
    openDropdownAndClickLogout();
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('logout-warning-dialog')).toBeNull();
  });
});

describe('AuthSection — handleReconnect (A-06h)', () => {
  beforeEach(() => {
    reconnect.mockClear();
    resyncNow.mockClear();
    authMock.connectionState = 'online';
  });

  it('Klick auf das Offline-Badge ruft reconnect UND resyncNow je 1x', () => {
    authMock.connectionState = 'offline';
    renderWithResync(
      <AuthSection
        onNavigateToLogin={vi.fn()}
        onNavigateToRegister={vi.fn()}
        onNavigateToProfile={vi.fn()}
        createMatchStore={() => fakeStore(0)}
      />,
    );

    fireEvent.click(screen.getByTestId('auth-offline-badge'));

    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(resyncNow).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: ohne Klick wird nichts angestossen', () => {
    authMock.connectionState = 'offline';
    renderWithResync(
      <AuthSection
        onNavigateToLogin={vi.fn()}
        onNavigateToRegister={vi.fn()}
        onNavigateToProfile={vi.fn()}
        createMatchStore={() => fakeStore(0)}
      />,
    );

    expect(reconnect).not.toHaveBeenCalled();
    expect(resyncNow).not.toHaveBeenCalled();
  });
});

// @OB-021 (Daniel 16.10.): Unter 400 px ist die Offline-Marke nur ein Symbol, der Text steht im aria-label und Tooltip
describe('AuthSection — Offline-Marke kompakt unter 400 px (@OB-021)', () => {
  beforeEach(() => { authMock.connectionState = 'offline'; });

  const zeige = () => renderWithResync(
    <AuthSection
      onNavigateToLogin={vi.fn()}
      onNavigateToRegister={vi.fn()}
      onNavigateToProfile={vi.fn()}
      createMatchStore={() => fakeStore(0)}
    />,
  );

  it('unter 400 px: nur Symbol, aria-label und Tooltip tragen den Text, Touch-Ziel ≥ 44 px', () => {
    kopf.kompakt = true;
    zeige();
    const marke = screen.getByTestId('auth-offline-badge');
    expect(marke).not.toHaveTextContent('authSection.offline');
    expect(marke.getAttribute('aria-label')).toBeTruthy();
    expect(marke.getAttribute('title')).toBeTruthy();
    expect(marke.style.minWidth).toBe('var(--touch-target-minimum)');
    expect(marke.style.minHeight).toBe('var(--touch-target-minimum)');
  });

  it('Gegenbeispiel ab 400 px: Marke zeigt weiter ihren Text', () => {
    kopf.kompakt = false;
    zeige();
    expect(screen.getByTestId('auth-offline-badge')).toHaveTextContent('authSection.offline');
  });
});
