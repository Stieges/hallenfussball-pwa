/**
 * ManagementTab – B-10a (C-COCKPIT-ENDSTAND-NACH-AUTOENDE): Nach dem Abpfiff von selbst zeigt das Cockpit das abgepfiffene
 * Spiel mit dem Endstand (@SL-073, @SL-152), das nächste Spiel steht darunter, und „Weiter“ wechselt sofort (@SL-162);
 * nach den 30 Sekunden zeigt es von selbst das nächste (@SL-049).
 *
 * Der Kopf (Mocks, Turnier, Plan) stammt aus ManagementTab.ladenNachAbpfiff.test.tsx. Das Cockpit ist ein Stub, der
 * liest, was ManagementTab ihm gibt: gezeigtes Spiel, nächstes Spiel, „Weiter“.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { LiveMatch } from '../../../core/models/LiveMatch';
import type { GeneratedSchedule } from '../../../core/generators';

const mockShowError = vi.fn();
// C3b-1: LiveCockpit bindet useEngineEventEditing ein -> useActorRole (braucht AuthProvider); hier nicht Gegenstand.
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

// Merge Spur A/B: ManagementTab loest seit B-04 Fixrunde 1 (@W2A-030) die Spielregel-Rolle ueber
// useEffectiveTournamentRole auf; das braucht useAuth. Hier nicht Gegenstand.
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));

const mockCaptureFeatureError = vi.fn();
vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => mockCaptureFeatureError(...args),
}));

// Rechte dieses Geräts: Turnierleitung (`leadMatches`) oder Helfer (nur Spielbetrieb)
const rechte = vi.hoisted(() => ({ aktiv: new Set<string>() }));
vi.mock('../../auth/hooks/useCan', () => ({ useCan: (recht: string) => rechte.aktiv.has(recht) }));

vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: (props: { currentMatch?: { id: string } | null; upcomingMatches?: { id: string }[]; onLoadNextMatch?: () => void; istLeitung?: boolean; onKorrigieren?: (matchId: string) => void }) => (
    <div data-testid="cockpit-stub" data-zeigt={props.currentMatch?.id ?? ''} data-naechstes={props.upcomingMatches?.[0]?.id ?? ''} data-leitung={String(props.istLeitung ?? false)} data-korrigieren={String(props.onKorrigieren !== undefined)}>
      <button type="button" data-testid="weiter" onClick={() => { props.onLoadNextMatch?.(); }}>Weiter</button>
      <button type="button" data-testid="korrigieren" onClick={() => { props.onKorrigieren?.(props.currentMatch?.id ?? ''); }}>Korrigieren</button>
    </div>
  ),
}));

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    members: [], isLoading: false, error: null,
    checkCanEditMatch: () => true, canEditResults: () => true,
  }),
}));

const mockGetLiveMatchData = vi.fn<() => Promise<LiveMatch>>();
// Minor 2 (Fixrunde 4): mutable ueber den Testverlauf -- der Reset-Test simuliert einen
// Feld-/Spielwechsel auf ein Spiel, das BEREITS eine Engine-Kopie hat (kein erneuter
// getLiveMatchData-Aufruf noetig).
let mockLiveMatches = new Map<string, LiveMatch>();
vi.mock('../../../hooks/useCockpitExecution', () => ({
  useCockpitExecution: () => ({
    liveMatches: mockLiveMatches,
    loadingStates: { goal: false, card: false, finish: false, undo: false, start: false },
    isAnyLoading: false,
    getLiveMatchData: mockGetLiveMatchData,
    handleStart: vi.fn(), handlePause: vi.fn(), handleResume: vi.fn(), handleFinish: vi.fn(),
    handleForceFinish: vi.fn(), handleGoal: vi.fn(), handleTimePenalty: vi.fn(), handleCard: vi.fn(),
    handleSubstitution: vi.fn(), handleFoul: vi.fn(), handleUndoLastEvent: vi.fn(),
    handleManualEditResult: vi.fn(), handleAdjustTime: vi.fn(), handleReopenMatch: vi.fn(),
    hasRunningMatch: () => undefined,
    handleStartOvertime: vi.fn(), handleStartGoldenGoal: vi.fn(), handleStartPenaltyShootout: vi.fn(),
    handleRecordPenaltyResult: vi.fn(), handleAbortPenaltyShootout: vi.fn(),
    handleUpdateEvent: vi.fn(), handleDeleteEvent: vi.fn(),
  }),
}));

import { ManagementTab } from '../ManagementTab';
import { testTeamSlot } from '../../../test/matchSlotFixtures';
import { MatchEngineContext, type MatchEngineContextValue } from '../../match-engine/matchEngineContextInstance';
import { RouterWrapper } from './routerWrapper';

const HOME = { id: 'team-a', name: 'FC Alpha' };
const AWAY = { id: 'team-b', name: 'SV Beta' };
const T0 = Date.UTC(2026, 9, 21, 15, 0, 0);

const tournament = { id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1, teams: [], matches: [] } as unknown as Tournament;
const spiel = (id: string, nr: number, ergebnis: boolean) => ({
  id, matchNumber: nr, time: `10:${nr}0`, field: 1, slot: nr, homeTeam: HOME.name, awayTeam: AWAY.name,
  originalTeamA: HOME.id, originalTeamB: AWAY.id, slotA: testTeamSlot(HOME.id), slotB: testTeamSlot(AWAY.id),
  phase: 'groupStage', label: 'Gruppenphase', duration: 10, ...(ergebnis ? { scoreA: 2, scoreB: 1 } : {}),
});
const schedule = {
  tournament: { id: 'tournament-1', title: 'Test-Turnier' }, teams: [HOME, AWAY], phases: [],
  allMatches: [spiel('m11', 11, true), spiel('m12', 12, false), spiel('m13', 13, false)],
} as unknown as GeneratedSchedule;

const engineKontext = (abpfiffVor: number | null): MatchEngineContextValue => {
  const finishedAt = Date.now() - (abpfiffVor ?? 0);
  return {
    engine: {
      view: (id: string) => (id === 'm11' && abpfiffVor !== null ? { result: { state: { status: 'finished', finishedAt, baseDecidedBy: 'regular' } } } : null),
      serverNow: () => Date.now(),
      subscribe: () => () => undefined,
    },
  } as unknown as MatchEngineContextValue;
};

const zeigt = (): string | null => screen.getByTestId('cockpit-stub').getAttribute('data-zeigt');
const naechstes = (): string | null => screen.getByTestId('cockpit-stub').getAttribute('data-naechstes');

function zeige(abpfiffVor: number | null) {
  return render(
    <MatchEngineContext.Provider value={engineKontext(abpfiffVor)}>
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />
    </MatchEngineContext.Provider>,
    { wrapper: RouterWrapper },
  );
}

describe('ManagementTab – Endstand nach dem Abpfiff von selbst (B-10a)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rechte.aktiv = new Set(['writeMatchData', 'tournamentSettings', 'leadMatches']);
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(T0);
    mockLiveMatches = new Map<string, LiveMatch>([
      ['m11', { id: 'm11', number: 11, status: 'FINISHED', homeTeam: HOME, awayTeam: AWAY, homeScore: 2, awayScore: 1 } as unknown as LiveMatch],
      ['m12', { id: 'm12', status: 'NOT_STARTED' } as unknown as LiveMatch],
    ]);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('@SL-073 @SL-152 5 Sekunden nach dem Abpfiff zeigt das Cockpit Spiel 11 mit dem Endstand, darunter das nächste Spiel 12', () => {
    zeige(5_000);
    expect(zeigt()).toBe('m11');
    expect(naechstes()).toBe('m12');
  });

  it('@SL-162 „Weiter“ wechselt sofort zu Spiel 12', () => {
    zeige(5_000);
    act(() => { fireEvent.click(screen.getByTestId('weiter')); });
    expect(zeigt()).toBe('m12');
  });

  it('@SL-049 nach den 30 Sekunden zeigt das Cockpit von selbst Spiel 12', () => {
    zeige(5_000);
    act(() => { vi.advanceTimersByTime(26_000); });
    expect(zeigt()).toBe('m12');
  });

  it('Gegenbeispiel: vor 31 Sekunden abgepfiffen zeigt das Cockpit gleich Spiel 12 (kein Endstand von Spiel 11)', () => {
    zeige(31_000);
    expect(zeigt()).toBe('m12');
  });

  it('@SL-159 die Turnierleitung (leadMatches) bekommt das Cockpit als Leitung: kein Helfer-Hinweis „Korrektur über die Turnierleitung“', () => {
    zeige(5_000);
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-leitung', 'true');
  });

  it('@SL-045 Gegenbeispiel: ein Helfer (nur Spielbetrieb) ist keine Leitung und sieht den Hinweis', () => {
    rechte.aktiv = new Set(['writeMatchData']);
    zeige(5_000);
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-leitung', 'false');
  });

  it('@SL-159 die Turnierleitung bekommt den Weg „Korrigieren“; er öffnet die Korrektur von Spiel 11 mit dem Endstand 2:1', () => {
    zeige(5_000);
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-korrigieren', 'true');
    act(() => { fireEvent.click(screen.getByTestId('korrigieren')); });
    expect(screen.getByTestId('cockpit-korrektur-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('cockpit-korrektur-home')).toHaveValue(2);
    expect(screen.getByTestId('cockpit-korrektur-away')).toHaveValue(1);
  });

  it('@HE-043 Gegenbeispiel: ein Helfer bekommt keinen Weg „Korrigieren“, und auch der Aufruf öffnet nichts', () => {
    rechte.aktiv = new Set(['writeMatchData']);
    zeige(5_000);
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-korrigieren', 'false');
    act(() => { fireEvent.click(screen.getByTestId('korrigieren')); });
    expect(screen.queryByTestId('cockpit-korrektur-dialog')).toBeNull();
  });

  it('@SL-163 Olli wählt 12 Sekunden nach dem Abpfiff „Korrigieren“ und lässt die Korrektur 2 Minuten offen: weiter Spiel 11, nicht gewechselt', () => {
    zeige(12_000);
    act(() => { fireEvent.click(screen.getByTestId('korrigieren')); });
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(zeigt()).toBe('m11');
    expect(screen.getByTestId('cockpit-korrektur-dialog')).toBeInTheDocument();
  });

  it('@SL-164 bei Sekunde 28 geöffnet und abgebrochen: der Endstand steht noch 10 Sekunden, danach das nächste Spiel', () => {
    zeige(28_000);
    act(() => { fireEvent.click(screen.getByTestId('korrigieren')); });
    act(() => { vi.advanceTimersByTime(20_000); });
    act(() => { fireEvent.click(screen.getByTestId('cockpit-korrektur-cancel')); });
    act(() => { vi.advanceTimersByTime(9_900); });
    expect(zeigt()).toBe('m11'); // Gegenbeispiel: nicht nach den 2 Sekunden Restzeit
    act(() => { vi.advanceTimersByTime(200); });
    expect(zeigt()).toBe('m12');
  });
});

