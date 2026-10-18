/**
 * ManagementTab → LiveCockpit: Ereignis-Darstellung über den ECHTEN Engine-Weg (A-08d2b, Auflage B1).
 *
 * Die Ereignisse entstehen über `MatchCommands` in einer echten MatchEngine (Fixture
 * `src/test/engineSpielFixture.ts`), die Ansicht über `computeLiveMatches`. Das Cockpit liest die
 * Mannschaft über `teamId` (Laufzeitformat der Engine-Ansicht); es gibt keine Umrechnung mehr.
 *
 * Geprüft wird: Foulzähler, Ereignis-Log und Kopf des Bearbeiten-Dialogs nennen die richtige
 * Mannschaft. Das Verdrahtungsstück ManagementTab → LiveCockpit wird echt gerendert.
 *
 * i18n: Seit Aufgabe 3.3 echte deutsche Texte (`initRealDeI18n`), weil der Foul-Zähler der Team-Spalte „Foul n/Grenze“ als Text trägt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManagementTab } from '../ManagementTab';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import type { LiveMatch as CoreLiveMatch } from '../../../core/models/LiveMatch';
import { testTeamSlot, looseVs } from '../../../test/matchSlotFixtures';
import { einrichtenEngineSpiel, anpfiffEngineSpiel, type EingerichtetesEngineSpiel } from '../../../test/engineSpielFixture';
import { buildValidMatches, computeLiveMatches } from '../../../hooks/engineMatchModel';
import type { MatchCommands } from '../../../core/match/client';
import type { MatchContext } from '../../../core/match';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

// Kein Ton im jsdom (IndexedDB/AudioContext).
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

// P7 (Fixrunde 3): ManagementTab braucht den App-weiten `useToast` -- ohne <ToastProvider> wirft er.
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

// Keine Mitgliedschafts-Abfrage (Supabase) -- ohne Membership erlaubt ManagementTab die Bearbeitung.
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));

vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, members: [], isLoading: false, error: null }),
}));

// A4 (C-SYNC): SyncStatusIndicator braucht RepositoryContext; isCloudSyncAvailable:false spiegelt das wider.
// C3b-1: LiveCockpit bindet useEngineEventEditing ein -> useActorRole (braucht AuthProvider).
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));

// Spiel-Zustand kommt als Map direkt aus dem Hook, so wie ihn der Engine-Weg liefert.
const liveMatches = new Map<string, CoreLiveMatch>();

vi.mock('../../../hooks/useCockpitExecution', () => ({
  useCockpitExecution: () => ({
    liveMatches,
    getLiveMatchData: vi.fn(),
    hasRunningMatch: () => undefined,
    handleStart: vi.fn(), handlePause: vi.fn(), handleResume: vi.fn(), handleFinish: vi.fn(),
    handleGoal: vi.fn(), handleTimePenalty: vi.fn(), handleCard: vi.fn(),
    handleSubstitution: vi.fn(), handleFoul: vi.fn(),
  }),
}));

const HOME = { id: 'teama', name: 'FC Alpha' };
const AWAY = { id: 'teamb', name: 'SV Beta' };

interface Aufbau {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  spiel: EingerichtetesEngineSpiel;
}

/** Engine-Spiel mit Anpfiff, Turnier und Plan um dieses Spiel herum. */
async function aufbauen(): Promise<Aufbau> {
  const spiel = await einrichtenEngineSpiel();
  const matchId = spiel.matchId;
  const tournament = {
    id: 'tournament-1',
    title: 'Test-Turnier',
    numberOfFields: 1,
    teams: [HOME, AWAY],
    matches: [{ id: matchId, ...looseVs(HOME.id, AWAY.id), round: 1, field: 1, matchNumber: 1 }],
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
  const schedule = {
    tournament: { id: 'tournament-1', title: 'Test-Turnier' },
    teams: [HOME, AWAY],
    allMatches: [
      {
        id: matchId,
        matchNumber: 1,
        time: '10:00',
        field: 1,
        slot: 1,
        homeTeam: HOME.name,
        awayTeam: AWAY.name,
        originalTeamA: HOME.id,
        originalTeamB: AWAY.id,
        slotA: testTeamSlot(HOME.id),
        slotB: testTeamSlot(AWAY.id),
        phase: 'groupStage',
        label: 'Gruppenphase',
        duration: 10,
      },
    ],
    phases: [],
  } as unknown as GeneratedSchedule;
  const gestartet = await anpfiffEngineSpiel(spiel, tournament, { phase: 'groupStage' });
  return { tournament, schedule, spiel: gestartet };
}

/** Engine-Ansicht des Spiels in die Map des gemockten Hooks legen (wie `useEngineMatches`). */
function ansichtUebergeben(aufbau: Aufbau): void {
  const { spiel, tournament } = aufbau;
  const view = computeLiveMatches(spiel.value, buildValidMatches(tournament), new Set([spiel.matchId]), tournament, new Map());
  liveMatches.clear();
  for (const [id, match] of view) {
    liveMatches.set(id, match);
  }
}

async function ereignis(
  spiel: EingerichtetesEngineSpiel,
  aktion: (cmd: MatchCommands, ctx: MatchContext, matchId: string) => Promise<unknown>,
): Promise<void> {
  await aktion(spiel.commands, spiel.ctx, spiel.matchId);
}

function renderTab(aufbau: Aufbau): void {
  render(
    <ManagementTab
      tournament={aufbau.tournament}
      schedule={aufbau.schedule}
      onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()}
    />
  );
}

describe('ManagementTab → LiveCockpit: Ereignis-Darstellung über den Engine-Weg (B1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatches.clear();
  });

  it('Foulzähler liest die Mannschaft aus teamId der Engine-Ansicht', async () => {
    const aufbau = await aufbauen();
    await ereignis(aufbau.spiel, (cmd, ctx, id) => cmd.foul(id, ctx, 'leitung', HOME.id));
    await ereignis(aufbau.spiel, (cmd, ctx, id) => cmd.foul(id, ctx, 'leitung', HOME.id));
    await ereignis(aufbau.spiel, (cmd, ctx, id) => cmd.foul(id, ctx, 'leitung', AWAY.id));
    ansichtUebergeben(aufbau);

    renderTab(aufbau);

    expect(screen.getByTestId('team-fouls-home')).toHaveTextContent(/Foul 2/);
    expect(screen.getByTestId('team-fouls-away')).toHaveTextContent(/Foul 1/);
  });

  it('Ereignis-Log nennt beide Mannschaften richtig, nicht zweimal den Gast', async () => {
    const aufbau = await aufbauen();
    await ereignis(aufbau.spiel, (cmd, ctx, id) => cmd.goal(id, ctx, 'leitung', HOME.id, false));
    await ereignis(aufbau.spiel, (cmd, ctx, id) => cmd.goal(id, ctx, 'leitung', AWAY.id, false));
    await ereignis(aufbau.spiel, (cmd, ctx, id) => cmd.pause(id, ctx, 'leitung'));
    ansichtUebergeben(aufbau);

    renderTab(aufbau);

    expect(screen.getAllByText(/FC Alpha/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SV Beta/).length).toBeGreaterThan(0);
  });

  it('Kopf des Bearbeiten-Dialogs nennt die Mannschaft des Ereignisses, nicht "Team"', async () => {
    const aufbau = await aufbauen();
    await ereignis(aufbau.spiel, (cmd, ctx, id) => cmd.goal(id, ctx, 'leitung', HOME.id, false));
    await ereignis(aufbau.spiel, (cmd, ctx, id) => cmd.pause(id, ctx, 'leitung'));
    ansichtUebergeben(aufbau);
    const user = userEvent.setup();

    renderTab(aufbau);
    await user.click(screen.getByTitle('Bearbeiten'));

    expect(screen.getByText(/^FC Alpha · \d{2}:\d{2}$/)).toBeInTheDocument();
  });
});
