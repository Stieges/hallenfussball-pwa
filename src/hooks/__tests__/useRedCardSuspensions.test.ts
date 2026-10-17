/**
 * L6, Schritt 2 (Cockpit-Spec § 10 L6): `useRedCardSuspensions(tournament, currentMatchId)` liest
 * die Ableitung aus dem Engine-Zustand und abonniert Änderungen (gleiches `useSyncExternalStore`-
 * Muster wie `useEngineMatches`, nur lesen – kein eigenes `ensureMatch`, keine Sammelabfrage).
 *
 * Pflichttest nach Gherkin @SL-089/@SL-111 (`2026-10-02_spiel-leiten.md` Z. 884/1213) und
 * @W2A-020 (`2026-09-27_wizard-regelinhalte.md` Z. 183), Werte wörtlich: Nummer 7, Spiel 11,
 * früheres Spiel. Team-IDs der Engine sind `fc-nord`/`sv-sued` (Fixture-Konvention der Tests).
 *
 * „Fremdes Gerät“ (Brief L6 § 1): die Rote kommt nur über `fetchConfirmed` (catch-up) – wie im
 * Cockpit-Baum `useEngineMatches` es für das Turnier garantiert (ensureMatch + Sammelabfrage +
 * `catchUpLoaded`).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { MatchContext, MatchRules } from '../../core/match';
import { MatchCommands, MatchEngine, ClockSync, LocalMatchStore } from '../../core/match/client';
import type { EngineEventWithSeq, MatchEngineDeps } from '../../core/match/client';
import { looseVs } from '../../test/matchSlotFixtures';
import { makeEngineContext } from '../../test/engineContextFixture';
import type { MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';

const engineCtx = vi.hoisted(() => ({ current: null as MatchEngineContextValue | null }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => engineCtx.current,
}));

import { useRedCardSuspensions } from '../useRedCardSuspensions';

const SPIEL_4 = 'spiel-4';
const SPIEL_11 = 'spiel-11';
const CTX_4: MatchContext = { matchId: SPIEL_4, teamAId: 'fc-nord', teamBId: 'sv-sued' };
const CTX_11: MatchContext = { matchId: SPIEL_11, teamAId: 'fc-nord', teamBId: 'sv-sued' };
const NOW = 1_790_000_000_000;

const RULES: MatchRules = {
  sections: 2,
  sectionSeconds: 600,
  breakSeconds: 60,
  knockout: false,
  tiebreak: null,
  overtimeSeconds: 0,
  shootersPerTeam: 5,
  suddenDeathAfter: 5,
  penaltySeconds: 120,
};

function turnier(): Tournament {
  return {
    id: 'tour-l6',
    matches: [
      { id: SPIEL_4, ...looseVs('fc-nord', 'sv-sued'), round: 1, field: 1, matchNumber: 4 },
      { id: SPIEL_11, ...looseVs('fc-nord', 'sv-sued'), round: 2, field: 1, matchNumber: 11 },
    ],
    teams: [
      { id: 'fc-nord', name: 'FC Nord' },
      { id: 'sv-sued', name: 'SV Süd' },
    ],
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

function commandsFor(value: MatchEngineContextValue): MatchCommands {
  return new MatchCommands({
    engine: value.engine,
    store: value.store,
    sender: value.sender,
    accountId: value.accountId,
  });
}

async function spieleAnlegen(value: MatchEngineContextValue): Promise<void> {
  await value.engine.ensureMatch(SPIEL_4, CTX_4);
  await value.engine.ensureMatch(SPIEL_11, CTX_11);
}

describe('useRedCardSuspensions (L6)', () => {
  beforeEach(async () => {
    engineCtx.current = await makeEngineContext('spiel-l6-dummy');
    await spieleAnlegen(engineCtx.current);
  });

  it('@SL-089 Dann: „Nr. 7 ist für dieses Turnier gesperrt“ – Rot in Spiel 4, geöffnet wird Spiel 11', async () => {
    const value = engineCtx.current;
    if (!value) {
      throw new Error('Engine-Kontext fehlt');
    }
    const commands = commandsFor(value);
    await commands.start(SPIEL_4, CTX_4, 'helper', RULES);
    await commands.card(SPIEL_4, CTX_4, 'helper', 'fc-nord', 'RED_CARD', { playerNumber: 7 });

    const { result } = renderHook(() => useRedCardSuspensions(turnier(), SPIEL_11));

    await waitFor(() => {
      expect(result.current).toEqual([{ teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 }]);
    });
  });

  it('@SL-089 Und: Tom kann für die Nummer 7 von FC Nord trotzdem ein Tor erfassen', async () => {
    const value = engineCtx.current;
    if (!value) {
      throw new Error('Engine-Kontext fehlt');
    }
    const commands = commandsFor(value);
    await commands.start(SPIEL_4, CTX_4, 'helper', RULES);
    await commands.card(SPIEL_4, CTX_4, 'helper', 'fc-nord', 'RED_CARD', { playerNumber: 7 });
    await commands.start(SPIEL_11, CTX_11, 'helper', RULES);

    const { result } = renderHook(() => useRedCardSuspensions(turnier(), SPIEL_11));
    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    const torId = await commands.goal(SPIEL_11, CTX_11, 'helper', 'fc-nord', false, { playerNumber: 7 });

    expect(torId).not.toBeNull();
    expect(value.engine.view(SPIEL_11)?.result.state.scores['fc-nord']?.regular).toBe(1);
    expect(result.current).toEqual([{ teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 }]);
  });

  it('@W2A-020 Dann: „Nr. 7 ist für dieses Turnier gesperrt“ – Spieler mit Rückennummer 7 von Team A hat im Turnier Rot gesehen', async () => {
    const value = engineCtx.current;
    if (!value) {
      throw new Error('Engine-Kontext fehlt');
    }
    const commands = commandsFor(value);
    await commands.start(SPIEL_4, CTX_4, 'helper', RULES);
    await commands.card(SPIEL_4, CTX_4, 'helper', 'fc-nord', 'RED_CARD', { playerNumber: 7 });

    const { result } = renderHook(() => useRedCardSuspensions(turnier(), SPIEL_11));

    await waitFor(() => {
      expect(result.current).toEqual([{ teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 }]);
    });
  });

  it('@W2A-020 Und: die App verhindert die Erfassung nicht – Tor der Nummer 7 bleibt möglich', async () => {
    const value = engineCtx.current;
    if (!value) {
      throw new Error('Engine-Kontext fehlt');
    }
    const commands = commandsFor(value);
    await commands.start(SPIEL_4, CTX_4, 'helper', RULES);
    await commands.card(SPIEL_4, CTX_4, 'helper', 'fc-nord', 'RED_CARD', { playerNumber: 7 });
    await commands.start(SPIEL_11, CTX_11, 'helper', RULES);

    const { result } = renderHook(() => useRedCardSuspensions(turnier(), SPIEL_11));
    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    await expect(commands.goal(SPIEL_11, CTX_11, 'helper', 'fc-nord', false, { playerNumber: 7 })).resolves.not.toBeNull();
  });

  it('@SL-111 Und: „in späteren Spielen von SV Süd erscheint kein Sperr-Hinweis für Nr. 5“ – Rücknahme ohne Remount', async () => {
    const value = engineCtx.current;
    if (!value) {
      throw new Error('Engine-Kontext fehlt');
    }
    const commands = commandsFor(value);
    await commands.start(SPIEL_4, CTX_4, 'helper', RULES);
    const kartenId = await commands.card(SPIEL_4, CTX_4, 'helper', 'sv-sued', 'RED_CARD', { playerNumber: 5 });

    const { result } = renderHook(() => useRedCardSuspensions(turnier(), SPIEL_11));
    await waitFor(() => {
      expect(result.current).toEqual([{ teamId: 'sv-sued', playerNumber: 5, ausSpielNummer: 4 }]);
    });

    await commands.retract(SPIEL_4, CTX_4, 'helper', kartenId ?? '');

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
    expect(result.current).toEqual([]);
  });

  it('Fremdes Gerät: Rot in Spiel 4 nur über fetchConfirmed (catch-up) – nach catchUpLoaded ist der Hinweis da', async () => {
    const ereignisse: EngineEventWithSeq[] = [
      { id: 'start-4', type: 'MATCH_START', at: 1000, actor: 'helper', section: 1, clockMs: null, payload: { rules: RULES }, seq: 1 },
      {
        id: 'k-fremd',
        type: 'RED_CARD',
        at: 2000,
        actor: 'helper',
        section: 1,
        clockMs: 30_000,
        teamId: 'fc-nord',
        payload: { playerNumber: 7 },
        seq: 2,
      },
    ];
    const fetchConfirmed: MatchEngineDeps['fetchConfirmed'] = vi
      .fn()
      .mockImplementation(async (matchId: string) =>
        matchId === SPIEL_4 ? { events: ereignisse, newWatermark: 2 } : { events: [], newWatermark: 0 },
      );
    const store = new LocalMatchStore();
    const clock = new ClockSync(() => Promise.resolve(NOW), () => NOW, { get: () => null, set: () => undefined });
    const engine = new MatchEngine({
      store,
      clock,
      sender: { start: async () => undefined, stop: () => undefined },
      fetchConfirmed,
      now: () => NOW,
    });
    const accountId = 'acc-fremdes-geraet';
    await engine.start(accountId);
    await engine.ensureMatch(SPIEL_4, CTX_4);
    await engine.ensureMatch(SPIEL_11, CTX_11);
    engineCtx.current = { engine, store, clock, sender: { kick: async () => undefined }, accountId } as unknown as MatchEngineContextValue;

    const { result } = renderHook(() => useRedCardSuspensions(turnier(), SPIEL_11));
    expect(result.current).toEqual([]);

    engine.markEngineMatches([SPIEL_4]);
    await engine.catchUpLoaded();

    await waitFor(() => {
      expect(result.current).toEqual([{ teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 }]);
    });
    expect(fetchConfirmed).toHaveBeenCalledWith(SPIEL_4, 0);
  });

  it('ohne Engine-Kontext (Gast ohne Provider) → []', () => {
    engineCtx.current = null;
    const { result } = renderHook(() => useRedCardSuspensions(turnier(), SPIEL_11));
    expect(result.current).toEqual([]);
  });
});
