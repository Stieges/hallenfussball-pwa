/**
 * A-08f3e2 H-2 + Fixrunde 1 (I-1): die K.-o.-Auflösung nach einem Spielplan-Eintrag läuft erst, wenn der Server
 * den Eintrag angenommen hat, und zwar unabhängig vom Spielplan-Tab (`useKoResolutionAfterAck`, in
 * `useTournamentManager` immer gemountet): auch nach Tab-Wechsel und Neuladen. Gespeichert werden nur Slots.
 * Abgelehnt → keine Auflösung. Gast sofort. Offline + K.-o.-relevant: Hinweis „K.-o.-Plätze werden nach dem
 * Senden besetzt“, sonst nicht (M-3). Szenario: @FU-080 (Folgespiele).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const kv = vi.hoisted(() => new Map<string, string>());
vi.mock('../../../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: (key: string) => kv.get(key) ?? null,
    setItem: (key: string, value: string) => { kv.set(key, value); },
    removeItem: (key: string) => { kv.delete(key); },
    getIsAvailable: () => true,
  },
}));
vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import type { AppendResult } from '../../../../core/repositories/appendMatchEventsRpc';
import type { Tournament } from '../../../../types/tournament';
import type { MatchUpdate } from '../../../../core/models/types';
import { useKoResolutionAfterAck } from '../../../../hooks/useKoResolutionAfterAck';
import {
  FC_NORD, FINALE, SPIEL_7, SPIEL_9, SV_SUED, finaleAusGruppeA, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine,
} from '../../../../test/scheduleEngineHarness';
import { useScheduleResultEntry } from '../useScheduleResultEntry';

await initRealDeI18n();

// Spiel 7 ist schon 1:0 beendet; mit Spiel 9 ist Gruppe A fertig, das Finale (Erster gegen Zweiter A) wird besetzt.
const turnier = (): Tournament => scheduleTournament({ [SPIEL_7]: { scoreA: 1, scoreB: 0, matchStatus: 'finished' } }, [finaleAusGruppeA()]);

function wrapper(h: ScheduleEngine) {
  return ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider>;
}

/** Spielplan-Tab: Schnelleingabe (wird beim Tab-Wechsel ausgehängt). */
function mountSpielplan(h: ScheduleEngine, tournament: Tournament = turnier()) {
  const showWarning = vi.fn();
  const hook = renderHook(() => useScheduleResultEntry({ tournament, showWarning, lockFinishedResults: false }), { wrapper: wrapper(h) });
  const enter = async (matchId: string, a: number, b: number) => {
    await act(async () => { await hook.result.current.enterScore(matchId, a, b); await settle(); });
  };
  return { hook, enter, showWarning };
}

/** Immer gemountet (useTournamentManager): die Auflösung nach Bestätigung. */
function mountManager(h: ScheduleEngine, tournament: Tournament = turnier()) {
  const onSlots = vi.fn<(updates: MatchUpdate[]) => void>();
  const hook = renderHook(() => useKoResolutionAfterAck(tournament, onSlots), { wrapper: wrapper(h) });
  return { hook, onSlots };
}

function deferredServer(h: ScheduleEngine) {
  let release: (decide: (ids: string[]) => AppendResult) => void = () => undefined;
  h.api.mockImplementationOnce((_matchId, events) => new Promise<AppendResult>((resolve) => {
    release = (decide) => resolve(decide(events.map((event) => event.id)));
  }));
  return (decide: (ids: string[]) => AppendResult) => act(async () => { release(decide); await settle(); });
}

const accepted = (ids: string[]): AppendResult => ({ results: ids.map((id) => ({ id, status: 'accepted' as const })), state: null, serverTime: 1 });
const rejected = (ids: string[]): AppendResult => ({ results: ids.map((id) => ({ id, status: 'rejected' as const, code: 'INVALID_TRANSITION' })), state: null, serverTime: 1 });
const nurSlots = (onSlots: ReturnType<typeof mountManager>['onSlots']) => {
  const [updates] = onSlots.mock.calls[0];
  expect(updates.map((update) => update.id)).toEqual([FINALE]);
  expect(updates[0]).toMatchObject({ slotA: { kind: 'team' }, slotB: { kind: 'team' } });
  expect(Object.keys(updates[0]).sort()).toEqual(['id', 'slotA', 'slotB']);
};

describe('A-08f3e2 H-2: K.-o.-Auflösung erst nach Bestätigung durch den Server', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    kv.clear();
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('H-2: vor der Bestätigung 0× Slot-Update, danach genau eines für das Finale (ohne Spielstand)', async () => {
    const server = deferredServer(h);
    const { onSlots } = mountManager(h);
    const { enter } = mountSpielplan(h);
    await enter(SPIEL_9, 3, 1);
    expect(onSlots).not.toHaveBeenCalled();

    await server(accepted);
    expect(onSlots).toHaveBeenCalledTimes(1);
    nurSlots(onSlots);
  });

  it('I-1 Tab-Wechsel: Spielplan ausgehängt vor der Bestätigung → Plätze werden trotzdem genau einmal besetzt', async () => {
    const server = deferredServer(h);
    const { onSlots } = mountManager(h);
    const spielplan = mountSpielplan(h);
    await spielplan.enter(SPIEL_9, 3, 1);
    spielplan.hook.unmount();

    await server(accepted);
    await act(async () => { await h.engine.notifyStoreChange(SPIEL_9); await settle(); });
    expect(onSlots).toHaveBeenCalledTimes(1);
    nurSlots(onSlots);
  });

  it('I-1 Neuladen: offline eingetragen, Gerät neu geladen, später bestätigt → Plätze besetzt', async () => {
    const offline = await makeScheduleEngine('olli-neu', { offline: true });
    await mountSpielplan(offline).enter(SPIEL_9, 3, 1);
    offline.engine.stop();

    const neu = await makeScheduleEngine('olli-neu'); // wieder Netz: der Sender schickt den wartenden Eintrag
    try {
      const { onSlots } = mountManager(neu);
      await act(async () => { await neu.sender.kick(); await settle(); });
      expect(onSlots).toHaveBeenCalledTimes(1);
      nurSlots(onSlots);
    } finally {
      neu.engine.stop();
    }
  });

  it('H-2 Gegenbeispiel: Server lehnt den Eintrag ab → keine Auflösung, auch nach Tab-Wechsel', async () => {
    const server = deferredServer(h);
    const { onSlots } = mountManager(h);
    const spielplan = mountSpielplan(h);
    await spielplan.enter(SPIEL_9, 3, 1);
    spielplan.hook.unmount();
    await server(rejected);

    expect(onSlots).not.toHaveBeenCalled();
  });

  it('H-2 Gegenbeispiel: Korrektur am beendeten Spiel 9 vom Server abgelehnt → Spiel bleibt beendet, trotzdem keine Auflösung', async () => {
    // Spiel 9 endete 2:1 an einem anderen Gerät (fremde Ergebnisse lösen bei Olli nicht aus, Plan § 5.1 R3).
    h.fetchConfirmed.mockResolvedValueOnce({
      events: [{ id: 'e1', type: 'RESULT_ENTRY', actor: 'leitung', at: 1, section: null, clockMs: null, teamId: null, payload: { scores: { [SV_SUED]: 2, [FC_NORD]: 1 } }, seq: 1 }],
      newWatermark: 1,
    });
    await h.engine.ensureMatch(SPIEL_9, { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD }, 'T');
    await h.engine.catchUp(SPIEL_9);
    const server = deferredServer(h);
    const { onSlots } = mountManager(h);
    const { hook } = mountSpielplan(h);
    let done: Promise<void> = Promise.resolve();
    act(() => { done = hook.result.current.enterScore(SPIEL_9, 3, 1); });
    await act(async () => { await settle(); });
    await act(async () => { hook.result.current.answerPrompt('input_error'); await done; await settle(); });
    await server(rejected);

    expect(h.engine.view(SPIEL_9)?.result.state.status).toBe('finished');
    expect(onSlots).not.toHaveBeenCalled();
  });

  it('idempotent: weitere Benachrichtigungen nach der Auflösung lösen nichts mehr aus', async () => {
    const { onSlots } = mountManager(h);
    await mountSpielplan(h).enter(SPIEL_9, 3, 1);
    await act(async () => { await h.engine.notifyStoreChange(SPIEL_9); await h.engine.notifyStoreChange(SPIEL_7); await settle(); });

    expect(onSlots).toHaveBeenCalledTimes(1);
  });

  it('H-2 offline: Hinweis „K.-o.-Plätze werden nach dem Senden besetzt“, keine Auflösung', async () => {
    deferredServer(h);
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      const { onSlots } = mountManager(h);
      const { enter, showWarning } = mountSpielplan(h);
      await enter(SPIEL_9, 3, 1);

      expect(showWarning).toHaveBeenCalledWith('K.-o.-Plätze werden nach dem Senden besetzt');
      expect(onSlots).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('M-3 Gegenbeispiel: offline, Gruppenspiel ohne K.-o.-Folgen (Spiel 9 noch offen) → kein K.-o.-Hinweis', async () => {
    deferredServer(h);
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      const ohneSpiel7 = scheduleTournament({}, [finaleAusGruppeA()]);
      const { enter, showWarning } = mountSpielplan(h, ohneSpiel7);
      await enter(SPIEL_7, 2, 0);

      expect(showWarning).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('Gegenbeispiel: Spiel ohne K.-o.-Folgen (Gruppe nicht fertig) → nach Bestätigung kein Slot-Update', async () => {
    const ohneSpiel7 = scheduleTournament({}, [finaleAusGruppeA()]);
    const { onSlots } = mountManager(h, ohneSpiel7);
    await mountSpielplan(h, ohneSpiel7).enter(SPIEL_7, 2, 0);

    expect(onSlots).not.toHaveBeenCalled();
  });
});

describe('A-08f3e2 H-2 Gast', () => {
  it('Gast: Auflösung sofort (lokal bestätigt), nur Slots', async () => {
    kv.clear();
    vi.stubGlobal('indexedDB', new IDBFactory());
    const h = await makeScheduleEngine('guest');
    const { onSlots } = mountManager(h);
    await mountSpielplan(h).enter(SPIEL_9, 3, 1);

    expect(onSlots).toHaveBeenCalledTimes(1);
    nurSlots(onSlots);
    vi.unstubAllGlobals();
  });
});
