/**
 * A-07c (@FU-006, Pflichttest echter Weg): Abmelden in UserProfileScreen mit echtem useGuardedLogout,
 * echtem i18n (DE) und zwei Ausgaengen: Weg A = Fake-LocalMatchStore mit 2 wartenden Eintraegen,
 * Weg B = Konto-Queue-Fake mit 1 wartenden Eintrag. Der Dialog zaehlt 3 und zeigt den Titel
 * "3 Einträge noch nicht übertragen". Bestaetigen meldet einmal ohne Argumente ab.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import type { ReactElement } from 'react';
import deCommon from '../../../../i18n/locales/de/common.json';
import type { MatchCopy } from '../../../../core/match/client/matchCopy';
import type { EngineEvent, MatchContext } from '../../../../core/match/types';
import { UserProfileScreen } from '../UserProfileScreen';

vi.unmock('i18next');
vi.unmock('react-i18next');

const logout = vi.fn();
const repoState = vi.hoisted((): { repo: unknown } => ({ repo: {} }));

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
    isGuest: false,
    logout,
    resetPassword: vi.fn(),
  }),
}));

vi.mock('../../../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../core/contexts/RepositoryContext')>()),
  useRepositories: () => ({ tournamentRepository: repoState.repo }),
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

vi.mock('../GuestBanner', () => ({ GuestBanner: () => null }));

const CTX: MatchContext = { matchId: 'm1', teamAId: 'team-a', teamBId: 'team-b' };

function ev(id: string): EngineEvent {
  return { id, type: 'GOAL', actor: 'helper', at: 1000, section: 1, clockMs: 0, teamId: 'team-a', payload: {} };
}

function copyWith(pending: string[]): MatchCopy {
  return {
    formatVersion: 2,
    accountId: 'acc-1',
    matchId: 'm1',
    ctx: CTX,
    confirmed: [],
    watermarkSeq: 0,
    pending: pending.map(ev),
    acked: [],
    rejected: [],
    review: [],
    updatedAt: 0,
  };
}

async function renderDe(ui: ReactElement) {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng: 'de',
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common'],
    resources: { de: { common: deCommon } },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return render(<I18nextProvider i18n={instance}>{ui}</I18nextProvider>);
}

describe('UserProfileScreen — Abmelde-Warnung zaehlt beide Ausgaenge (A-07c, DE)', () => {
  beforeEach(() => {
    logout.mockClear();
    repoState.repo = {};
  });

  it('Weg A (2) + Weg B (1): Titel "3 Einträge noch nicht übertragen", kein Abmelden vor Bestaetigung', async () => {
    repoState.repo = { mutationQueue: { getPendingCount: () => 1 } };
    const localStore = { forAccount: vi.fn(async () => [copyWith(['e1', 'e2'])]) };
    await renderDe(<UserProfileScreen createMatchStore={() => localStore} />);

    fireEvent.click(screen.getByRole('button', { name: /Abmelden/ }));

    expect(await screen.findByTestId('logout-warning-dialog')).toBeInTheDocument();
    expect(screen.getByText('3 Einträge noch nicht übertragen')).toBeInTheDocument();
    expect(logout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('logout-warning-confirm'));
    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    expect(logout).toHaveBeenCalledWith();
  });

  it('0 + 0: direkt abgemeldet, kein Dialog', async () => {
    repoState.repo = { mutationQueue: { getPendingCount: () => 0 } };
    const localStore = { forAccount: vi.fn(async () => [copyWith([])]) };
    await renderDe(<UserProfileScreen createMatchStore={() => localStore} />);

    fireEvent.click(screen.getByRole('button', { name: /Abmelden/ }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('logout-warning-dialog')).toBeNull();
  });
});
