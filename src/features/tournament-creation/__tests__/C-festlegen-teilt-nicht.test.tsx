/**
 * C-FESTLEGEN-TEILT-NICHT (@W1-020, @W1-037): Verdrahtung von „Festlegen“ im Bildschirm.
 * Echter Bedienweg Schritt 6 -> Vorschau -> „Festlegen“; Repository ist ein Spy.
 *   (a) angemeldet + online + erstes Festlegen: make_tournament_public mit requireCloud, gespeichert wird der Server-Code
 *   (b) angemeldet + offline: kein Aufruf, kein Warnhinweis
 *   (c) bereits festgelegt und privat: kein Aufruf, bleibt privat
 *   (d) Teilen scheitert: Turnier festgelegt, Hinweis, gespeichert ohne toten Code und privat
 * Mutationen: firstRelease immer true -> (c); mayShare immer true -> (b); saveTournament(releasedTournament) -> (a).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContextType } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';

const spies = vi.hoisted(() => ({
  publishTournament: vi.fn<(override?: unknown) => Promise<Tournament>>(),
  saveTournament: vi.fn<(t: Tournament) => Promise<void>>(),
  makeTournamentPublic: vi.fn<(id: string, options?: { requireCloud?: boolean }) => Promise<{ shareCode: string; createdAt: string } | null>>(),
  onBack: vi.fn(),
  onSave: vi.fn<(t: Tournament) => void>(),
  online: { value: true },
  wizardOverride: {},
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: null,
}));

vi.mock('../../../hooks/useOnlineStatus', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/useOnlineStatus')>()),
  useIsOnline: () => spies.online.value,
}));

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    save: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve()),
    makeTournamentPublic: spies.makeTournamentPublic,
  }),
}));

vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ saveTournament: spies.saveTournament }),
}));

vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

vi.mock('../../../hooks/useTournamentStartState', () => ({
  useTournamentStartState: () => ({
    state: 'not-started',
    recheck: vi.fn(() => Promise.resolve('not-started' as const)),
  }),
}));

// Merge Spur A/B: AuthSection meldet seit A-07c ueber useGuardedLogout ab, der useRepositories() liest
// (Muster wie AuthSection.test.tsx); hier ohne Konto-Queue.
vi.mock('../../../core/contexts/RepositoryContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/contexts/RepositoryContext')>()),
  useRepositories: () => ({ tournamentRepository: {} }),
}));

vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));

vi.mock('../../../core/generators', () => ({
  generateFullSchedule: () => ({
    allMatches: [
      {
        id: 'm1',
        field: 1,
        slot: 1,
        originalTeamA: 'A',
        originalTeamB: 'B',
        phase: 'groupStage',
        startTime: '10:00',
      },
    ],
    warnings: [],
  }),
}));

vi.mock('../../../components/ScheduleDisplay', () => ({
  ScheduleDisplay: () => <div data-testid="schedule-display-stub" />,
}));

vi.mock('../../../components/RefereeAssignmentEditor', () => ({
  RefereeAssignmentEditor: () => <div data-testid="referee-editor-stub" />,
}));

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'user-1', email: 'o@example.org', name: 'Olli' },
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../../features/auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, members: [], isLoading: false }),
}));

const baseTournament = (): Tournament =>
  ({
    id: '',
    title: 'Test Cup',
    ageClass: 'U13',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'roundRobin',
    groupSystem: 'roundRobin',
    date: '2030-01-01',
    timeSlot: '09:00',
    startDate: '2030-01-01',
    startTime: '09:00',
    numberOfTeams: 2,
    numberOfFields: 1,
    numberOfGroups: 1,
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    finalRoundGameDuration: 10,
    finalRoundBreakDuration: 2,
    breakBetweenPhases: 0,
    placementLogic: [],
    teams: [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ],
    matches: [],
    status: 'draft',
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    location: { name: 'Halle' },
    createdAt: '2026-10-04T08:00:00Z',
    updatedAt: '2026-10-04T08:00:00Z',
    lastVisitedStep: 6,
  }) as unknown as Tournament;

vi.mock('../../../hooks/useTournamentWizard', () => ({
  useTournamentWizard: () => {
    const formData = { ...baseTournament(), ...spies.wizardOverride };
    return {
      step: 6,
      formData,
      visitedSteps: new Set([1, 2, 3, 4, 5, 6]),
      stepErrors: {},
      scheduleError: null,
      hasResults: false,
      lastSavedDataRef: { current: '' },
      setStep: vi.fn(),
      setFormData: vi.fn(),
      setScheduleError: vi.fn(),
      updateForm: vi.fn(),
      handleStepChange: vi.fn(),
      handleNavigateToStep: vi.fn(),
      canGoNext: () => true,
      canNavigateToStep: () => true,
      validateStep: () => [],
      addTeam: vi.fn(),
      removeTeam: vi.fn(),
      updateTeam: vi.fn(),
      movePlacementLogic: vi.fn(),
      togglePlacementLogic: vi.fn(),
      reorderPlacementLogic: vi.fn(),
      handleTournamentTypeChange: vi.fn(),
      handleResetTournament: vi.fn(),
      createDraftTournament: () => formData,
      saveDraft: vi.fn(() => Promise.resolve(formData)),
      publishTournament: spies.publishTournament,
    };
  },
}));

import { TournamentCreationScreen } from '../../../screens/TournamentCreationScreen';
import { ToastProvider } from '../../../components/ui/Toast';
import { AuthContext } from '../../auth/context/authContextInstance';

const account = { id: 'user-1', email: 'o@example.org', name: 'Olli', isAnonymous: false, globalRole: 'user' };

function renderScreen() {
  const auth = { user: account } as unknown as ContextType<typeof AuthContext>;
  return render(
    <MemoryRouter initialEntries={['/?step=6']}>
      <AuthContext.Provider value={auth}>
        <ToastProvider>
          <Routes>
            <Route path="/" element={
              <TournamentCreationScreen
                onBack={spies.onBack}
                onSave={spies.onSave}
                onNavigateToLogin={vi.fn()}
                onNavigateToRegister={vi.fn()}
                onNavigateToProfile={vi.fn()}
              />
            } />
          </Routes>
        </ToastProvider>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

async function festlegen(): Promise<void> {
  renderScreen();
  fireEvent.click(screen.getByTestId('wizard-show-preview'));
  fireEvent.click(await screen.findByTestId('preview-publish'));
  await waitFor(() => { expect(spies.onSave).toHaveBeenCalledTimes(1); });
}

const SERVER = { shareCode: 'SERVR2', createdAt: '2026-10-24T10:00:00.000Z' };

beforeEach(() => {
  vi.clearAllMocks();
  spies.online.value = true;
  spies.wizardOverride = {};
  spies.makeTournamentPublic.mockResolvedValue(SERVER);
  spies.saveTournament.mockResolvedValue(undefined);
  // publish() des Dienstes: Erstfestlegen macht teilbar mit lokalem Code, ein festgelegtes Turnier behaelt seine Sichtbarkeit.
  spies.publishTournament.mockImplementation(() => {
    const form = { ...baseTournament(), ...spies.wizardOverride };
    const first = !form.publishedAt;
    return Promise.resolve({
      ...form, id: 't-1', status: 'published', publishedAt: form.publishedAt ?? '2026-10-24T09:00:00.000Z',
      ...(first ? { isPublic: true, shareCode: 'LOCAL1', shareCodeCreatedAt: '2026-10-24T09:00:00.000Z' } : {}),
    } as Tournament);
  });
});

describe('C-FESTLEGEN-TEILT-NICHT — „Festlegen“ im Bildschirm', () => {
  it('@W1-020 (a) angemeldet, online, erstes Festlegen: RPC mit requireCloud, gespeichert wird der Server-Code', async () => {
    await festlegen();

    expect(spies.makeTournamentPublic).toHaveBeenCalledWith('t-1', { requireCloud: true });
    const saved = spies.onSave.mock.calls[0][0];
    expect(saved.shareCode).toBe('SERVR2');
    expect(saved.isPublic).toBe(true);
    expect(spies.onSave.mock.calls[0][0].shareCode).toBe('SERVR2');
    expect(document.body.textContent).not.toContain('publish.shareFailed');
  });

  it('@W1-037 (b) angemeldet, offline: kein Aufruf, kein Warnhinweis, lokaler Code bleibt', async () => {
    spies.online.value = false;

    await festlegen();

    expect(spies.makeTournamentPublic).not.toHaveBeenCalled();
    expect(spies.onSave.mock.calls[0][0].shareCode).toBe('LOCAL1');
    expect(document.body.textContent).not.toContain('publish.shareFailed');
  });

  it('@W5-004 (c) bereits festgelegt und privat: kein Aufruf, bleibt privat', async () => {
    spies.wizardOverride = { publishedAt: '2026-01-01T10:00:00.000Z', isPublic: false, status: 'draft' };

    await festlegen();

    expect(spies.makeTournamentPublic).not.toHaveBeenCalled();
    expect(spies.onSave.mock.calls[0][0].isPublic).toBe(false);
    expect(spies.onSave.mock.calls[0][0].shareCode).toBeUndefined();
  });

  it('@W5-004 (c2) bereits festgelegt und öffentlich (Erweiterte Bearbeitung): kein erneutes Teilen, Code bleibt', async () => {
    spies.wizardOverride = { publishedAt: '2026-01-01T10:00:00.000Z', isPublic: true, shareCode: 'ALT123', status: 'draft' };

    await festlegen();

    expect(spies.makeTournamentPublic).not.toHaveBeenCalled();
    expect(spies.onSave.mock.calls[0][0].shareCode).toBe('ALT123');
  });

  it('@W1-020 (d) Teilen scheitert: Turnier festgelegt, Hinweis, gespeichert privat und ohne toten Code', async () => {
    spies.makeTournamentPublic.mockRejectedValue(new Error('Failed to fetch'));

    await festlegen();

    expect(spies.makeTournamentPublic).toHaveBeenCalledTimes(1);
    const saved = spies.onSave.mock.calls[0][0];
    expect(saved.status).toBe('published');
    expect(saved.isPublic).toBe(false);
    expect(saved.shareCode).toBeUndefined();
    await waitFor(() => {
      expect(screen.getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain('publish.shareFailed');
    });
  });

  it('@W1-023 während des Festlegens ist „Zurück“ gesperrt', async () => {
    let finish: (t: Tournament) => void = () => undefined;
    spies.publishTournament.mockReturnValue(new Promise<Tournament>((resolve) => { finish = resolve; }));
    renderScreen();
    fireEvent.click(screen.getByTestId('wizard-show-preview'));
    fireEvent.click(await screen.findByTestId('preview-publish'));

    await waitFor(() => { expect(screen.getByRole('button', { name: /Zurück/ })).toBeDisabled(); });
    finish({ ...baseTournament(), id: 't-1', status: 'published', publishedAt: '2026-01-01T00:00:00.000Z' });
    await waitFor(() => { expect(spies.onSave).toHaveBeenCalledTimes(1); });
  });
});
