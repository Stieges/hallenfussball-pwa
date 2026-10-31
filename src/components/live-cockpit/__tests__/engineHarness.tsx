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
  /** B-08d: schaltet den Zeit-Knopf frei (in der Produktion erst mit „Mehr“, Aufgabe 3.7). */
  zeitKorrektur?: boolean;
  /** Steuerrecht dieses Geräts (Vorgabe `true`); ein `rerender` mit `false` spielt den Verlust des Rechts nach (S3). */
  kannSteuern?: boolean;
  /** B-10a2: Turnierleitung dieses Geräts und ihr Weg „Korrigieren“ (Vorgabe: keine Leitung, kein Weg). */
  istLeitung?: boolean;
  onNichtAngetreten?: (matchId: string) => void;
  onKorrigieren?: (matchId: string) => void;
  /** Übersicht der Tastenkürzel (Taste `?`, Plan Cockpit v2 K1). */
  onTastenuebersicht?: () => void;
  /** LT-6: steht der Endstand noch als Quittung (Vorgabe `true`, wie ManagementTab im Endstand); `false` = nach „Weiter“. */
  endstandSteht?: boolean;
}

function Cockpit({ context, turnier, einstellungen, zeitKorrektur, kannSteuern, istLeitung, onKorrigieren, onNichtAngetreten, onTastenuebersicht, endstandSteht }: { context: MatchEngineContextValue; turnier?: Partial<Tournament>; einstellungen?: Partial<MatchCockpitSettings>; zeitKorrektur?: boolean; kannSteuern: boolean; istLeitung?: boolean; onKorrigieren?: (matchId: string) => void; onNichtAngetreten?: (matchId: string) => void; onTastenuebersicht?: () => void; endstandSteht?: boolean }): ReactElement | null {
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
      kannSteuern={kannSteuern}
      istLeitung={istLeitung}
      onNichtAngetreten={onNichtAngetreten}
      onKorrigieren={onKorrigieren}
      onTastenuebersicht={onTastenuebersicht}
      endstandSteht={endstandSteht}
      currentMatch={match}
      cockpitSettings={einstellungen ? { ...DEFAULT_MATCH_COCKPIT_SETTINGS, ...einstellungen } : undefined}
      onStart={(matchId) => { void wiring.handleStart(matchId); }}
      onFinish={wiring.handleFinish}
      onPause={(matchId) => { void wiring.handlePause(matchId); }}
      onResume={(matchId) => { void wiring.handleResume(matchId); }}
      onGoal={wiring.handleGoal}
      onCard={wiring.handleCard}
      onFoul={wiring.handleFoul}
      onTimePenalty={wiring.handleTimePenalty}
      onAdjustTime={zeitKorrektur ? () => undefined : undefined}
    />
  );
}

/** Baut die Engine im Hintergrund auf und zeigt dann das Cockpit mit einem noch nicht angepfiffenen Spiel. */
export function Harness({ senderFabrik = storeSender, gastKonto = false, turnier, einstellungen, zeitKorrektur = false, kannSteuern = true, istLeitung, onKorrigieren, onNichtAngetreten, onTastenuebersicht, endstandSteht = true }: HarnessProps): ReactElement | null {
  const [context, setContext] = useState<MatchEngineContextValue | null>(null);
  useEffect(() => {
    let abgebrochen = false;
    void baueKontext(senderFabrik, gastKonto).then((c) => { if (!abgebrochen) { setContext(c); } });
    return () => { abgebrochen = true; };
  }, [senderFabrik, gastKonto]);
  if (!context) { return null; }
  return <MatchEngineContext.Provider value={context}><Cockpit context={context} turnier={turnier} einstellungen={einstellungen} zeitKorrektur={zeitKorrektur} kannSteuern={kannSteuern} istLeitung={istLeitung} onKorrigieren={onKorrigieren} onNichtAngetreten={onNichtAngetreten} onTastenuebersicht={onTastenuebersicht} endstandSteht={endstandSteht} /></MatchEngineContext.Provider>;
}

