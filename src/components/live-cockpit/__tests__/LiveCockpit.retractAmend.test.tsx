/**
 * LiveCockpit -- Minus/Rueckgaengig/Loeschen auf RETRACT, Bearbeiten auf AMEND (C3b-1).
 * Echte Engine-Kopie (fake-indexeddb), echte deutsche Texte. Prueft die Bedienung im DOM:
 * Bestaetigung nur beim Loeschen (G4), Ziel-Beschriftung (G1a), Sperren + Hinweise (G1b/G3/G5),
 * G10 (nur geaenderte Felder), Protokoll mit Zurueckgenommenem (G6).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
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
    currentMatch: currentMatch(value), upcomingMatches: [],
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

describe('LiveCockpit -- RETRACT/AMEND (C3b-1)', () => {
  beforeEach(() => { mockActor.current = 'helper'; vi.clearAllMocks(); });

  it('Minus: sofort, ohne Bestaetigung; RETRACT gespeichert, Toast nennt das Ziel', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.pause(MATCH_ID, CTX, 'helper'); // pausiert: die Spieluhr (rAF) laesst das Cockpit sonst dauernd neu rendern
    const user = userEvent.setup();
    renderCockpit(value);

    await user.click(screen.getByTestId('goal-minus-button-home'));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(async () => expect(await pendingOf(value, 'RETRACT')).toHaveLength(1));
    expect(await screen.findByText('Tor Nr. 7 zurückgenommen')).toBeTruthy();
  });

  it('Rueckgaengig: Knopf nennt das Ziel und nimmt es zurueck', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.pause(MATCH_ID, CTX, 'helper'); // pausiert: die Spieluhr (rAF) laesst das Cockpit sonst dauernd neu rendern
    const user = userEvent.setup();
    renderCockpit(value);

    const undo = screen.getByTestId('match-undo-button');
    expect(undo).toHaveAttribute('aria-label', 'Tor Nr. 7 zurücknehmen');
    await user.click(undo);

    await waitFor(async () => expect(await pendingOf(value, 'RETRACT')).toHaveLength(1));
  });

  it('G1b/G3: Helfer, finished -> Rueckgaengig/Minus gesperrt, Hinweistexte sichtbar', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.finish(MATCH_ID, CTX, 'helper');
    renderCockpit(value);

    expect(screen.getByTestId('match-undo-button')).toBeDisabled();
    expect(screen.getByTestId('match-undo-hint')).toHaveTextContent('Korrektur nur durch die Turnierleitung');
    expect(screen.getByTestId('goal-minus-button-home')).toBeDisabled();
    expect(screen.getByTestId('minus-hint-home')).toHaveTextContent('Korrektur nur durch die Turnierleitung');
    expect(screen.getByTestId('goal-hint-home')).toHaveTextContent('Spiel ist beendet – Korrektur über die Turnierleitung');
  });

  it('G1b: Leitung, finished, Karte -> Rueckgaengig deaktiviert mit Leitungs-Text', async () => {
    mockActor.current = 'leitung';
    const { value, commands } = await setup();
    await commands.card(MATCH_ID, CTX, 'leitung', 'teamb', 'YELLOW_CARD', { playerNumber: 3 });
    await commands.finish(MATCH_ID, CTX, 'leitung');
    renderCockpit(value);

    expect(screen.getByTestId('match-undo-button')).toBeDisabled();
    expect(screen.getByTestId('match-undo-hint')).toHaveTextContent('Nach dem Abpfiff nicht direkt zurücknehmbar – Korrektur folgt');
  });

  it('G4: Bestaetigung NUR beim Loeschen -- Dialog fragt, erst "Ja, loeschen" nimmt zurueck', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.pause(MATCH_ID, CTX, 'helper'); // pausiert: die Spieluhr (rAF) laesst das Cockpit sonst dauernd neu rendern
    const user = userEvent.setup();
    renderCockpit(value);

    await user.click(screen.getByTitle('Bearbeiten'));
    await user.click(screen.getByTestId('event-edit-delete'));
    expect(screen.getByText('Ereignis wirklich löschen?')).toBeTruthy();
    expect(await pendingOf(value, 'RETRACT')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Ja, löschen' }));

    await waitFor(async () => expect(await pendingOf(value, 'RETRACT')).toHaveLength(1));
  });

  it('G10: Nummer aendern sendet NUR playerNumber; unveraendert -> nichts; leeren -> clear', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 5 });
    await commands.pause(MATCH_ID, CTX, 'helper'); // pausiert: die Spieluhr (rAF) laesst das Cockpit sonst dauernd neu rendern
    const user = userEvent.setup();
    renderCockpit(value);

    await user.click(screen.getByTitle('Bearbeiten'));
    await user.click(screen.getByTestId('event-edit-save'));
    expect(await pendingOf(value, 'AMEND')).toHaveLength(0);

    await user.click(screen.getByTitle('Bearbeiten'));
    const input = screen.getByTestId('event-edit-number');
    await user.clear(input);
    await user.type(input, '7');
    await user.click(screen.getByTestId('event-edit-save'));
    await waitFor(async () => expect(await pendingOf(value, 'AMEND')).toHaveLength(1));
    expect((await pendingOf(value, 'AMEND'))[0].payload).toEqual({ playerNumber: 7 });

    await user.click(screen.getByTitle('Bearbeiten'));
    await user.clear(screen.getByTestId('event-edit-number'));
    await user.click(screen.getByTestId('event-edit-save'));
    await waitFor(async () => expect(await pendingOf(value, 'AMEND')).toHaveLength(2));
    expect((await pendingOf(value, 'AMEND'))[1].payload).toEqual({ clear: ['playerNumber'] });
  });

  it('G5: Helfer, finished, gesetzte Nummer -> Feld, Speichern und Loeschen gesperrt mit Text', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 5 });
    await commands.finish(MATCH_ID, CTX, 'helper');
    const user = userEvent.setup();
    renderCockpit(value);

    await user.click(screen.getByTitle('Bearbeiten'));
    expect(screen.getByTestId('event-edit-number')).toBeDisabled();
    expect(screen.getByTestId('event-edit-save')).toBeDisabled();
    expect(screen.getByTestId('event-edit-locked')).toHaveTextContent('Korrektur nur durch die Turnierleitung');
    expect(screen.getByTestId('event-edit-delete')).toBeDisabled();
    expect(screen.getByTestId('event-edit-delete-hint')).toHaveTextContent('Korrektur nur durch die Turnierleitung');
  });

  it('G5 Pflicht: Helfer, finished, Tor "Ohne Nr." -> Nummer nachtragen -> AMEND gespeichert, Eintrag nicht mehr offen', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false);
    await commands.finish(MATCH_ID, CTX, 'helper');
    const user = userEvent.setup();
    const { refresh } = renderCockpit(value);
    expect(screen.getByText('⚠️')).toBeTruthy();

    await user.click(screen.getByTitle('Bearbeiten'));
    await user.type(screen.getByTestId('event-edit-number'), '9');
    await user.click(screen.getByTestId('event-edit-save'));
    await waitFor(async () => expect(await pendingOf(value, 'AMEND')).toHaveLength(1));

    refresh();
    expect(screen.queryByText('⚠️')).toBeNull();
  });

  it('G6: zurueckgenommenes Tor im Protokoll durchgestrichen mit "zurueckgenommen", ohne Bearbeiten-Knopf', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.goal(MATCH_ID, CTX, 'helper', 'teamb', false, { playerNumber: 2 });
    await commands.pause(MATCH_ID, CTX, 'helper'); // pausiert: die Spieluhr (rAF) laesst das Cockpit sonst dauernd neu rendern
    const user = userEvent.setup();
    const { refresh } = renderCockpit(value);
    await user.click(screen.getByTestId('goal-minus-button-away'));
    await waitFor(async () => expect(await pendingOf(value, 'RETRACT')).toHaveLength(1));
    refresh();

    const mark = await screen.findByTestId('event-retracted-mark');
    expect(mark).toHaveTextContent('zurückgenommen');
    const row = mark.closest<HTMLElement>('[data-testid="event-row-retracted"]');
    if (!row) { throw new Error('keine Zeile fuer Zurueckgenommenes'); }
    expect(row.style.textDecoration).toContain('line-through');
    expect(within(row).queryByTitle('Bearbeiten')).toBeNull();
    // Das wirksame Tor (Heim) bleibt bearbeitbar; Stand zaehlt nur dieses.
    expect(screen.getAllByTitle('Bearbeiten')).toHaveLength(1);
    expect(screen.getByTestId('score-away')).toHaveTextContent('0');
  });
});
