/**
 * C-VERLAENGERUNG-ENDET-SOFORT (Komponente): Das Cockpit bekommt die Ansicht des echten Adapters
 * (Engine-Log → `toLiveMatchView`) und darf die Verlängerung nicht beim Anpfiff selbst beenden.
 * Auto-Ende (Vorgabe an, DEFAULT_MATCH_COCKPIT_SETTINGS) greift erst, wenn die Spielzeit wirklich
 * abgelaufen ist – in der Verlängerung und im Golden Goal nach deren Ende (@DR-019); ein Golden-Goal-Tor beendet vorher (@SL-082).
 * Werte aus dem Gherkin: Halbfinale 1 FC Nord – DJK Berg 1:1, Verlängerung 3 Minuten.
 *
 * B-08b: das Ende von selbst läuft über die Engine (`useAutoSectionEnd`), nicht mehr über `onFinish`: Die Tests lesen
 * deshalb das Log einer echten Engine (aus dem Log des Halbfinales) und zählen dort die Spielenden.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';
import type { LiveMatch } from '../../../core/models/LiveMatch';
import { engineAusLog } from './engineLogFixture';
import {
  HF_CTX,
  OT_KICKOFF_AT,
  OVERTIME_S,
  T0,
  overtimeRunningLog,
  regularTimeDrawLog,
  viewAt,
} from '../../../core/match/client/__tests__/overtimeFixtures';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

function baseProps(match: LiveMatch, handlers: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'Hallencup Süd', tournamentId: 'tour-1',
    currentMatch: match, upcomingMatches: [],
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...handlers,
  };
}

/** Echte Wartezeit, damit die Uhr (requestAnimationFrame) sicher mindestens einmal getickt hat. */
async function letClockTick() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
}

type Log = ReturnType<typeof overtimeRunningLog>;

/** Cockpit mit echter Engine aus dem Log; `enden()` zählt die Spielenden im Log (Regelzeit endete schon einmal). */
async function renderAt(log: Log, now: number) {
  vi.setSystemTime(now);
  const engine = await engineAusLog(log, HF_CTX);
  const enden = (): number => engine.eintraege('MATCH_END').length;
  render(engine.mitEngine(<LiveCockpit {...baseProps(viewAt(log, now))} />));
  return { enden, vorher: enden() };
}

describe('LiveCockpit: Verlängerung endet nicht beim Anpfiff (C-VERLAENGERUNG-ENDET-SOFORT)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('@SL-145 @TM-052 @SL-010: nach dem Anpfiff der Verlängerung läuft das Spiel weiter, das Cockpit pfeift nicht selbst ab', async () => {
    const now = OT_KICKOFF_AT + 2_000;
    const { enden, vorher } = await renderAt(overtimeRunningLog('overtime-then-shootout'), now);
    expect(enden()).toBe(vorher);
    await letClockTick();
    expect(enden()).toBe(vorher);
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('2:58');
  });

  it('@SL-081: die Uhr zeigt die Restzeit der Verlängerung (bei Spielzeit 2:00 noch 01:00)', async () => {
    const now = OT_KICKOFF_AT + 120_000;
    const { enden, vorher } = await renderAt(overtimeRunningLog('overtime-then-shootout'), now);
    await letClockTick();
    expect(enden()).toBe(vorher);
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('1:00');
  });

  it('@TM-052: nach Ablauf der 3 Minuten Verlängerung beendet das Auto-Ende das Spiel genau einmal', async () => {
    const now = OT_KICKOFF_AT + (OVERTIME_S + 1) * 1000;
    const { enden, vorher } = await renderAt(overtimeRunningLog('overtime-then-shootout'), now);
    await waitFor(() => expect(enden()).toBe(vorher + 1));
    await letClockTick();
    expect(enden()).toBe(vorher + 1);
  });

  it('@SL-082 @DR-019: im Golden Goal endet das Spiel vor Ablauf nicht von selbst (nur ein Tor beendet es)', async () => {
    const now = OT_KICKOFF_AT + 120_000;
    const { enden, vorher } = await renderAt(overtimeRunningLog('goldenGoal'), now);
    await letClockTick();
    expect(enden()).toBe(vorher);
    expect(screen.getByTestId('scoreboard-clock-rest')).toHaveTextContent('1:00');
  });

  it('@DR-019 @TM-052: fällt im Golden Goal kein Tor, beendet das Auto-Ende das Spiel nach Ablauf der 3 Minuten genau einmal', async () => {
    const now = OT_KICKOFF_AT + (OVERTIME_S + 1) * 1000;
    const { enden, vorher } = await renderAt(overtimeRunningLog('goldenGoal'), now);
    await waitFor(() => expect(enden()).toBe(vorher + 1));
    await letClockTick();
    expect(enden()).toBe(vorher + 1);
  });

  it('Gegenbeispiel: in der regulären Spielzeit endet das Spiel nach Ablauf weiter automatisch', async () => {
    const now = T0 + 661_000;
    const { enden, vorher } = await renderAt(regularTimeDrawLog('overtime-then-shootout').slice(0, -1), now);
    await waitFor(() => expect(enden()).toBe(vorher + 1));
  });
});
