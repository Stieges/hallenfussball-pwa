/**
 * A-08f3e3 (Plan A-08f3 v4 § 3, M-1): wartende und nicht übernommene Einträge im Kopf der Turnierverwaltung,
 * also auch im Spielplan. Echter Store/Engine/Sender (Server-RPC gemockt), echte DE-Texte.
 * Szenarien: @FU-002 („1 Eintrag wartet“), @FU-004 (Übertragung gescheitert sichtbar), @FU-080.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, within } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, lastSyncedAt: undefined, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(), isCloudSyncAvailable: true, queueLastFailure: null,
  }),
}));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ToastProvider } from '../../../../components/ui/Toast';
import { MatchCommands } from '../../../../core/match/client';
import type { AppendableEvent, AppendResult } from '../../../../core/repositories/appendMatchEventsRpc';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import { RULES } from '../../../../core/match/client/__tests__/fixtures';
import { FC_NORD, NOW, SPIEL_9, SV_SUED, makeScheduleEngine, settle, type ScheduleEngine } from '../../../../test/scheduleEngineHarness';
import { EngineOutboxHeaderStatus } from '../EngineOutboxHeaderStatus';

await initRealDeI18n();

const CTX_9 = { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD };

function commandsOf(h: ScheduleEngine) {
  return new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
}

function mount(h: ScheduleEngine) {
  return render(
    <ToastProvider><MatchEngineContext.Provider value={h.value}><EngineOutboxHeaderStatus tournamentId="T" /></MatchEngineContext.Provider></ToastProvider>,
  );
}

/** Wieder Netz: der Server lehnt mit den angegebenen Codes ab (in Reihenfolge der gesendeten Einträge). */
function serverRejects(h: ScheduleEngine, codes: string[]) {
  h.api.mockImplementation(async (_matchId: string, events: readonly AppendableEvent[]): Promise<AppendResult> => ({
    results: events.map((event, index) => ({ id: event.id, status: 'rejected', code: codes[index] ?? codes[codes.length - 1] })),
    state: null,
    serverTime: 1,
  }));
}

describe('A-08f3e3 Hinweis im Kopf der Turnierverwaltung', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine('olli-kopf', { offline: true });
    await h.engine.ensureMatch(SPIEL_9, CTX_9, 'T');
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('@FU-002 Eigentümer offline 3:1 → Kopf zeigt „1 Eintrag wartet“', async () => {
    await commandsOf(h).enterResult(SPIEL_9, CTX_9, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 1 });
    const view = mount(h);
    await act(async () => { await settle(); });

    expect(view.getByTestId('sync-status').getAttribute('aria-label')).toMatch(/^1 Eintrag wartet/);
  });

  it('M-1/@FU-004: Offline-Eintrag, inzwischen hat ein Helfer angepfiffen → beim Senden abgelehnt, Hinweis mit Grund, Spiel zeigt den Server-Stand', async () => {
    await commandsOf(h).enterResult(SPIEL_9, CTX_9, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 1 });
    const view = mount(h);
    await act(async () => { await settle(); });

    serverRejects(h, ['INVALID_TRANSITION']);
    h.fetchConfirmed.mockResolvedValueOnce({
      events: [{ id: 'start', type: 'MATCH_START', actor: 'helper', at: NOW - 60_000, section: 1, clockMs: 0, teamId: null, payload: { rules: RULES }, seq: 1 }],
      newWatermark: 1,
    });
    await act(async () => { await h.sender.kick(); await h.engine.catchUp(SPIEL_9); await settle(); });

    const badge = view.getByTestId('sync-status-rejected');
    expect(badge.textContent).toBe('1 nicht übernommen');
    act(() => { fireEvent.click(badge); });
    const item = within(view.getByTestId('outbox-rejected-panel')).getByTestId('outbox-rejected-item');
    expect(item.textContent).toContain('Ergebnis eingetragen');
    expect(item.textContent).toContain('Die Eingabe passt nicht zum aktuellen Spielablauf.');
    expect(h.engine.view(SPIEL_9)?.result.state.status).toBe('running');
  });

  it('Kette offline: RESULT_ENTRY E1 + CORRECTION (basedOn E1); E1 abgelehnt → Korrektur ebenfalls, beide im Hinweis', async () => {
    const e1 = await commandsOf(h).enterResult(SPIEL_9, CTX_9, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 1 });
    await commandsOf(h).correct(SPIEL_9, CTX_9, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 2 }, 'input_error', e1);
    const view = mount(h);
    await act(async () => { await settle(); });

    serverRejects(h, ['INVALID_TRANSITION', 'DEPENDS_ON_REJECTED']);
    await act(async () => { await h.sender.kick(); await settle(); });

    act(() => { fireEvent.click(view.getByTestId('sync-status-rejected')); });
    const items = within(view.getByTestId('outbox-rejected-panel')).getAllByTestId('outbox-rejected-item');
    expect(items.map((item) => item.textContent ?? '')).toEqual([
      expect.stringContaining('Ergebnis eingetragen'),
      expect.stringContaining('Korrektur'),
    ]);
    expect(items[1].textContent).toContain('Eine vorherige Eingabe wurde nicht übernommen, daher auch diese nicht.');
  });

  it('Gegenbeispiel: nichts wartet, nichts abgelehnt → kein Ablehnungs-Hinweis', async () => {
    const view = mount(h);
    await act(async () => { await settle(); });

    expect(view.queryByTestId('sync-status-rejected')).toBeNull();
  });
});
