/**
 * ManagementTab — Knöpfe ohne Engine-Weg ausblenden (A-08c, @FU-071).
 * Echter Weg: echter `useCockpitExecution` (kein Mock), echtes `LiveCockpit`, echte MatchEngine +
 * LocalMatchStore (fake-indexeddb). ManagementTab übergibt die Handler ohne Engine-Weg nicht mehr.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import { looseVs, testTeamSlot } from '../../../test/matchSlotFixtures';
import { makeEngineContext, FIXTURE_ENGINE_MATCH_ID } from '../../../test/engineContextFixture';
import { MatchCommands } from '../../../core/match/client';
import type { MatchContext, MatchRules } from '../../../core/match';
import type { MatchEngineContextValue } from '../../match-engine/matchEngineContextInstance';
import { emptyOutboxStatus } from '../../../core/match/client/outboxTypes';

const toast = vi.hoisted(() => ({ showWarning: vi.fn(), showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({ useToast: () => toast }));

const engineCtx = vi.hoisted(() => ({ current: null as MatchEngineContextValue | null }));
vi.mock('../../match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => engineCtx.current,
}));

vi.mock('../../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ liveMatchRepository: null, isRealtimeEnabled: false, supabaseLiveMatchRepo: null }),
}));

vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));

vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: {
      id: 'membership-1', userId: 'user-1', tournamentId: 'tournament-1',
      role: 'owner', teamIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    },
    members: [], isLoading: false, error: null,
    checkCanEditMatch: () => true, canEditResults: () => true,
  }),
}));

import { ManagementTab } from '../ManagementTab';

/** Stabiler Snapshot: useSyncExternalStore verlangt dieselbe Referenz, sonst Render-Schleife. */
const EMPTY_OUTBOX = emptyOutboxStatus();

const HOME = { id: 'teama', name: 'Heim' };
const AWAY = { id: 'teamb', name: 'Gast' };
const CTX: MatchContext = { matchId: FIXTURE_ENGINE_MATCH_ID, teamAId: HOME.id, teamBId: AWAY.id };

/** K.-o.-Regeln ohne vorgewählten Tiebreak: Unentschieden -> decision_pending (Auswahl im Banner). */
const KO_RULES: MatchRules = {
  sections: 1, sectionSeconds: 600, breakSeconds: 0, knockout: true, tiebreak: null,
  overtimeSeconds: 300, shootersPerTeam: 5, suddenDeathAfter: 6, penaltySeconds: 120,
};

const tournament = {
  id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1,
  teams: [HOME, AWAY], groupPhaseGameDuration: 20,
  matches: [{ id: FIXTURE_ENGINE_MATCH_ID, ...looseVs(HOME.id, AWAY.id), round: 1, field: 1, matchNumber: 1, phase: 'final' }],
} as unknown as Tournament;

const schedule = {
  tournament: { id: 'tournament-1', title: 'Test-Turnier' },
  teams: [HOME, AWAY],
  allMatches: [{
    id: FIXTURE_ENGINE_MATCH_ID, matchNumber: 1, time: '10:00', field: 1, slot: 1,
    homeTeam: HOME.name, awayTeam: AWAY.name, originalTeamA: HOME.id, originalTeamB: AWAY.id,
    slotA: testTeamSlot(HOME.id), slotB: testTeamSlot(AWAY.id),
    phase: 'final', label: 'Finale', duration: 20,
  }],
  phases: [],
} as unknown as GeneratedSchedule;

function commandsOf(ctx: MatchEngineContextValue): MatchCommands {
  return new MatchCommands({ engine: ctx.engine, store: ctx.store, sender: ctx.sender, accountId: ctx.accountId });
}

describe('ManagementTab — Knöpfe ohne Engine-Weg ausblenden (A-08c, @FU-071)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const ctx = await makeEngineContext();
    // Die Ausgangs-Statusquelle (useOutboxStatus) braucht getStatus/subscribe; die Fixture hat nur kick.
    engineCtx.current = {
      ...ctx,
      sender: { kick: ctx.sender.kick, getStatus: () => EMPTY_OUTBOX, subscribe: () => () => undefined },
    } as unknown as MatchEngineContextValue;
  });

  it('@FU-071 K10: laufendes Engine-Spiel -> „Uhr korrigieren“ steht in „Mehr“ (Engine-Weg B-08d), Klick auf die Spielzeit der Tafel öffnet weiter keinen Dialog', async () => {
    const ctx = engineCtx.current;
    if (!ctx) { throw new Error('Engine-Kontext fehlt'); }
    await commandsOf(ctx).start(FIXTURE_ENGINE_MATCH_ID, CTX, 'leitung', KO_RULES);
    const user = userEvent.setup();

    render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);

    const timer = await screen.findByTestId('scoreboard-clock');
    // K10: seit B-08d hat „Uhr korrigieren“ einen Engine-Weg (CLOCK_ADJUST); ManagementTab muss dafür kein `onAdjustTime` liefern
    await user.click(await screen.findByTestId('cockpit-more-button'));
    expect(screen.getByTestId('mehr-uhr-korrigieren')).toBeInTheDocument();
    await user.click(screen.getByTestId('mehr-schliessen'));

    await user.click(timer);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('@FU-071 Pflicht: K.-o.-Entscheidung (1:1 nach Ende) -> Banner sichtbar, darin keine Knöpfe, kein Strafstoß-Dialog', async () => {
    const ctx = engineCtx.current;
    if (!ctx) { throw new Error('Engine-Kontext fehlt'); }
    const commands = commandsOf(ctx);
    await commands.start(FIXTURE_ENGINE_MATCH_ID, CTX, 'leitung', KO_RULES);
    await commands.goal(FIXTURE_ENGINE_MATCH_ID, CTX, 'leitung', HOME.id, false);
    await commands.goal(FIXTURE_ENGINE_MATCH_ID, CTX, 'leitung', AWAY.id, false);
    await commands.finish(FIXTURE_ENGINE_MATCH_ID, CTX, 'leitung');

    render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);

    const banner = await screen.findByTestId('tiebreaker-banner');
    expect(within(banner).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByTestId('penalty-shootout-dialog')).toBeNull();
  });
});
