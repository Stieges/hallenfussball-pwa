/**
 * Fixrunde 1 (Review I3): das Konto-Dropdown ist der ZWEITE Abmeldeweg neben
 * UserProfileScreen -- D-C2 gilt fuer "Abmelden mit wartenden Eintraegen" allgemein, nicht nur
 * fuer einen Screen. Beide Wege nutzen jetzt useGuardedLogout (siehe UserProfileScreen.logout.test.tsx
 * fuer den anderen Weg).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthSection } from '../AuthSection';

const logout = vi.fn();

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'acc-1', name: 'Helfer Eins', email: 'helfer@example.de' },
    isAuthenticated: true,
    isGuest: false,
    isLoading: false,
    logout,
    connectionState: 'online',
    reconnect: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

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
  beforeEach(() => logout.mockClear());

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
