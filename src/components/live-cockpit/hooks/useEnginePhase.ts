/**
 * useEnginePhase (B-08a): `PhaseView` eines Engine-Spiels aus `MatchEngine.view`. Aktualisiert sich über
 * `engine.subscribe`, und taktet alle 250 ms nur bei laufender Uhr, in der Abschnittspause oder in der Quittung nach dem Abpfiff.
 * `null` für Spiele ohne Engine-Kopie (und ohne Engine-Provider).
 */
import { useEffect, useState } from 'react';
import type { MatchEngine } from '../../../core/match/client';
import type { MatchContext, MatchState } from '../../../core/match';
import { useMatchEngineContextOptional } from '../../../features/match-engine/useMatchEngineContext';
import { phaseViewOf, quittungRestOf, type PhaseView } from '../engine/phaseView';

const TICK_MS = 250;

/** Zustand des Spiels; `null` ohne Kopie oder ohne zwei Teams im Zustand. */
function readState(engine: MatchEngine, matchId: string): MatchState | null {
  return engine.view(matchId)?.result.state ?? null;
}

/**
 * Die Team-IDs stehen als Schlüssel in `state.scores` (`initialState` legt beide Teams in
 * Einfügereihenfolge an). Die Engine-Ansicht gibt den Kontext nicht heraus.
 */
function contextOf(matchId: string, state: MatchState): MatchContext | null {
  const [teamAId, teamBId, ...rest] = Object.keys(state.scores);
  if (teamAId === undefined || teamBId === undefined || rest.length > 0) {
    return null;
  }
  return { matchId, teamAId, teamBId };
}

function phaseOf(engine: MatchEngine, matchId: string): PhaseView | null {
  const state = readState(engine, matchId);
  const ctx = state ? contextOf(matchId, state) : null;
  return state && ctx ? phaseViewOf(state, ctx, engine.serverNow()) : null;
}

/**
 * Takt nur bei laufender Spieluhr, in der Abschnittspause und in der Quittung nach dem Abpfiff, damit die Zeile nach
 * 30 Sekunden verschwindet (@SL-152); sonst ändert sich die Anzeige nicht.
 */
function needsTick(engine: MatchEngine, matchId: string): boolean {
  const state = readState(engine, matchId);
  return state !== null && (state.clock.running || state.status === 'section_break' || (quittungRestOf(state, engine.serverNow()) ?? 0) > 0);
}

export function useEnginePhase(matchId: string): PhaseView | null {
  const engine = useMatchEngineContextOptional()?.engine ?? null;
  const [phase, setPhase] = useState<PhaseView | null>(() => (engine ? phaseOf(engine, matchId) : null));

  useEffect(() => {
    if (!engine) {
      setPhase(null);
      return undefined;
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    const stopTimer = (): void => {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };
    const refresh = (): void => {
      setPhase(phaseOf(engine, matchId));
      if (needsTick(engine, matchId)) {
        timer ??= setInterval(refresh, TICK_MS);
      } else {
        stopTimer();
      }
    };
    const unsubscribe = engine.subscribe(refresh);
    refresh();
    return () => {
      unsubscribe();
      stopTimer();
    };
  }, [engine, matchId]);

  return phase;
}
