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
// B-50 N1: Klärungsliste der Turnierleitung (verworfene Einträge für den Verlauf des Spiels)
const mockReviews: { current: unknown[] } = { current: [] };
vi.mock('../../../core/repositories/matchReviewsRpc', () => ({ readMatchReviews: () => Promise.resolve({ ok: true, reviews: mockReviews.current }) }));
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

describe('LiveCockpit -- RETRACT/AMEND (C3b-1)', () => {
  beforeEach(() => { mockActor.current = 'helper'; vi.clearAllMocks(); });

  // Aufgabe 3.3: Der Minus-Knopf entfaellt (@SL-037), Tor zuruecknehmen geht ueber „Rueckgaengig“ -- gleiche Erwartung (RETRACT, Meldung).
  it('Rueckgaengig: sofort, ohne Bestaetigung; RETRACT gespeichert, Meldung nennt das Ziel', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.pause(MATCH_ID, CTX, 'helper'); // pausiert: die Spieluhr (rAF) laesst das Cockpit sonst dauernd neu rendern
    const user = userEvent.setup();
    renderCockpit(value);

    expect(screen.queryByTestId('goal-minus-button-home')).toBeNull();
    await user.click(screen.getByTestId('match-undo-button'));

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
    // sichtbarer Text „Rückgängig“ (passt in die schmale Zelle), zugänglicher Name nennt das Ziel und enthält den sichtbaren Text (WCAG 2.5.3)
    expect(undo).toHaveAccessibleName('Rückgängig: Tor Nr. 7 zurücknehmen');
    await user.click(undo);

    await waitFor(async () => expect(await pendingOf(value, 'RETRACT')).toHaveLength(1));
  });

  it('G1b/G3 @SL-045 @HE-043: Helfer, finished -> kein Rueckgaengig, stehende Zeile „Spiel ist beendet – Korrektur über die Turnierleitung“, keine Tor-Taste', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.finish(MATCH_ID, CTX, 'helper');
    renderCockpit(value);

    expect(screen.queryByTestId('match-undo-button')).toBeNull();
    expect(screen.getByTestId('bar-finished')).toHaveTextContent('Spiel ist beendet – Korrektur über die Turnierleitung');
    // Nach dem Abpfiff keine Tor-Taste und kein Minus-Knopf (@SL-113, @SL-037)
    expect(screen.queryByTestId('goal-minus-button-home')).toBeNull();
    expect(screen.queryByTestId('goal-button-home')).toBeNull();
  });

  it('G1b @SL-159 (B-10a2): Leitung, finished, Karte -> kein Rueckgaengig, kein Helfer-Hinweis und auch nicht mehr „Korrektur folgt“ (die Leitung hat „Korrigieren“)', async () => {
    mockActor.current = 'leitung';
    const { value, commands } = await setup();
    await commands.card(MATCH_ID, CTX, 'leitung', 'teamb', 'YELLOW_CARD', { playerNumber: 3 });
    await commands.finish(MATCH_ID, CTX, 'leitung');
    renderCockpit(value, { istLeitung: true, onKorrigieren: vi.fn() });

    expect(screen.queryByTestId('match-undo-button')).toBeNull();
    expect(screen.queryByTestId('bar-finished')).toBeNull();
    expect(screen.queryByTestId('match-undo-hint')).toBeNull();
    expect(screen.queryByText(/Korrektur folgt/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Korrigieren' })).toBeInTheDocument();
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
    await user.click(screen.getByTestId('match-undo-button')); // letztes Ereignis: das Gast-Tor
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
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('1:0');
  });
});

describe('B-50 @FU-095 / B6.3: verworfene Klärungseinträge im Verlauf des Spiels (Cockpit der Turnierleitung)', () => {
  const verworfen = {
    eventId: 'tor-tom-verworfen', matchId: MATCH_ID, matchNumber: 7, field: 1, kind: 'review', reason: 'CONTROL_LOST',
    detail: { timing: 'after' }, receivedAt: NOW, author: 'Tom', deviceLabel: 'Handy',
    entry: { type: 'GOAL', teamId: 'teamb', section: 1, clockMs: 120_000, payload: { playerNumber: 9 }, targetId: null, deviceAt: NOW },
    decision: { type: 'REVIEW_DISCARD', eventId: 'd1', at: new Date(2026, 10, 28, 12, 10).getTime(), by: 'Olli' },
  };
  beforeEach(() => { mockReviews.current = [verworfen]; });

  it('Olli sieht Toms verworfenes Tor im Protokoll „verworfen von Olli, 12:10“; der Stand bleibt 1:0', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.pause(MATCH_ID, CTX, 'helper');
    renderCockpit(value, { istLeitung: true });
    const mark = await screen.findByTestId('event-discarded-mark');
    expect(mark).toHaveTextContent('verworfen von Olli, 12:10');
    expect(screen.getByTestId('scoreboard-score')).toHaveTextContent('1:0');
  });

  it('Gegenbeispiel: Helfer Tom sieht keinen verworfenen Klärungseintrag im Protokoll', async () => {
    const { value, commands } = await setup();
    await commands.goal(MATCH_ID, CTX, 'helper', 'teama', false, { playerNumber: 7 });
    await commands.pause(MATCH_ID, CTX, 'helper');
    renderCockpit(value, { istLeitung: false });
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    expect(screen.queryByTestId('event-discarded-mark')).toBeNull();
  });
});

