/**
 * Serverregel-Eingabe eines Spiels für den Engine-Start (MATCH_START.payload.rules).
 * Eine Quelle für den Produktivaufrufer (`useEngineCommandWiring`) und die Regel-Tests
 * (`src/test/engineSpielFixture.ts`), damit Tests die Produktionsregel prüfen und keine Kopie.
 * Die Engine kennt nur die Phase, kein `finalType` (Befund C-KO-RUNDENREGEL-SERVER, A-27).
 */
import { serverRules, type MatchRules } from '../core/match';
import type { Match, Tournament } from '../types/tournament';

export function serverRulesFor(tournament: Tournament, match: Pick<Match, 'phase'> | undefined): MatchRules {
  return serverRules({
    durationMinutes: null,
    phase: match?.phase ?? null,
    groupPhaseDuration: tournament.groupPhaseGameDuration,
    finalRoundDuration: tournament.finalRoundGameDuration ?? null,
    config: {
      gamePeriods: tournament.gamePeriods,
      halftimeBreak: tournament.halftimeBreak,
      matchCockpitSettings: tournament.matchCockpitSettings,
    },
    finalsConfig: tournament.finalsConfig ?? null,
  });
}
