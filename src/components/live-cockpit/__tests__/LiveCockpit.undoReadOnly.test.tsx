/**
 * LiveCockpit -- Rueckgaengig unter readOnly auf dem Engine-Weg (@FU-071, A-08d1 A1).
 * Echte Engine-Kopie (fake-indexeddb), echte deutsche Texte. Ohne readOnly: ein Klick erzeugt genau
 * ein RETRACT; mit readOnly: der Knopf ist disabled und ein Klick erzeugt kein RETRACT.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalMatchStore, ClockSync, MatchEngine, MatchCommands, toLiveMatchView, emptyOutboxStatus } from '../../../core/match/client';
import type { Actor, MatchContext, MatchRules } from '../../../core/match';
import { MatchEngineContext, type MatchEngineContextValue } from '../../../features/match-engine/matchEngineContextInstance';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';

// Stabile `t`-Referenz wie in react-i18next (sonst laufen Effekte mit `t` in den Abhaengigkeiten endlos).
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
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: false,
  }),
}));
const mockActor: { current: Actor } = { current: 'helper' };
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => mockActor.current }));

const NOW = 1_790_000_000_000;
const MATCH_ID = 'match-1';
const CTX: MatchContext = { matchId: MATCH_ID, teamAId: 'teama', teamBId: 'teamb' };
const RULES: MatchRules = {
  sections: 2, sectionSeconds: 600, breakSeconds: 60, knockout: false, tiebreak: null,
  overtimeSeconds: 0, shootersPerTeam: 5, suddenDeathAfter: 5, penaltySeconds: 120,
};
let counter = 0;
const STABLE_STATUS = emptyOutboxStatus();

async function setup() {
  const accountId = `acc-cockpit-${(counter += 1)}`;
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(NOW), () => NOW, { get: () => null, set: () => undefined });
  const engine = new MatchEngine({
    store, clock, sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn(), now: () => NOW,
  });
  await engine.start(accountId);
  await engine.ensureMatch(MATCH_ID, CTX);
  const sender = {
    kick: vi.fn().mockResolvedValue(undefined),
    getStatus: () => STABLE_STATUS,
    subscribe: () => () => undefined,
    dismissRejected: vi.fn().mockResolvedValue(undefined),
  };
  const value = { engine, store, clock, sender, accountId } as unknown as MatchEngineContextValue;
  const commands = new MatchCommands({ engine, store, sender: value.sender, accountId });
  await commands.start(MATCH_ID, CTX, 'leitung', RULES);
  return { value, commands };
}

function currentMatch(value: MatchEngineContextValue) {
  const view = value.engine.view(MATCH_ID);
  if (!view) { throw new Error('keine Ansicht'); }
  return toLiveMatchView(
    view.result.state,
    {
      id: MATCH_ID, number: 7, phaseLabel: 'Gruppe', fieldId: 'f1', scheduledKickoff: new Date(NOW).toISOString(),
      homeTeam: { id: 'teama', name: 'FC Alpha' }, awayTeam: { id: 'teamb', name: 'SV Beta' }, version: 0,
    },
    { serverNow: NOW, offsetMs: 0 },
    view.log,
  );
}

function props(value: MatchEngineContextValue, extra: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'T', tournamentId: 'tour-1',
    currentMatch: currentMatch(value), upcomingMatches: [], kannSteuern: true,
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), onUpdateEvent: vi.fn(), onDeleteEvent: vi.fn(), ...extra,
  };
}

function renderCockpit(value: MatchEngineContextValue, extra: Partial<LiveCockpitProps> = {}) {
  const ui = (version: number) => (
    <MatchEngineContext.Provider value={value} key="p">
      <LiveCockpit {...props(value, extra)} data-version={version} />
    </MatchEngineContext.Provider>
  );
  const utils = render(ui(0));
  let version = 0;
  return { ...utils, refresh: () => utils.rerender(ui((version += 1))) };
}

async function pendingOf(value: MatchEngineContextValue, type: string) {
  const copy = await value.store.load(value.accountId, MATCH_ID);
  return copy?.pending.filter((event) => event.type === type) ?? [];
}


describe('LiveCockpit -- Rueckgaengig unter readOnly (@FU-071, A-08d1 A1)', () => {
  beforeEach(() => { mockActor.current = 'helper'; vi.clearAllMocks(); });

  it('@FU-071 @SL-018 Nur-Lesen: keine Daumenleiste und damit kein Rueckgaengig, es entsteht kein RETRACT', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.pause(MATCH_ID, CTX, 'helper'); // pausiert: die Spieluhr (rAF) laesst das Cockpit sonst dauernd neu rendern
    const user = userEvent.setup();
    renderCockpit(value, { kannSteuern: false });

    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByTestId('match-undo-button')).toBeNull();
    await user.click(screen.getByTestId('cockpit-more-button'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await pendingOf(value, 'RETRACT')).toHaveLength(0);
  });

  it('@FU-071 ohne readOnly: Rueckgaengig ist aktiv, ein Klick erzeugt genau ein RETRACT', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.pause(MATCH_ID, CTX, 'helper'); // pausiert: die Spieluhr (rAF) laesst das Cockpit sonst dauernd neu rendern
    const user = userEvent.setup();
    renderCockpit(value);

    const undo = screen.getByTestId('match-undo-button');
    expect(undo).toBeEnabled();
    await user.click(undo);
    await waitFor(async () => expect(await pendingOf(value, 'RETRACT')).toHaveLength(1));
  });
});
