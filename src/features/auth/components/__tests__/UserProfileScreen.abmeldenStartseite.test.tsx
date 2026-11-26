/**
 * @AN-060 – Nach dem Abmelden auf einer Turnierseite landet man auf der Startseite (Weg: die Profil-Seite).
 * Das Profil wurde von der Turnierseite aus geöffnet; „Zurück“ würde dorthin führen – nach dem Abmelden darf es das nicht.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { UserProfileScreen } from '../UserProfileScreen';

const logout = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'acc-1', email: 'olli@example.de', name: 'Olli', globalRole: 'user',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    },
    isGuest: false,
    logout,
    resetPassword: vi.fn(),
  }),
}));
vi.mock('../../hooks/useUserTournaments', () => ({
  useUserTournaments: () => ({ tournaments: [], isLoading: false, counts: { total: 0, live: 0 } }),
}));
vi.mock('../../../../hooks/useTheme', () => ({ useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }) }));
vi.mock('../../../../components/ui/Toast', () => ({
  useToast: () => ({ showInfo: vi.fn(), showSuccess: vi.fn(), showError: vi.fn() }),
}));
vi.mock('../GuestBanner', () => ({ GuestBanner: () => null }));
vi.mock('../../../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../core/contexts/RepositoryContext')>()),
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

/** Wie in der App: die Turnierseite führt per push zum Profil, „Zurück“ = navigate(-1). */
function zeige(waiting: number) {
  const Profil = () => {
    const navigate = useNavigate();
    return <UserProfileScreen onBack={() => void navigate(-1)} createMatchStore={() => fakeStore(waiting)} />;
  };
  return render(
    <MemoryRouter initialEntries={['/tournament/t1/mehr', '/profile']} initialIndex={1}>
      <Profil />
      <Ort />
    </MemoryRouter>,
  );
}

const abmelden = () => fireEvent.click(screen.getByRole('button', { name: /Abmelden/ }));

describe('UserProfileScreen – nach dem Abmelden zur Startseite (@AN-060)', () => {
  beforeEach(() => logout.mockClear());

  it('@AN-060 Profil-Seite: ohne wartende Einträge landet man auf der Startseite, nicht zurück auf der Turnierseite', async () => {
    zeige(0);
    abmelden();
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/));
    expect(screen.queryByText(/Turnier nicht gefunden/)).toBeNull();
  });

  it('@AN-060 Profil-Seite: bei wartenden Einträgen erst nach „Trotzdem abmelden“ zur Startseite', async () => {
    zeige(1);
    abmelden();
    expect(await screen.findByTestId('logout-warning-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('ort')).toHaveTextContent('/profile');
    fireEvent.click(screen.getByTestId('logout-warning-confirm'));
    await waitFor(() => expect(screen.getByTestId('ort')).toHaveTextContent(/^\/$/));
  });

  it('@AN-060 Profil-Seite: „Abbrechen“ in der Warnung → keine Navigation, weiter angemeldet', async () => {
    zeige(1);
    abmelden();
    fireEvent.click(await screen.findByTestId('logout-warning-cancel'));
    await waitFor(() => expect(screen.queryByTestId('logout-warning-dialog')).toBeNull());
    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByTestId('ort')).toHaveTextContent('/profile');
  });
});
