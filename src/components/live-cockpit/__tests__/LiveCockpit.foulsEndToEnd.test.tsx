/**
 * LiveCockpit -- Foul-Zaehler Ende-zu-Ende (C3b-2 F3b2, Fixrunde Aufgabe 5): der Helfer bedient
 * den CardDialog (Gelb-Rot waehlen, "Ohne Details"), die ECHTE Kette laeuft bis zum Zaehler:
 * Dialog -> onCard('YELLOW_RED') -> useEngineCommandWiring.handleCard (mapCardTypeToEngine) ->
 * MatchCommands.card (YELLOW_RED_CARD) -> MatchEngine (fake-indexeddb) -> computeLiveMatches /
 * toLiveMatchView (Adapter) -> LiveCockpit/useFoulCounts.
 *
 * Gemockt (Naht): nur Netz/Sound/Sync-Anzeige/Toast-Kontext/Rolle (`useActorRole` -> 'leitung'),
 * KEIN Mock von Engine, Commands, Wiring, Adapter oder useFoulCounts.
 */
import 'fake-indexeddb/auto';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tournament } from '../../../types/tournament';
import { LocalMatchStore, ClockSync, MatchEngine, MatchCommands } from '../../../core/match/client';
import { serverRules } from '../../../core/match';
import type { MatchEngineContextValue } from '../../../features/match-engine/matchEngineContextInstance';
import { buildValidMatches, computeLiveMatches } from '../../../hooks/engineMatchModel';
import { useEngineCommandWiring, type EngineCommandFallbackHandlers } from '../../../hooks/useEngineCommandWiring';
import { LiveCockpit } from '../LiveCockpit';

vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/cockpit.json')).default;
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      de,
    );
    let text = typeof found === 'string' ? found : key;
    for (const [name, value] of Object.entries(opts ?? {})) {
      text = text.replace(`{{${name}}}`, String(value));
    }
    return text;
  };
  const stable = { t: translate, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});
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
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

const MATCH_ID = 'match-e2e-1';

const tournament = {
  id: 'tour-e2e',
  matches: [{ id: MATCH_ID, teamA: 'teama', teamB: 'teamb', round: 1, field: 1, matchNumber: 1 }],
  teams: [{ id: 'teama', name: 'FC Alpha' }, { id: 'teamb', name: 'SV Beta' }],
  groupPhaseGameDuration: 20,
} as unknown as Tournament;

let accountCounter = 0;

/** Echte Engine + laufendes Spiel (MATCH_START), damit Karten angenommen werden. */
async function makeRunningEngine() {
  const accountId = `acc-fouls-e2e-${(accountCounter += 1)}`;
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(1_790_000_000_000), () => 1_790_000_000_000, {
    get: () => null, set: () => undefined,
  });
  const sender = { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn(), kick: vi.fn().mockResolvedValue(undefined) };
  const engine = new MatchEngine({
    store, clock, sender, fetchConfirmed: () => Promise.resolve({ events: [], newWatermark: 0 }), now: () => 1_790_000_000_000,
  });
  await engine.start(accountId);
  const ctx = { matchId: MATCH_ID, teamAId: 'teama', teamBId: 'teamb' };
  await engine.ensureMatch(MATCH_ID, ctx, tournament.id);
  const commands = new MatchCommands({ engine, store, sender, accountId });
  const rules = serverRules({
    durationMinutes: null, phase: null, groupPhaseDuration: 20, finalRoundDuration: null,
    config: { gamePeriods: 1, halftimeBreak: 0 }, finalsConfig: null,
  });
  await commands.start(MATCH_ID, ctx, 'leitung', rules);
  const context = { engine, store, clock, sender, accountId } as unknown as MatchEngineContextValue;
  return { context, commands, ctx };
}

const fallback = new Proxy({}, {
  get: () => () => Promise.reject(new Error('Altpfad darf in diesem Test nicht laufen')),
}) as EngineCommandFallbackHandlers;

// Referenzstabile Props (neue `[]`/`vi.fn()` je Render wuerden Effekte im Cockpit neu ausloesen).
const STABLE_PROPS = {
  fieldName: 'Feld 1', tournamentName: 'Test-Turnier', tournamentId: tournament.id, upcomingMatches: [],
  onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
  onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
  onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(),
};

function Harness({ context }: { context: MatchEngineContextValue }) {
  const validMatches = useMemo(() => buildValidMatches(tournament), []);
  const compute = useCallback(
    () => computeLiveMatches(context, validMatches, new Set([MATCH_ID]), tournament, new Map()),
    [context, validMatches],
  );
  const [liveMatches, setLiveMatches] = useState(compute);
  // Jede Engine-Aenderung berechnet die Ansicht neu (wie useEngineMatches).
  useEffect(() => context.engine.subscribe(() => setLiveMatches(compute())), [context, compute]);
  const wiring = useEngineCommandWiring(tournament, context, liveMatches, fallback);
  const match = liveMatches.get(MATCH_ID);
  if (!match) {
    return null;
  }
  return <LiveCockpit {...STABLE_PROPS} currentMatch={match} onCard={wiring.handleCard} />;
}

// Testumgebung: Der Timer-Hook (RUNNING) laeuft ueber requestAnimationFrame. Innerhalb von `act`
// (userEvent) fuellt jeder Frame die Act-Queue neu -> Endlosschleife. Der Timer ist hier nicht
// Gegenstand; kein Frame = kein Timer-Tick, Engine/Commands/Adapter/Zaehler bleiben echt.
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LiveCockpit -- Foul-Zaehler Ende-zu-Ende ueber die echte Engine-Kette (F3b2, Aufgabe 5)', () => {
  it('Gelb-Rot fuer Team A im CardDialog -> Zaehler Team A = 1, Team B bleibt 0', async () => {
    const { context } = await makeRunningEngine();
    const user = userEvent.setup();
    render(<Harness context={context} />);
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('0');
    expect(screen.getByTestId('foul-count-away')).toHaveTextContent('0');
    await user.click(screen.getByRole('button', { name: 'Gelb-Rote Karte für FC Alpha' }));
    await user.click(screen.getByRole('button', { name: 'Ohne Details' }));

    await waitFor(() => expect(screen.getByTestId('foul-count-home')).toHaveTextContent('1'));
    expect(screen.getByTestId('foul-count-away')).toHaveTextContent('0');
    // Der Engine-Befehl war wirklich YELLOW_RED_CARD (nicht RED_CARD).
    const log = context.engine.view(MATCH_ID)?.log ?? [];
    expect(log.some((event) => event.type === 'YELLOW_RED_CARD')).toBe(true);
    expect(log.some((event) => event.type === 'RED_CARD')).toBe(false);
  });

  it('Gegenbeispiel: Gelb-Rot fuer Team B zaehlt bei Team B, Team A bleibt 0', async () => {
    const { context } = await makeRunningEngine();
    const user = userEvent.setup();
    render(<Harness context={context} />);

    await user.click(screen.getByRole('button', { name: 'Gelb-Rote Karte für SV Beta' }));
    await user.click(screen.getByRole('button', { name: 'Ohne Details' }));

    await waitFor(() => expect(screen.getByTestId('foul-count-away')).toHaveTextContent('1'));
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('0');
  });

  it('Gegenbeispiel: ein TOR fuer Team A laesst den Zaehler bei 0 (kein Foul)', async () => {
    const { context, commands, ctx } = await makeRunningEngine();
    render(<Harness context={context} />);

    await act(async () => {
      await commands.goal(MATCH_ID, ctx, 'leitung', 'teama', false);
    });

    await waitFor(() => expect(context.engine.view(MATCH_ID)?.log.some((event) => event.type === 'GOAL')).toBe(true));
    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('0');
    expect(screen.getByTestId('foul-count-away')).toHaveTextContent('0');
  });
});
