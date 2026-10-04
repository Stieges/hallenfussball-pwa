/**
 * B-04a Fixrunde 2 — @W5-004: Zwischenspeichern beim Schrittwechsel lässt ein
 * festgelegtes Turnier festgelegt.
 *
 * Echter Bedienweg: Wizard Schritt 2 mit bestehendem Turnier → Feld ändern →
 * „Weiter" (Schrittwechsel) → saveDraft speichert mit unverändertem Status/publishedAt.
 *
 * Echte useTournamentWizard + echter TournamentCreationService (nicht gemockt).
 * Nur useRepository gemockt: save-Spy, get → Ausgangsturnier.
 *
 * Gegenbeispiel: ein Entwurf (status 'draft', ohne publishedAt) bleibt Entwurf —
 * das Zwischenspeichern legt nicht heimlich fest.
 *
 * Mutation: `tournament.status = 'draft'` in TournamentCreationService.saveDraft
 *           oder `status: 'draft'` im Spread von useTournamentWizard.saveDraft → rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

function draftTournament(): Tournament {
  return {
    ...publishedTournament(),
    status: 'draft',
    publishedAt: undefined,
  } as unknown as Tournament;
}

const renderWizard = (existing: Tournament) =>
  render(
    <MemoryRouter initialEntries={['/?step=2']}>
      <ToastProvider>
        <TournamentCreationScreen
          existingTournament={existing}
          onBack={vi.fn()}
          onSave={vi.fn()}
          onNavigateToLogin={vi.fn()}
          onNavigateToRegister={vi.fn()}
          onNavigateToProfile={vi.fn()}
        />
      </ToastProvider>
    </MemoryRouter>
  );

function changeSomeField(): void {
  const textboxes = screen.queryAllByRole('textbox');
  if (textboxes.length > 0) {
    fireEvent.change(textboxes[0], { target: { value: 'Geänderter Titel' } });
    return;
  }
  const selects = screen.queryAllByRole('combobox');
  if (selects.length > 0) {
    const options = selects[0].querySelectorAll('option');
    if (options.length > 1) {
      fireEvent.change(selects[0], { target: { value: options[1].value } });
      return;
    }
  }
  const radios = screen.queryAllByRole('radio');
  if (radios.length > 1) {
    fireEvent.click(radios[1]);
  }
}

beforeEach(() => vi.clearAllMocks());

describe('B-04a @W5-004 — Zwischenspeichern beim Schrittwechsel', () => {
  it('@W5-004 Zwischenspeichern beim Schrittwechsel lässt ein festgelegtes Turnier festgelegt', async () => {
    const initial = publishedTournament();
    repoSpies.get.mockImplementation(() => Promise.resolve(initial));

    renderWizard(initial);
    changeSomeField();

    fireEvent.click(screen.getByRole('button', { name: /(weiter|next)/i }));

    await waitFor(() => {
      expect(repoSpies.save).toHaveBeenCalled();
    });

    const calls = repoSpies.save.mock.calls;
    const saved = calls[calls.length - 1][0];
    expect(saved.status).toBe('published');
    expect(saved.publishedAt).toBe(initial.publishedAt);
  });

  it('@W5-004 Gegenbeispiel: ein Entwurf bleibt Entwurf beim Zwischenspeichern', async () => {
    const initial = draftTournament();
    repoSpies.get.mockImplementation(() => Promise.resolve(initial));

    renderWizard(initial);
    changeSomeField();

    fireEvent.click(screen.getByRole('button', { name: /(weiter|next)/i }));

    await waitFor(() => {
      expect(repoSpies.save).toHaveBeenCalled();
    });

    const calls = repoSpies.save.mock.calls;
    const saved = calls[calls.length - 1][0];
    expect(saved.status).toBe('draft');
  });
});
