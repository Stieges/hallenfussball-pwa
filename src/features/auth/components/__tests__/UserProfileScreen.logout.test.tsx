/**
 * Task C2b, Aufgabe 5: Abmelde-Warnung live in UserProfileScreen.
 * > 0 wartende Eintraege zeigt den Dialog (D-C2); Gast, 0 oder Zaehlfehler
 * melden direkt ab. Die lokalen Kopien werden nie geloescht.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { MatchCopy } from '../../../../core/match/client/matchCopy';
import { LocalMatchStore } from '../../../../core/match/client/LocalMatchStore';
import type { EngineEvent, MatchContext } from '../../../../core/match/types';
import { UserProfileScreen } from '../UserProfileScreen';

const logout = vi.fn();

const authState: { isGuest: boolean } = { isGuest: false };

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'acc-1',
      email: 'helfer@example.de',
      name: 'Helfer Eins',
      globalRole: 'user',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    isGuest: authState.isGuest,
    logout,
    resetPassword: vi.fn(),
  }),
}));

vi.mock('../../hooks/useUserTournaments', () => ({
  useUserTournaments: () => ({
    tournaments: [],
    isLoading: false,
    counts: { total: 0, live: 0 },
  }),
}));

vi.mock('../../../../hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn() }),
}));

vi.mock('../../../../components/ui/Toast', () => ({
  useToast: () => ({ showInfo: vi.fn(), showSuccess: vi.fn(), showError: vi.fn() }),
}));

// GuestBanner braucht den RepositoryProvider (useTournamentLimit) -- fuer den Abmelde-Fluss
// irrelevant, deshalb still gestellt.
vi.mock('../GuestBanner', () => ({ GuestBanner: () => null }));

const CTX: MatchContext = { teamAId: 'team-a', teamBId: 'team-b' };

function ev(id: string): EngineEvent {
  return { id, type: 'GOAL', actor: 'helper', at: 1000, section: 1, clockMs: 0, teamId: 'team-a', payload: {} };
}

function copyWith(pending: string[], acked: string[] = []): MatchCopy {
  return {
    formatVersion: 2,
    accountId: 'acc-1',
    matchId: 'm1',
    ctx: CTX,
    confirmed: [],
    watermarkSeq: 0,
    pending: pending.map(ev),
    acked: acked.map(ev),
    rejected: [],
    review: [],
    updatedAt: 0,
  };
}

function fakeStore(copies: MatchCopy[]) {
  return { forAccount: vi.fn(async () => copies) };
}

async function clickLogout() {
  fireEvent.click(screen.getByRole('button', { name: /Abmelden/ }));
}

describe('UserProfileScreen — Abmelde-Warnung (C2b)', () => {
  beforeEach(() => {
    logout.mockClear();
    authState.isGuest = false;
  });

  it('wartende Eintraege zeigen den Dialog, ohne direkt abzumelden', async () => {
    render(<UserProfileScreen createMatchStore={() => fakeStore([copyWith(['e1', 'e2'])])} />);
    await clickLogout();
    expect(await screen.findByTestId('logout-warning-dialog')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();
  });

  it('Abbrechen meldet nicht ab und schliesst den Dialog', async () => {
    render(<UserProfileScreen createMatchStore={() => fakeStore([copyWith(['e1'])])} />);
    await clickLogout();
    fireEvent.click(await screen.findByTestId('logout-warning-cancel'));
    await waitFor(() => {
      expect(screen.queryByTestId('logout-warning-dialog')).toBeNull();
    });
    expect(logout).not.toHaveBeenCalled();
  });

  it('Trotzdem abmelden meldet ab und die Eintraege bleiben im Store', async () => {
    const store = new LocalMatchStore();
    await store.create('acc-1', 'm1', CTX);
    await store.addPending('acc-1', 'm1', ev('e1'));
    await store.addPending('acc-1', 'm1', ev('e2'));

    render(<UserProfileScreen createMatchStore={() => store} />);
    await clickLogout();
    fireEvent.click(await screen.findByTestId('logout-warning-confirm'));
    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });

    const copy = await store.load('acc-1', 'm1');
    expect(copy?.pending.map((entry) => entry.id)).toEqual(['e1', 'e2']);
  });

  it('ohne wartende Eintraege wird direkt abgemeldet', async () => {
    render(<UserProfileScreen createMatchStore={() => fakeStore([copyWith([], [])])} />);
    await clickLogout();
    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('logout-warning-dialog')).toBeNull();
  });

  it('Zaehlfehler meldet trotzdem ab', async () => {
    const store = { forAccount: vi.fn(async () => Promise.reject(new Error('DB weg'))) };
    render(<UserProfileScreen createMatchStore={() => store} />);
    await clickLogout();
    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('logout-warning-dialog')).toBeNull();
  });

  it('Gast wird direkt abgemeldet', async () => {
    authState.isGuest = true;
    const store = fakeStore([copyWith(['e1'])]);
    render(<UserProfileScreen createMatchStore={() => store} />);
    await clickLogout();
    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    expect(store.forAccount).not.toHaveBeenCalled();
    expect(screen.queryByTestId('logout-warning-dialog')).toBeNull();
  });
});
