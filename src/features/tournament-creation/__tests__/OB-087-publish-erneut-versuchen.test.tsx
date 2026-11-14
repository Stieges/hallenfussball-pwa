/**
 * @OB-087 Zeile 6: Olli veröffentlicht ein Turnier, und das Speichern scheitert. Am Hinweis „Turnier konnte nicht veröffentlicht werden“ steht
 * „Erneut versuchen“ (≥ 44 px); ein Tipp wiederholt das Veröffentlichen mit denselben Angaben, ohne dass Olli etwas neu eingibt. Solange der Versuch
 * läuft, ist die Taste gesperrt und arbeitet; ein zweiter Tipp löst nichts doppelt aus. Gelingt es, verschwindet der Hinweis.
 * Echter Bedienweg Schritt 6 -> Vorschau -> „Festlegen“ (Aufbau wie C-festlegen-teilt-nicht); der Assistent ist zustandsbehaftet gestellt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContextType } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import { touchTargets } from '../../../design-tokens';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../test/realDeI18n';

await initRealDeI18n(); // echte Texte: Titel und „Schließen“ kommen aus den Übersetzungen, nicht fest aus dem Bildschirm

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

vi.mock('../../../hooks/useTournamentWizard', async () => {
  const { useState } = await import('react');
  return {
    useTournamentWizard: () => {
      const [scheduleError, setScheduleError] = useState<string | null>(null);
      const formData = { ...baseTournament(), ...spies.wizardOverride };
      return {
        step: 6, formData, visitedSteps: new Set([1, 2, 3, 4, 5, 6]), stepErrors: {}, scheduleError, hasResults: false, lastSavedDataRef: { current: '' },
        setStep: vi.fn(), setFormData: vi.fn(), setScheduleError, updateForm: vi.fn(), handleStepChange: vi.fn(), handleNavigateToStep: vi.fn(),
        canGoNext: () => true, canNavigateToStep: () => true, validateStep: () => [], addTeam: vi.fn(), removeTeam: vi.fn(), updateTeam: vi.fn(),
        movePlacementLogic: vi.fn(), togglePlacementLogic: vi.fn(), reorderPlacementLogic: vi.fn(), handleTournamentTypeChange: vi.fn(),
        handleResetTournament: vi.fn(), createDraftTournament: () => formData, saveDraft: vi.fn(() => Promise.resolve(formData)),
        publishTournament: spies.publishTournament,
      };
    },
  };
});

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


const veroeffentlicht = (): Tournament => ({ ...baseTournament(), id: 't-1', status: 'published', publishedAt: '2026-10-24T09:00:00.000Z' });

async function veroeffentlichenScheitert(): Promise<void> {
  spies.publishTournament.mockRejectedValueOnce(new Error('Speichern fehlgeschlagen: Server nicht erreichbar'));
  renderScreen();
  fireEvent.click(screen.getByTestId('wizard-show-preview'));
  fireEvent.click(await screen.findByTestId('preview-publish'));
  await screen.findByTestId('publish-error-notice');
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.online.value = true;
  spies.wizardOverride = {};
  spies.makeTournamentPublic.mockResolvedValue(null);
  spies.saveTournament.mockResolvedValue(undefined);
  spies.publishTournament.mockImplementation(() => Promise.resolve(veroeffentlicht()));
});

describe('@OB-087 Zeile 6 – „Erneut versuchen“ beim gescheiterten Veröffentlichen', () => {
  it('@OB-087 Zeile 6: scheitert das Speichern, steht „Erneut versuchen“ (≥ 44 px) am Hinweis; ein Tipp wiederholt das Veröffentlichen, bei Erfolg verschwindet der Hinweis', async () => {
    await veroeffentlichenScheitert();
    const hinweis = screen.getByTestId('publish-error-notice');
    expect(hinweis).toHaveTextContent('Turnier konnte nicht veröffentlicht werden');
    expect(hinweis).toHaveTextContent('Speichern fehlgeschlagen: Server nicht erreichbar');
    expect(screen.getByTestId('publish-error-close')).toHaveTextContent('Schließen');
    const taste = screen.getByTestId('publish-error-retry');
    expect(taste).toHaveStyle({ minHeight: touchTargets.minimum });
    expect(spies.publishTournament).toHaveBeenCalledTimes(1);
    expect(spies.onSave).not.toHaveBeenCalled();

    await act(async () => { fireEvent.click(taste); });
    await waitFor(() => { expect(spies.onSave).toHaveBeenCalledTimes(1); });
    expect(spies.publishTournament).toHaveBeenCalledTimes(2); // genau dieselbe Aktion, ohne Neueingabe
    expect(spies.publishTournament.mock.calls[1]).toEqual(spies.publishTournament.mock.calls[0]);
    expect(screen.queryByTestId('publish-error-notice')).toBeNull();
  });

  it('@OB-087 Zeile 6: solange das Veröffentlichen läuft, ist die Taste gesperrt und arbeitet; ein zweiter Tipp löst nichts doppelt aus; scheitert es erneut, steht sie wieder frei da', async () => {
    await veroeffentlichenScheitert();
    let scheitern: (e: Error) => void = () => undefined;
    spies.publishTournament.mockReturnValueOnce(new Promise<Tournament>((_ok, nein) => { scheitern = nein; }));
    const taste = screen.getByTestId('publish-error-retry');
    await act(async () => { fireEvent.click(taste); fireEvent.click(taste); });
    expect(spies.publishTournament).toHaveBeenCalledTimes(2); // ein Versuch, nicht zwei
    expect(screen.getByTestId('publish-error-retry')).toHaveAttribute('aria-busy', 'true');
    await act(async () => { scheitern(new Error('immer noch kein Netz')); });
    expect(screen.getByTestId('publish-error-notice')).toHaveTextContent('immer noch kein Netz');
    expect(screen.getByTestId('publish-error-retry')).not.toHaveAttribute('aria-busy', 'true');
    expect(spies.onSave).not.toHaveBeenCalled();
  });

  it('@OB-087 Zeile 6 Gegenbeispiel: klappt das Veröffentlichen gleich, gibt es weder Hinweis noch Taste', async () => {
    renderScreen();
    fireEvent.click(screen.getByTestId('wizard-show-preview'));
    fireEvent.click(await screen.findByTestId('preview-publish'));
    await waitFor(() => { expect(spies.onSave).toHaveBeenCalledTimes(1); });
    expect(screen.queryByTestId('publish-error-notice')).toBeNull();
    expect(screen.queryByTestId('publish-error-retry')).toBeNull();
  });

  it('@OB-087 Zeile 6: „Schließen“ blendet den Hinweis aus, ohne etwas zu veröffentlichen', async () => {
    await veroeffentlichenScheitert();
    fireEvent.click(screen.getByTestId('publish-error-close'));
    expect(screen.queryByTestId('publish-error-notice')).toBeNull();
    expect(spies.publishTournament).toHaveBeenCalledTimes(1);
  });
});
