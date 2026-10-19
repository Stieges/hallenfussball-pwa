/**
 * @OB-029 "Jede Seite lässt sich über ihren Link direkt öffnen" -- Teil Wizard: der Schritt steht in der
 * Adresse (`?step=`), wird gelesen und beim Weiter/Zurück geschrieben. Schritte, die wegen fehlender
 * Pflichtfelder noch nicht erreichbar sind, fallen auf den ersten erreichbaren Schritt zurück.
 * @OB-030 "Neu laden behält Seite und Auswahl" (gleiche Adresse nach dem Laden).
 * Echte useTournamentWizard + echter TournamentCreationService; nur Repository/Auth gemockt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  useTournaments: () => ({ tournaments: [], saveTournament: vi.fn(() => Promise.resolve()) }),
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

function baseTournament(): Tournament {
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


function complete(over: Partial<Tournament>): Tournament {
  return { ...baseTournament(), status: 'draft', publishedAt: undefined, ...over } as unknown as Tournament;
}

function Probe() {
  const location = useLocation();
  return <output data-testid="probe-search">{location.search}</output>;
}

const renderWizard = (initialEntry: string, existing?: Tournament) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ToastProvider>
        <TournamentCreationScreen
          existingTournament={existing}
          onBack={vi.fn()}
          onSave={vi.fn()}
          onNavigateToLogin={vi.fn()}
          onNavigateToRegister={vi.fn()}
          onNavigateToProfile={vi.fn()}
        />
        <Probe />
      </ToastProvider>
    </MemoryRouter>
  );

/** Nummer des Schritts mit aria-current="step" in der Schritt-Leiste (Reiter in Reihenfolge der Schritte). */
const activeStep = (): number => screen.getAllByRole('tab').findIndex((tab) => tab.getAttribute('aria-current') === 'step') + 1;
const stepTab = (n: number): HTMLElement => screen.getAllByRole('tab')[n - 1];
const search = (): string => screen.getByTestId('probe-search').textContent;

beforeEach(() => vi.clearAllMocks());

describe('@OB-029 Wizard: Schritt in der Adresse', () => {
  it.each([1, 2, 3, 4, 5, 6])('@OB-029 Direktaufruf ?step=%i öffnet genau diesen Schritt (Entwurf steht auf Schritt 1)', async (n) => {
    renderWizard(`/?step=${n}`, complete({ lastVisitedStep: 1 }));
    expect(await screen.findAllByRole('tab')).toBeTruthy();
    expect(activeStep()).toBe(n);
  });

  it('@OB-030 Neu laden: ohne ?step= öffnet der zuletzt besuchte Schritt des Entwurfs', async () => {
    renderWizard('/', complete({ lastVisitedStep: 3 }));
    expect(await screen.findAllByRole('tab')).toBeTruthy();
    expect(activeStep()).toBe(3);
  });

  it('@OB-029 Schritt, der wegen Pflichtfeldern nicht erreichbar ist, fällt auf den ersten erreichbaren zurück und die Adresse zieht mit', async () => {
    renderWizard('/?step=4', complete({ title: '', lastVisitedStep: 1 }));
    expect(await screen.findAllByRole('tab')).toBeTruthy();
    expect(activeStep()).toBe(1);
    expect(search()).not.toContain('step=4');
  });

  it('@OB-029 Neuer Entwurf ohne Angaben: ?step=3 fällt auf Schritt 1 zurück', async () => {
    renderWizard('/?step=3');
    expect(await screen.findAllByRole('tab')).toBeTruthy();
    expect(activeStep()).toBe(1);
  });

  it.each(['abc', '0', '9', ''])('@OB-029 Gegenbeispiel: unbekannter Wert ?step=%s wird ignoriert, kein Absturz', async (v) => {
    renderWizard(`/?step=${v}`, complete({ lastVisitedStep: 2 }));
    expect(await screen.findAllByRole('tab')).toBeTruthy();
    expect(activeStep()).toBe(2);
  });

  it('@OB-029 Weiter schreibt den neuen Schritt in die Adresse', async () => {
    renderWizard('/?step=2', complete({ lastVisitedStep: 2 }));
    expect(await screen.findAllByRole('tab')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /(weiter|next)/i }));
    expect(search()).toBe('?step=3');
    expect(activeStep()).toBe(3);
  });

  it('@OB-029 Zurück im Wizard schreibt den vorigen Schritt in die Adresse', async () => {
    renderWizard('/?step=3', complete({ lastVisitedStep: 3 }));
    expect(await screen.findAllByRole('tab')).toBeTruthy();
    const back = screen.getAllByRole('button', { name: /^zurück$|^back$/i });
    fireEvent.click(back[back.length - 1]);
    expect(search()).toBe('?step=2');
    expect(activeStep()).toBe(2);
  });

  it('@OB-029 Klick auf die Schritt-Leiste schreibt den Schritt in die Adresse', async () => {
    renderWizard('/?step=1', complete({ lastVisitedStep: 1 }));
    expect(await screen.findAllByRole('tab')).toBeTruthy();
    fireEvent.click(stepTab(4));
    expect(search()).toBe('?step=4');
  });
});
