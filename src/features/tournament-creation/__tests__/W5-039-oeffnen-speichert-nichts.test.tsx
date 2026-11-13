/**
 * Befund C-ENTWURF-WIEDEROEFFNEN-LOESCHT-TEAMS, Schicht B -- @W5-039 (docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md):
 * Das bloße Öffnen des Assistenten ändert nichts am Turnier. Autosave (alle 10 Sekunden), „Weiter“ ohne Änderung und das Schließen
 * des Tabs (`beforeunload`) erzeugen keinen Schreibauftrag; erst eine echte Änderung wird gespeichert -- mit allen Teams.
 *
 * Echte useTournamentWizard + echter TournamentCreationService; nur useRepository ist gemockt (save-Spy).
 *
 * Mutation: `useRef<string>(openedSnapshot)` in useTournamentWizard wieder auf `useRef<string>('')` -> die Öffnen-Tests werden rot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

/** Takt des Autosave im Assistenten (TournamentCreationScreen: 10 000 ms); die Wartezeit des Tests liegt darüber. */
const AUTOSAVE_TAKT_MS = 10_000;
const WARTEZEIT_MS = AUTOSAVE_TAKT_MS + 5_000; // @W5-039: „15 Sekunden warten, ohne etwas einzugeben“

function sechsTeams(): Tournament['teams'] {
  return ['A', 'B', 'C', 'D', 'E', 'F'].map((name, index) => ({ id: `team-${index + 1}`, name: `Team ${name}`, group: index < 3 ? 'A' : 'B' }));
}

function entwurfMitSechsTeams(extra: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1', title: 'Probe-Import', ageClass: 'U13', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic',
    mode: 'classic', groupSystem: 'roundRobin', date: '2030-01-01', timeSlot: '09:00', startDate: '2030-01-01', startTime: '09:00',
    numberOfTeams: 6, numberOfFields: 1, numberOfGroups: 2, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2,
    finalRoundGameDuration: 10, finalRoundBreakDuration: 2, breakBetweenPhases: 0,
    placementLogic: [{ id: 'points', enabled: true }, { id: 'goalDifference', enabled: true }, { id: 'goalsFor', enabled: true }],
    teams: sechsTeams(), matches: [], status: 'draft', isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false,
    resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    location: { name: 'Halle' }, createdAt: '2026-10-04T08:00:00Z', updatedAt: '2026-10-04T08:00:00Z', lastVisitedStep: 2,
    ...extra,
  } as unknown as Tournament;
}

const renderWizard = (existing: Tournament | undefined, step = 2) =>
  render(
    <MemoryRouter initialEntries={[`/?step=${step}`]}>
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

const warten = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.clearAllMocks();
  repoSpies.save.mockResolvedValue(undefined);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});
afterEach(() => { vi.useRealTimers(); });

describe('@W5-039 Öffnen des Assistenten speichert nichts', () => {
  it('15 Sekunden ohne Eingabe: kein Schreibauftrag (Autosave-Takt 10 s)', async () => {
    renderWizard(entwurfMitSechsTeams());
    await warten(WARTEZEIT_MS);
    expect(repoSpies.save).not.toHaveBeenCalled();
  });

  it('„Weiter“ ohne Änderung: kein Schreibauftrag', async () => {
    renderWizard(entwurfMitSechsTeams());
    fireEvent.click(screen.getByRole('button', { name: /(weiter|next)/i }));
    await warten(500);
    expect(repoSpies.save).not.toHaveBeenCalled();
  });

  it('Tab schließen (beforeunload) ohne Änderung: kein Schreibauftrag und keine Rückfrage des Browsers', async () => {
    renderWizard(entwurfMitSechsTeams());
    const event = new Event('beforeunload', { cancelable: true });
    act(() => { window.dispatchEvent(event); });
    await warten(100);
    expect(repoSpies.save).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('veröffentlichtes Turnier mit Ergebnissen (Neuladen): auch hier kein Schreibauftrag', async () => {
    renderWizard(entwurfMitSechsTeams({ status: 'published', publishedAt: '2026-10-01T08:00:00Z' }));
    await warten(WARTEZEIT_MS);
    fireEvent.click(screen.getByRole('button', { name: /(weiter|next)/i }));
    await warten(500);
    expect(repoSpies.save).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: nach einer echten Änderung speichert „Weiter“ -- mit allen 6 Teams', async () => {
    renderWizard(entwurfMitSechsTeams());
    changeSomeField();
    fireEvent.click(screen.getByRole('button', { name: /(weiter|next)/i }));
    await warten(500);
    expect(repoSpies.save).toHaveBeenCalled();
    const saved = repoSpies.save.mock.calls.at(-1)?.[0];
    expect(saved?.teams.map((t) => t.id)).toEqual(sechsTeams().map((t) => t.id));
  });

  it('gegenbeispiel: nach einer echten Änderung speichert der Autosave nach 10 Sekunden -- mit allen 6 Teams', async () => {
    renderWizard(entwurfMitSechsTeams());
    changeSomeField();
    await warten(AUTOSAVE_TAKT_MS + 100);
    expect(repoSpies.save).toHaveBeenCalledTimes(1);
    expect(repoSpies.save.mock.calls[0][0].teams).toHaveLength(6);
    // danach ist der Stand gespeichert: ohne weitere Änderung kein zweiter Auftrag
    await warten(WARTEZEIT_MS);
    expect(repoSpies.save).toHaveBeenCalledTimes(1);
  });

  it('erster Durchgang nach einem Import: Öffnen speichert nichts, die erste Änderung speichert und ergänzt die Vorgaben (sportId) mit allen Teams', async () => {
    const importiert = entwurfMitSechsTeams({ sportId: undefined });
    renderWizard(importiert);
    await warten(WARTEZEIT_MS);
    expect(repoSpies.save).not.toHaveBeenCalled();

    changeSomeField();
    fireEvent.click(screen.getByRole('button', { name: /(weiter|next)/i }));
    await warten(500);
    expect(repoSpies.save).toHaveBeenCalled();
    const saved = repoSpies.save.mock.calls.at(-1)?.[0];
    expect(saved?.sportId).toBeDefined();
    expect(saved?.teams).toHaveLength(6);
  });

  it('Gegenbeispiel neues Turnier (nichts geöffnet): der Entwurf wird wie bisher automatisch angelegt und danach nicht erneut gespeichert', async () => {
    renderWizard(undefined, 1);
    await warten(WARTEZEIT_MS);
    expect(repoSpies.save).toHaveBeenCalledTimes(1);
    await warten(WARTEZEIT_MS);
    expect(repoSpies.save).toHaveBeenCalledTimes(1);
  });
});
