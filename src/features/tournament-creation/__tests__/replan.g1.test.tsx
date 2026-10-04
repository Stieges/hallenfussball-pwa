/**
 * G1: handleReplanConfirm prüft den Preview-Status, bevor veröffentlicht wird.
 * Das Panel-Mock löst onConfirm auch bei gesperrtem Button aus.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';

const spies = vi.hoisted(() => ({
  publishTournament: vi.fn<(override?: Partial<Tournament>) => Promise<Tournament>>(),
  onSave: vi.fn(),
  existing: undefined as Tournament | undefined,
  startState: 'started',
  recheck: vi.fn<() => Promise<'not-started' | 'started' | 'unknown'>>(),
  capturedConfirm: undefined as (() => void) | undefined,
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
  useTournaments: () => ({ saveTournament: vi.fn(() => Promise.resolve()) }),
}));

vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => false }));

vi.mock('../../../hooks/useTournamentStartState', () => ({
  useTournamentStartState: () => ({
    state: spies.startState,
    recheck: spies.recheck,
  }),
}));

vi.mock('../../../lib/pdfExporter', () => ({ exportScheduleToPDF: vi.fn() }));

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
  useTournamentMembers: () => ({
    myMembership: null,
    members: [],
    isLoading: false,
  }),
}));

vi.mock('../../../hooks/useTournamentWizard', () => ({
  useTournamentWizard: (t?: Tournament) => {
    const base = t ?? spies.existing;
    if (!base) {
      throw new Error('Test-Setup fehlt: existingTournament');
    }
    const formData = { ...base, numberOfFields: 2 };
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
      saveDraft: vi.fn(() => Promise.resolve(base)),
      publishTournament: spies.publishTournament,
    };
  },
}));

vi.mock('../components/ReplanPanel', () => ({
  ReplanPanel: ({ onConfirm }: { onConfirm: () => void }) => {
    spies.capturedConfirm = onConfirm;
    return <div data-testid="replan-panel-stub" />;
  },
}));

import { TournamentCreationScreen } from '../../../screens/TournamentCreationScreen';
import { ToastProvider } from '../../../components/ui/Toast';

const baseTournament = (): Tournament =>
  ({
    id: 't1',
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
    numberOfTeams: 4,
    numberOfFields: 1,
    numberOfGroups: 1,
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    placementLogic: [],
    teams: [
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
      { id: '3', name: 'C' },
      { id: '4', name: 'D' },
    ],
    matches: [],
    status: 'published',
    publishedAt: '2026-10-04T08:00:00Z',
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    location: { name: 'Halle' },
    createdAt: '2026-10-04T08:00:00Z',
    updatedAt: '2026-10-04T08:00:00Z',
  }) as unknown as Tournament;

const renderScreen = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <TournamentCreationScreen existingTournament={spies.existing} onBack={vi.fn()} onSave={spies.onSave} />
      </ToastProvider>
    </MemoryRouter>
  );

describe('G1 – Status-Prüfung in handleReplanConfirm', () => {
  beforeEach(() => {
    spies.publishTournament.mockReset();
    spies.recheck.mockReset();
    spies.capturedConfirm = undefined;
    spies.existing = baseTournament();
    spies.startState = 'started';
  });

  it('veröffentlicht nichts, wenn die Vorschau refused ist', async () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('wizard-show-preview'));
    expect(screen.getByTestId('replan-panel-stub')).toBeInTheDocument();
    spies.capturedConfirm?.();
    await waitFor(() => {
      expect(spies.recheck).not.toHaveBeenCalled();
    });
    expect(spies.publishTournament).not.toHaveBeenCalled();
  });
});
