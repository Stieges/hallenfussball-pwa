/**
 * A-08f3e2 H-2 (Plan A-08f3 v4 § 3): die K.-o.-Auflösung nach einem Spielplan-Eintrag läuft erst, wenn der
 * Server den Eintrag angenommen hat; gespeichert werden nur Slots. Abgelehnt → keine Auflösung. Gast sofort.
 * Offline: Hinweis „K.-o.-Plätze werden nach dem Senden besetzt“. Szenario: @FU-080 (Tabelle/Folgespiele).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import type { AppendResult } from '../../../../core/repositories/appendMatchEventsRpc';
import { FINALE, SPIEL_7, SPIEL_9, finaleAusGruppeA, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine } from '../../../../test/scheduleEngineHarness';
import { useScheduleResultEntry } from '../useScheduleResultEntry';

await initRealDeI18n();

// Spiel 7 ist schon 1:0 beendet; mit Spiel 9 ist Gruppe A fertig, das Finale (Erster gegen Zweiter A) wird besetzt.
const turnier = () => scheduleTournament({ [SPIEL_7]: { scoreA: 1, scoreB: 0, matchStatus: 'finished' } }, [finaleAusGruppeA()]);

function render(h: ScheduleEngine) {
  const onMatchesUpdate = vi.fn();
  const showWarning = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider>;
  const tournament = turnier();
  const hook = renderHook(() => useScheduleResultEntry({ tournament, onMatchesUpdate, showWarning, lockFinishedResults: false }), { wrapper });
  const enter = async (matchId: string, a: number, b: number) => {
    await act(async () => { await hook.result.current.enterScore(matchId, a, b); await settle(); });
  };
  return { enter, onMatchesUpdate, showWarning };
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

describe('A-08f3e2 H-2: K.-o.-Auflösung erst nach Bestätigung durch den Server', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('H-2: vor der Bestätigung 0× updateMatches, danach genau ein Slot-Update für das Finale (ohne Spielstand)', async () => {
    const server = deferredServer(h);
    const { enter, onMatchesUpdate } = render(h);
    await enter(SPIEL_9, 3, 1);

    expect(onMatchesUpdate).not.toHaveBeenCalled();

    await server(accepted);
    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    const [updates] = onMatchesUpdate.mock.calls[0] as [Array<Record<string, unknown>>];
    expect(updates.map((update) => update.id)).toEqual([FINALE]);
    expect(updates[0]).toMatchObject({ slotA: { kind: 'team' }, slotB: { kind: 'team' } });
    expect(Object.keys(updates[0]).sort()).toEqual(['id', 'slotA', 'slotB']);
  });

  it('H-2 Gegenbeispiel: Server lehnt den Eintrag ab → keine Auflösung (0× updateMatches)', async () => {
    const server = deferredServer(h);
    const { enter, onMatchesUpdate } = render(h);
    await enter(SPIEL_9, 3, 1);
    await server(rejected);

    expect(onMatchesUpdate).not.toHaveBeenCalled();
  });

  it('H-2 offline: Hinweis „K.-o.-Plätze werden nach dem Senden besetzt“, keine Auflösung', async () => {
    deferredServer(h);
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      const { enter, onMatchesUpdate, showWarning } = render(h);
      await enter(SPIEL_9, 3, 1);

      expect(showWarning).toHaveBeenCalledWith('K.-o.-Plätze werden nach dem Senden besetzt');
      expect(onMatchesUpdate).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });

  it('Gegenbeispiel: Spiel ohne K.-o.-Folgen (Gruppe nicht fertig) → nach Bestätigung kein updateMatches', async () => {
    const { enter, onMatchesUpdate } = render(h);
    await enter(SPIEL_7, 2, 0);

    // Spiel 9 ist noch offen -> Gruppe A nicht fertig -> nichts zu besetzen.
    expect(onMatchesUpdate).not.toHaveBeenCalled();
  });
});

describe('A-08f3e2 H-2 Gast', () => {
  it('Gast: Auflösung sofort (lokal bestätigt), nur Slots', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const h = await makeScheduleEngine('guest');
    const { enter, onMatchesUpdate } = render(h);
    await enter(SPIEL_9, 3, 1);

    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    expect(Object.keys((onMatchesUpdate.mock.calls[0] as [Array<Record<string, unknown>>])[0][0]).sort()).toEqual(['id', 'slotA', 'slotB']);
    vi.unstubAllGlobals();
  });
});
