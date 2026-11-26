/**
 * @AN-060 – Nach dem Abmelden auf einer Turnierseite landet man auf der Startseite (Weg: das Konto-Menü oben).
 * Aber-Zeile: Warnung vor wartenden Einträgen + „Abbrechen“ → bleibt angemeldet im Turnier.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthSection } from '../AuthSection';

const logout = vi.fn();

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'acc-1', name: 'Olli', email: 'olli@example.de' },
    isAuthenticated: true,
    isGuest: false,
    isLoading: false,
    logout,
    connectionState: 'online',
    reconnect: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('../../../hooks/useCompactHeader', () => ({ useCompactHeader: () => false }));
vi.mock('../../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/contexts/RepositoryContext')>()),
  useRepositories: () => ({ tournamentRepository: {} }),
}));

function fakeStore(waiting: number) {
  const copy = {
    formatVersion: 2 as const, accountId: 'acc-1', matchId: 'm1',
    ctx: { matchId: 'm1', teamAId: 'a', teamBId: 'b' },
    confirmed: [], watermarkSeq: 0,
    pending: Array.from({ length: waiting }, (_, i) => ({
      id: `e${i}`, type: 'GOAL' as const, actor: 'helper' as const, at: 0, section: 1, clockMs: 0, teamId: null, payload: {},
    })),
    acked: [], rejected: [], review: [], updatedAt: 0,
  };
  return { forAccount: vi.fn(async () => (waiting > 0 ? [copy] : [])) };
}

function Ort() {
  return <div data-testid="ort">{useLocation().pathname}</div>;
}

function zeige(waiting: number) {
  return render(
    <MemoryRouter initialEntries={['/tournament/t1/mehr']}>
      <AuthSection
        onNavigateToLogin={vi.fn()}
        onNavigateToRegister={vi.fn()}
        onNavigateToProfile={vi.fn()}
        createMatchStore={() => fakeStore(waiting)}
      />
      <Ort />
    </MemoryRouter>,
  );
}

function abmelden() {
  fireEvent.click(screen.getByTestId('auth-avatar-button'));
  fireEvent.click(screen.getByTestId('auth-logout-button'));
}

describe('AuthSection – nach dem Abmelden zur Startseite (@AN-060)', () => {
  beforeEach(() => logout.mockClear());

  it('@AN-060 Konto-Menü oben: ohne wartende Einträge landet man auf der Startseite, nicht auf „Turnier nicht gefunden“', async () => {
    zeige(0);
    abmelden();
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/));
    expect(screen.queryByText(/Turnier nicht gefunden/)).toBeNull();
  });

  it('@AN-060 Konto-Menü oben: bei wartenden Einträgen erst nach „Trotzdem abmelden“ zur Startseite', async () => {
    zeige(2);
    abmelden();
    expect(await screen.findByTestId('logout-warning-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('ort')).toHaveTextContent('/tournament/t1/mehr');
    fireEvent.click(screen.getByTestId('logout-warning-confirm'));
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('@AN-060 Konto-Menü oben: „Abbrechen“ in der Warnung → keine Navigation, weiter angemeldet', async () => {
    zeige(2);
    abmelden();
    fireEvent.click(await screen.findByTestId('logout-warning-cancel'));
    await waitFor(() => expect(screen.queryByTestId('logout-warning-dialog')).toBeNull());
    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByTestId('ort')).toHaveTextContent('/tournament/t1/mehr');
  });
});
