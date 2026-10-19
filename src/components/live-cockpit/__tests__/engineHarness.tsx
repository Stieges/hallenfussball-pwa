/**
 * Cockpit-Testgerüst mit echter Engine (Aufgabe 2.4; 3.4 erweitert es): `MatchEngine` + `LocalMatchStore`
 * (fake-indexeddb) + `MatchCommands` + `useEngineCommandWiring` + `LiveCockpit`. Gemockt wird nur, was die Naht zu Netz,
 * Ton, Sync-Anzeige und Rolle ist (`useMatchSound`, `useSyncStatus`, `useActorRole`, `ToastContext`) – das legt die
 * Testdatei fest, nicht dieses Gerüst. Konstanten, Sender und `anpfiff` stehen in `engineHarnessSupport.ts`.
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { vi } from 'vitest';
import { MatchEngineContext, type MatchEngineContextValue } from '../../../features/match-engine/matchEngineContextInstance';
import { buildValidMatches, computeLiveMatches } from '../../../hooks/engineMatchModel';
import { useEngineCommandWiring } from '../../../hooks/useEngineCommandWiring';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type MatchCockpitSettings, type Tournament } from '../../../types/tournament';
import { LiveCockpit } from '../LiveCockpit';
import { HARNESS_MATCH_ID, baueKontext, harnessTournament, storeSender, type SenderFabrik } from './engineHarnessSupport';

const STABLE_PROPS = {
  fieldName: 'Feld 1', tournamentName: 'Hallencup Süd', tournamentId: harnessTournament.id, upcomingMatches: [],
  onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(), onLoadNextMatch: vi.fn(),
};

export interface HarnessProps {
  senderFabrik?: SenderFabrik;
  /** Konto `guest`: schreibt sofort `confirmed`, nichts wartet. */
  gastKonto?: boolean;
  /** Abweichende Turnier-Regeln (z. B. `groupPhaseGameDuration`, `gamePeriods`, `halftimeBreak`); stabil halten (außerhalb der Komponente anlegen). */
  turnier?: Partial<Tournament>;
  /** Cockpit-Einstellungen (Ton, Vibration, …); stabil halten. */
  einstellungen?: Partial<MatchCockpitSettings>;
}

function Cockpit({ context, turnier, einstellungen }: { context: MatchEngineContextValue; turnier?: Partial<Tournament>; einstellungen?: Partial<MatchCockpitSettings> }): ReactElement | null {
  const tournament = useMemo((): Tournament => ({ ...harnessTournament, ...turnier }), [turnier]);
  const validMatches = useMemo(() => buildValidMatches(tournament), [tournament]);
  const compute = useCallback(
    () => computeLiveMatches(context, validMatches, new Set([HARNESS_MATCH_ID]), tournament, new Map()),
    [context, validMatches, tournament],
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
      cockpitSettings={einstellungen ? { ...DEFAULT_MATCH_COCKPIT_SETTINGS, ...einstellungen } : undefined}
      onStart={(matchId) => { void wiring.handleStart(matchId); }}
      onFinish={wiring.handleFinish}
      onGoal={wiring.handleGoal}
      onCard={wiring.handleCard}
      onFoul={wiring.handleFoul}
      onTimePenalty={wiring.handleTimePenalty}
    />
  );
}

/** Baut die Engine im Hintergrund auf und zeigt dann das Cockpit mit einem noch nicht angepfiffenen Spiel. */
export function Harness({ senderFabrik = storeSender, gastKonto = false, turnier, einstellungen }: HarnessProps): ReactElement | null {
  const [context, setContext] = useState<MatchEngineContextValue | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    void baueKontext(senderFabrik, gastKonto).then((c) => { if (!abgebrochen) { setContext(c); } });
    return () => { abgebrochen = true; };
  }, [senderFabrik, gastKonto]);
  if (!context) { return null; }
  return <MatchEngineContext.Provider value={context}><Cockpit context={context} turnier={turnier} einstellungen={einstellungen} /></MatchEngineContext.Provider>;
}

