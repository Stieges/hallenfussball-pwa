/**
 * Gleichstands-Entscheidungen (Paket TB, R-TB-3) und die Einstellung „Diese Plätze müssen bei Gleichstand ausgespielt
 * werden“ (TB-3') im `tournaments.config`-JSON – keine eigene Spalte, keine Migration. Beim Lesen fallen fehlerhafte
 * Entscheidungen weg (Zod strikt); geschrieben wird nur, was das Schema kennt – Person, Zeit und Grund nie (@W2A-072).
 * Die Einstellung ist immer gesetzt (fehlend → nur Platz 1). Ausgelagert, damit `supabaseMappers.ts` nicht wächst.
 */
import type { Tournament } from '../../types/tournament';
import { parseStandingDecisions } from '../models/schemas/StandingDecisionSchema';
import { parsePlacementsToPlayOut } from '../standings/playOutPlaces';

type DecisionFields = Pick<Tournament, 'standingDecisions' | 'placementsToPlayOut'>;

function decisionFields(rawDecisions: unknown, rawPlaces: unknown): DecisionFields {
  const decisions = parseStandingDecisions(rawDecisions);
  return {
    ...(decisions === undefined ? {} : { standingDecisions: decisions }),
    placementsToPlayOut: parsePlacementsToPlayOut(rawPlaces),
  };
}

/** Lesen aus `config` (beliebiges JSON). */
export function standingDecisionsFromConfig(config: object): DecisionFields {
  const raw = config as { standingDecisions?: unknown; placementsToPlayOut?: unknown };
  return decisionFields(raw.standingDecisions, raw.placementsToPlayOut);
}

/** Schreiben nach `config` (Voll-Speichern darf vorhandene Entscheidungen nie verlieren, Altwerte aber schon). */
export function standingDecisionsToConfig(tournament: DecisionFields): DecisionFields {
  return decisionFields(tournament.standingDecisions, tournament.placementsToPlayOut);
}
