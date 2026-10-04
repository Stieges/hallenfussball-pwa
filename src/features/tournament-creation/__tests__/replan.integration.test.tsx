/**
 * B-02 Paket A – Integrations-Test des Ablaufs @W5-005/@W5-007:
 * Feld hinzufügen → Vorschau mit Endzeit → Bestätigen ersetzt den Plan.
 * Gegenbeispiel: Abbrechen lässt den Plan unverändert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';

const spies = vi.hoisted(() => ({
  publishTournament: vi.fn<(override?: Partial<Tournament>) => Promise<Tournament>>(),
  setFormData: vi.fn(),
  onSave: vi.fn(),
  existing: undefined as Tournament | undefined,
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
  useTournamentStartState: () => 'not-started' as const,
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
    // formData spiegelt die Strukturänderung: Feld hinzufügen (1 → 2)
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
      setFormData: spies.setFormData,
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
    finalRoundGameDuration: 10,
    finalRoundBreakDuration: 2,
    breakBetweenPhases: 0,
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
    lastVisitedStep: 6,
  }) as unknown as Tournament;

const established = (): Tournament => {
  const base = baseTournament();
  return {
    ...base,
    matches: generateFullSchedule(base).allMatches.map((m, index) => ({
      id: m.id,
      round: index + 1,
      field: m.field,
      teamA: m.originalTeamA,
      teamB: m.originalTeamB,
      scheduledTime: m.startTime,
    })),
  };
};

const renderScreen = (existing: Tournament) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <TournamentCreationScreen
          onBack={vi.fn()}
          onSave={spies.onSave}
          existingTournament={existing}
          onNavigateToLogin={vi.fn()}
          onNavigateToRegister={vi.fn()}
          onNavigateToProfile={vi.fn()}
        />
      </ToastProvider>
    </MemoryRouter>
  );

describe('B-02 Paket A – Neuplanen im Wizard mit Vorschau (Integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.existing = established();
    spies.publishTournament.mockImplementation((override?: Partial<Tournament>) =>
      Promise.resolve({ ...spies.existing, ...override } as Tournament)
    );
  });

  it('@W5-005 – Feld hinzufügen → Vorschau mit Endzeit → Bestätigen ersetzt den Plan und veröffentlicht', async () => {
    renderScreen(spies.existing);

    fireEvent.click(screen.getByTestId('wizard-show-preview'));

    const endTime = await screen.findByTestId('replan-end-time');
    expect(endTime).toBeInTheDocument();
    expect(endTime.textContent).toMatch(/\d{2}:\d{2}/);
    expect(screen.getByTestId('replan-confirm')).toBeEnabled();

    fireEvent.click(screen.getByTestId('replan-confirm'));

    await waitFor(() => {
      expect(spies.publishTournament).toHaveBeenCalledWith(
        expect.objectContaining({ matches: expect.any(Array) })
      );
    });
    const override = spies.publishTournament.mock.calls[0][0]!;
    // Der bestätigte Plan ist der neue: Das hinzugefügte Feld wird genutzt
    expect((override.matches ?? []).some((m) => m.field === 2)).toBe(true);
    expect(spies.existing.matches.some((m) => m.field === 2)).toBe(false);
  });

  it('@W5-007 – Gegenbeispiel: Abbrechen lässt den Plan unverändert', async () => {
    renderScreen(spies.existing);

    fireEvent.click(screen.getByTestId('wizard-show-preview'));
    await screen.findByTestId('replan-end-time');

    fireEvent.click(screen.getByTestId('replan-cancel'));

    await waitFor(() => {
      expect(spies.setFormData).toHaveBeenCalledWith(spies.existing);
    });
    expect(spies.publishTournament).not.toHaveBeenCalled();
    expect(spies.onSave).not.toHaveBeenCalled();
  });
});
