/**
 * B-04 Paket a — @W1-023: „Festlegen" mit Ladezustand und Erfolgsmeldung.
 * Ein Doppelklick erzeugt kein zweites Turnier (genau ein Publish-Aufruf).
 *
 * Echter Bedienweg: Wizard Schritt 6 → Vorschau → „Turnier freigeben" (Festlegen).
 * UI-Ort: src/screens/TournamentCreationScreen.tsx (handlePublish) +
 * src/features/tournament-creation/TournamentPreview.tsx (Button preview-publish).
 *
 * Test:    Doppelklick → genau ein Aufruf, Knopf beim Laden gesperrt, Erfolg sichtbar.
 * Mutation: Sperre entfernen → zwei Aufrufe → rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';

const spies = vi.hoisted(() => ({
  publishTournament: vi.fn<() => Promise<Tournament>>(),
  saveTournament: vi.fn<() => Promise<void>>(),
  onBack: vi.fn(),
  onSave: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

vi.mock('../../../hooks/useRepository', () => ({
  useRepository: () => ({
    save: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
    getAll: vi.fn(() => Promise.resolve([])),
    delete: vi.fn(() => Promise.resolve()),
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
    const formData = baseTournament();
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

function deferred(): { promise: Promise<Tournament>; resolve: (t: Tournament) => void } {
  let resolve!: (t: Tournament) => void;
  const promise = new Promise<Tournament>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/?step=6']}>
      <ToastProvider>
        <TournamentCreationScreen
          onBack={spies.onBack}
          onSave={spies.onSave}
          onNavigateToLogin={vi.fn()}
          onNavigateToRegister={vi.fn()}
          onNavigateToProfile={vi.fn()}
        />
      </ToastProvider>
    </MemoryRouter>
  );

async function openPreview(): Promise<HTMLElement> {
  renderScreen();
  fireEvent.click(screen.getByTestId('wizard-show-preview'));
  const publishButton = await screen.findByTestId('preview-publish');
  return publishButton;
}

beforeEach(() => vi.clearAllMocks());

describe('B-04a @W1-023 — Festlegen mit Ladezustand und Erfolgsmeldung', () => {
  it('Doppelklick auf „Festlegen" löst genau einen Publish aus, sperrt den Knopf und zeigt Erfolg', async () => {
    const pending = deferred();
    spies.publishTournament.mockReturnValue(pending.promise);

    const publishButton = await openPreview();

    // Doppelklick in einem Block: kein Re-Render dazwischen (echter Doppelklick).
    await act(async () => {
      publishButton.click();
      publishButton.click();
    });

    expect(spies.publishTournament).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByTestId('preview-publish')).toBeDisabled();
    });
    expect(screen.getByTestId('preview-publish-loading')).toBeInTheDocument();

    pending.resolve({ ...baseTournament(), status: 'published' });

    await waitFor(() => {
      expect(screen.getByTestId('publish-success')).toBeInTheDocument();
    });
    expect(spies.onSave).toHaveBeenCalledTimes(1);
  });
});
