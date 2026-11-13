/**
 * Befund C-ENTWURF-WIEDEROEFFNEN-LOESCHT-TEAMS, Fixrunde PR #516 (R1) -- @W5-039: Wer den Assistenten verlässt und dasselbe Turnier
 * erneut öffnet, sieht den aktuellen Stand und nicht den vom ersten Öffnen. Sonst würde die erste Änderung den alten Stand als
 * Voll-Ersatz speichern und die Teams, die dazwischen dazukamen, gingen verloren.
 *
 * Ablauf auf Bildschirmebene (die App bleibt über alle Routen gemountet): öffnen -> ändern -> speichern -> verlassen ->
 * (zwischenzeitlich kommen 2 Teams dazu) -> wieder öffnen -> weitere Änderung -> im gespeicherten Stand stehen alle 8 Teams.
 * Ein einfacher Speicher steht für das Repository; echte useTournamentWizard, echter useWizardTournament, echter Screen.
 *
 * Mutation: in useWizardTournament `if (held !== null && held.id !== editingId) { setHeld(null); }` entfernen -> rot.
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
import { useWizardTournament } from '../../../hooks/useWizardTournament';
import { ToastProvider } from '../../../components/ui/Toast';

const AUTOSAVE_TAKT_MS = 10_000;

function mitTeams(anzahl: number): Tournament {
  const teams = Array.from({ length: anzahl }, (_, i) => ({ id: `team-${i + 1}`, name: `Team ${i + 1}`, group: i % 2 === 0 ? 'A' : 'B' }));
  return {
    id: 't1', title: 'Probe-Import', ageClass: 'U13', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic',
    mode: 'classic', groupSystem: 'roundRobin', date: '2030-01-01', timeSlot: '09:00', startDate: '2030-01-01', startTime: '09:00',
    numberOfTeams: anzahl, numberOfFields: 1, numberOfGroups: 2, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2,
    finalRoundGameDuration: 10, finalRoundBreakDuration: 2, breakBetweenPhases: 0,
    placementLogic: [{ id: 'points', enabled: true }, { id: 'goalDifference', enabled: true }, { id: 'goalsFor', enabled: true }],
    teams, matches: [], status: 'draft', isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false,
    resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    finals: { final: true, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    location: { name: 'Halle' }, createdAt: '2026-10-04T08:00:00Z', updatedAt: '2026-10-04T08:00:00Z', lastVisitedStep: 2,
  } as unknown as Tournament;
}

/** Wie die App: der Assistent hängt am Ergebnis von useWizardTournament, die Adresse wechselt zwischen `id` und `null` (Startseite). */
function Buehne({ id }: { id: string | null }) {
  const geladen = useWizardTournament(id, null);
  if (id === null || geladen.status !== 'ready') { return <div data-testid="buehne-leer" />; }
  return (
    <TournamentCreationScreen
      existingTournament={geladen.tournament}
      onBack={vi.fn()}
      onSave={vi.fn()}
      onNavigateToLogin={vi.fn()}
      onNavigateToRegister={vi.fn()}
      onNavigateToProfile={vi.fn()}
    />
  );
}

const zeige = (id: string | null) => (
  <MemoryRouter initialEntries={['/?step=2']}>
    <ToastProvider><Buehne id={id} /></ToastProvider>
  </MemoryRouter>
);

function aendereEtwas(): void {
  const radio = screen.queryAllByRole('radio').find((r) => !(r as HTMLInputElement).checked && r.getAttribute('aria-checked') !== 'true' && !(r as HTMLInputElement).disabled);
  if (radio) { fireEvent.click(radio); }
}

const warten = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
/** Der Schritt lädt nach (lazy); mit falschen Timern in kleinen Schritten warten, bis es etwas zu ändern gibt. */
async function bisSchrittDa(): Promise<void> {
  for (let i = 0; i < 40 && screen.queryAllByRole('radio').length === 0; i++) { await warten(50); }
  expect(screen.queryAllByRole('radio').length).toBeGreaterThan(0);
}

let speicher: Tournament;

beforeEach(() => {
  vi.clearAllMocks();
  speicher = mitTeams(6);
  repoSpies.get.mockImplementation(() => Promise.resolve(structuredClone(speicher)));
  repoSpies.save.mockImplementation((t: Tournament) => { speicher = structuredClone(t); return Promise.resolve(); });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});
afterEach(() => { vi.useRealTimers(); });

describe('@W5-039 Wiederöffnen zeigt den aktuellen Stand', () => {
  it('öffnen, ändern, speichern, verlassen, 2 Teams kommen dazu, wieder öffnen, ändern: im gespeicherten Stand stehen alle 8 Teams', async () => {
    const view = render(zeige('t1'));
    await bisSchrittDa();
    aendereEtwas();
    await warten(AUTOSAVE_TAKT_MS + 100);
    expect(repoSpies.save).toHaveBeenCalledTimes(1);
    expect(speicher.teams).toHaveLength(6);

    view.rerender(zeige(null)); // Zurück zur Startseite
    speicher = { ...speicher, teams: mitTeams(8).teams, numberOfTeams: 8 }; // inzwischen sind 2 Teams dazugekommen
    repoSpies.save.mockClear();

    view.rerender(zeige('t1')); // dasselbe Turnier erneut öffnen
    await bisSchrittDa();
    await warten(AUTOSAVE_TAKT_MS + 100);
    expect(repoSpies.save).not.toHaveBeenCalled(); // Öffnen speichert nichts

    aendereEtwas();
    await warten(AUTOSAVE_TAKT_MS + 100);
    expect(repoSpies.save).toHaveBeenCalledTimes(1);
    expect(speicher.teams).toHaveLength(8);
  });
});
