/**
 * Cockpit-Testgerüst mit echter Engine (Aufgabe 2.4; 3.4 erweitert es): `MatchEngine` + `LocalMatchStore`
 * (fake-indexeddb) + `MatchCommands` + `useEngineCommandWiring` + `LiveCockpit`. Gemockt wird nur, was die Naht zu Netz,
 * Ton, Sync-Anzeige und Rolle ist (`useMatchSound`, `useSyncStatus`, `useActorRole`, `ToastContext`) – das legt die
 * Testdatei fest, nicht dieses Gerüst. Konstanten, Sender und `anpfiff` stehen in `engineHarnessSupport.ts`.
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { vi } from 'vitest';
import { LocalMatchStore, ClockSync, MatchEngine } from '../../../core/match/client';
import { MatchEngineContext, type MatchEngineContextValue } from '../../../features/match-engine/matchEngineContextInstance';
import { buildValidMatches, computeLiveMatches } from '../../../hooks/engineMatchModel';
import { useEngineCommandWiring } from '../../../hooks/useEngineCommandWiring';
import { LiveCockpit } from '../LiveCockpit';
import { HARNESS_MATCH_ID, HARNESS_TOURNAMENT_ID, harnessTournament as tournament, storeSender, type SenderFabrik } from './engineHarnessSupport';

let konten = 0;

async function baueKontext(senderFabrik: SenderFabrik, gastKonto: boolean): Promise<MatchEngineContextValue> {
  const accountId = gastKonto ? 'guest' : `acc-harness-${(konten += 1)}`;
  const store = new LocalMatchStore();
  const clock = new ClockSync(() => Promise.resolve(Date.now()), () => Date.now(), { get: () => null, set: () => undefined });
  const sender = senderFabrik(store, accountId, HARNESS_TOURNAMENT_ID);
  const engine = new MatchEngine({ store, clock, sender, fetchConfirmed: () => Promise.resolve({ events: [], newWatermark: 0 }), now: () => Date.now() });
  await engine.start(accountId);
  await engine.ensureMatch(HARNESS_MATCH_ID, { matchId: HARNESS_MATCH_ID, teamAId: 'teama', teamBId: 'teamb' }, tournament.id);
  return { engine, store, clock, sender, accountId } as unknown as MatchEngineContextValue;
}

const STABLE_PROPS = {
  fieldName: 'Feld 1', tournamentName: 'Hallencup Süd', tournamentId: tournament.id, upcomingMatches: [],
  onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(), onLoadNextMatch: vi.fn(),
};

export interface HarnessProps {
  senderFabrik?: SenderFabrik;
  /** Konto `guest`: schreibt sofort `confirmed`, nichts wartet. */
  gastKonto?: boolean;
}

function Cockpit({ context }: { context: MatchEngineContextValue }): ReactElement | null {
  const validMatches = useMemo(() => buildValidMatches(tournament), []);
  const compute = useCallback(
    () => computeLiveMatches(context, validMatches, new Set([HARNESS_MATCH_ID]), tournament, new Map()),
    [context, validMatches],
  );
  const [liveMatches, setLiveMatches] = useState(compute);
  // Jede Engine-Änderung berechnet die Ansicht neu (wie useEngineMatches).
  useEffect(() => context.engine.subscribe(() => { setLiveMatches(compute()); }), [context, compute]);
  const wiring = useEngineCommandWiring(tournament, context, liveMatches);
  const match = liveMatches.get(HARNESS_MATCH_ID);
  if (!match) { return null; }
  return (
    <LiveCockpit
      {...STABLE_PROPS}
      currentMatch={match}
      onStart={(matchId) => { void wiring.handleStart(matchId); }}
      onGoal={(matchId, teamId, delta, options) => { void wiring.handleGoal(matchId, teamId, delta, options); }}
      onCard={wiring.handleCard}
      onFoul={wiring.handleFoul}
    />
  );
}

/** Baut die Engine im Hintergrund auf und zeigt dann das Cockpit mit einem noch nicht angepfiffenen Spiel. */
export function Harness({ senderFabrik = storeSender, gastKonto = false }: HarnessProps): ReactElement | null {
  const [context, setContext] = useState<MatchEngineContextValue | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    void baueKontext(senderFabrik, gastKonto).then((c) => { if (!abgebrochen) { setContext(c); } });
    return () => { abgebrochen = true; };
  }, [senderFabrik, gastKonto]);
  if (!context) { return null; }
  return <MatchEngineContext.Provider value={context}><Cockpit context={context} /></MatchEngineContext.Provider>;
}

