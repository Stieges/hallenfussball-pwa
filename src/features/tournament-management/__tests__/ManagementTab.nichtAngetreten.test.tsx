/**
 * ManagementTab – „Mehr“ → „Nicht angetreten“ öffnet den Nichtantritt-Dialog (B-12, Review #359 M2).
 * @SL-174 „Wenn Olli unter ‚Mehr‘ ‚Nicht angetreten‘ wählt und im Dialog SG Mitte antippt … Und erst ‚Wertung eintragen‘
 * speichert … Und im Spielplan öffnet ‚Nicht angetreten‘ an Spiel 13 denselben Dialog“.
 * @SL-175 Gegenbeispiel: ein Helfer sieht unter „Mehr“ kein „Nicht angetreten“.
 * Echter Weg: echter `useCockpitExecution`, echtes `LiveCockpit`, echte MatchEngine + LocalMatchStore (fake-indexeddb);
 * die Verdrahtung ManagementTab → `useScheduleForfeit` → `ScheduleForfeitPrompt` ist nicht gemockt.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import { looseVs, testTeamSlot } from '../../../test/matchSlotFixtures';
import { makeEngineContext, FIXTURE_ENGINE_MATCH_ID } from '../../../test/engineContextFixture';
import type { MatchEngineContextValue } from '../../match-engine/matchEngineContextInstance';
import { emptyOutboxStatus } from '../../../core/match/client/outboxTypes';
import { initRealDeI18n } from '../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const toast = vi.hoisted(() => ({ showWarning: vi.fn(), showError: vi.fn(), showSuccess: vi.fn(), showInfo: vi.fn() }));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({ useToast: () => toast }));

const engineCtx = vi.hoisted(() => ({ current: null as MatchEngineContextValue | null }));
vi.mock('../../match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => engineCtx.current,
}));

vi.mock('../../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ liveMatchRepository: null, isRealtimeEnabled: false, supabaseLiveMatchRepo: null }),
}));

const rolle = vi.hoisted(() => ({ leitung: true }));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => (rolle.leitung ? 'leitung' : 'helper') }));
vi.mock('../../auth/hooks/useCan', () => ({
  useCan: (recht: string) => (recht === 'leadMatches' ? rolle.leitung : true),
}));

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
import { RouterWrapper } from './routerWrapper';

/** Stabiler Snapshot: useSyncExternalStore verlangt dieselbe Referenz, sonst Render-Schleife. */
const EMPTY_OUTBOX = emptyOutboxStatus();

const HOME = { id: 'teama', name: 'SG Mitte' };
const AWAY = { id: 'teamb', name: 'TSV West' };

const tournament = {
  id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1,
  teams: [HOME, AWAY], groupPhaseGameDuration: 20,
  matches: [{ id: FIXTURE_ENGINE_MATCH_ID, ...looseVs(HOME.id, AWAY.id), round: 1, field: 1, matchNumber: 13, group: 'A', phase: 'groupStage', matchStatus: 'scheduled' }],
} as unknown as Tournament;

const schedule = {
  tournament: { id: 'tournament-1', title: 'Test-Turnier' },
  teams: [HOME, AWAY],
  allMatches: [{
    id: FIXTURE_ENGINE_MATCH_ID, matchNumber: 13, time: '10:00', field: 1, slot: 1,
    homeTeam: HOME.name, awayTeam: AWAY.name, originalTeamA: HOME.id, originalTeamB: AWAY.id,
    slotA: testTeamSlot(HOME.id), slotB: testTeamSlot(AWAY.id),
    phase: 'groupStage', label: 'Gruppe A', duration: 20,
  }],
  phases: [],
} as unknown as GeneratedSchedule;

function renderTab() {
  return render(
    <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />,
    { wrapper: RouterWrapper },
  );
}

describe('ManagementTab – „Mehr“ → „Nicht angetreten“ (B-12)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    rolle.leitung = true;
    const ctx = await makeEngineContext();
    engineCtx.current = {
      ...ctx,
      sender: { kick: ctx.sender.kick, getStatus: () => EMPTY_OUTBOX, subscribe: () => () => undefined },
    } as unknown as MatchEngineContextValue;
  });

  it('@SL-174 vor dem Anpfiff öffnet „Nicht angetreten“ unter „Mehr“ den Nichtantritt-Dialog; erst „Wertung eintragen“ speichert', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-nicht-angetreten'));

    expect(await screen.findByTestId('forfeit-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('forfeit-choice-A')).toHaveTextContent('SG Mitte nicht angetreten');
    expect(screen.getByTestId('forfeit-choice-B')).toHaveTextContent('TSV West nicht angetreten');
    await user.click(screen.getByTestId('forfeit-choice-A'));
    expect(screen.getByText('Team ist abgereist – auch alle restlichen Spiele werten')).toBeInTheDocument();
    const ctx = engineCtx.current;
    if (!ctx) { throw new Error('Engine-Kontext fehlt'); }
    expect(ctx.engine.view(FIXTURE_ENGINE_MATCH_ID)?.result.state.status).toBe('scheduled'); // noch nichts gespeichert

    await user.click(screen.getByTestId('forfeit-confirm'));

    await vi.waitFor(() => {
      const state = ctx.engine.view(FIXTURE_ENGINE_MATCH_ID)?.result.state;
      expect(state?.status).toBe('finished');
      expect(state?.overrides.at(-1)?.kind).toBe('forfeit');
    });
    expect(screen.queryByTestId('forfeit-dialog')).toBeNull();
  });

  it('@SL-174 „Abbrechen“ im Dialog aus „Mehr“ lässt das Spiel unverändert', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId('cockpit-more-button'));
    await user.click(screen.getByTestId('mehr-nicht-angetreten'));
    await user.click(await screen.findByTestId('forfeit-choice-A'));
    await user.click(screen.getByTestId('forfeit-cancel'));

    expect(screen.queryByTestId('forfeit-dialog')).toBeNull();
    expect(engineCtx.current?.engine.view(FIXTURE_ENGINE_MATCH_ID)?.result.state.status).toBe('scheduled');
  });

  it('@SL-175 Gegenbeispiel: ein Helfer sieht unter „Mehr“ kein „Nicht angetreten“', async () => {
    rolle.leitung = false;
    const user = userEvent.setup();
    renderTab();

    await user.click(await screen.findByTestId('cockpit-more-button'));
    expect(screen.getByTestId('mehr-schliessen')).toBeInTheDocument();
    expect(screen.queryByTestId('mehr-nicht-angetreten')).toBeNull();
  });
});
