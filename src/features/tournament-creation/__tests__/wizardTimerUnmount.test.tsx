/**
 * Wizard-Timer räumen beim Unmount auf (Werkzeugkette, kein Verhalten): `handleStepChange` setzte
 * `setTimeout(() => setSlideDirection(null), 300)` ohne Aufräumen; feuerte der Timer nach Ende der
 * jsdom-Umgebung, meldete Vitest in CI "ReferenceError: window is not defined" (Unhandled Errors).
 *
 * Beweis: Schritt wechseln, sofort unmounten -> kein Timer mehr offen, Vorspulen wirft nichts.
 *
 * Mutation: Cleanup-`useEffect` (clearTimeout im Unmount) in TournamentCreationScreen entfernen -> rot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';

const repoSpies = vi.hoisted(() => ({
  save: vi.fn<(data: Tournament) => Promise<void>>(),
  get: vi.fn<(id: string) => Promise<Tournament | null>>(),
  getAll: vi.fn<() => Promise<Tournament[]>>(),
  delete: vi.fn<(id: string) => Promise<void>>(),
  updateMatches: vi.fn<(id: string, updates: unknown[]) => Promise<void>>(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => repoSpies,
}));

vi.mock('../../../hooks/useTournaments', () => ({
  useTournaments: () => ({ saveTournament: vi.fn(() => Promise.resolve()) }),
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
  generateFullSchedule: () => ({ allMatches: [], warnings: [] }),
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

import { TournamentCreationScreen } from '../../../screens/TournamentCreationScreen';
import { ToastProvider } from '../../../components/ui/Toast';

function publishedTournament(): Tournament {
  return {
    id: 't1',
    title: 'Wintercup',
    ageClass: 'U13',
    sport: 'football',
    sportId: 'football',
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
    placementLogic: [
      { id: 'points', enabled: true },
      { id: 'goalDifference', enabled: true },
      { id: 'goalsFor', enabled: true },
      { id: 'directComparison', enabled: false },
    ],
    teams: [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ],
    matches: [],
    status: 'published',
    publishedAt: '2026-10-01T08:00:00Z',
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    location: { name: 'Halle' },
    createdAt: '2026-10-04T08:00:00Z',
    updatedAt: '2026-10-04T08:00:00Z',
    lastVisitedStep: 2,
  } as unknown as Tournament;
}


const published = publishedTournament();

describe('Wizard-Timer beim Unmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoSpies.get.mockImplementation(() => Promise.resolve(published));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Schrittwechsel, sofort unmounten: kein offener Timer, Vorspulen wirft nicht', () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent): void => { errors.push(e.error); };
    window.addEventListener('error', onError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const view = render(
      <MemoryRouter initialEntries={['/?step=2']}>
        <ToastProvider>
          <TournamentCreationScreen
            existingTournament={published}
            onBack={vi.fn()}
            onSave={vi.fn()}
            onNavigateToLogin={vi.fn()}
            onNavigateToRegister={vi.fn()}
            onNavigateToProfile={vi.fn()}
          />
        </ToastProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /(weiter|next)/i }));
    view.unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
    expect(errors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();

    window.removeEventListener('error', onError);
    consoleError.mockRestore();
  });
});
