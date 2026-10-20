/**
 * Gleichstands-Entscheidungen (Paket TB, R-TB-3) im `tournaments.config`-JSON – keine eigene Spalte, keine Migration.
 * Beim Lesen fallen fehlerhafte Einträge weg (Zod strikt); ausgelagert, damit `supabaseMappers.ts` nicht wächst.
 */
import type { Tournament } from '../../types/tournament';
import { parseStandingDecisions } from '../models/schemas/StandingDecisionSchema';

type DecisionFields = Pick<Tournament, 'standingDecisions'>;

/** Lesen aus `config` (beliebiges JSON). */
export function standingDecisionsFromConfig(config: object): DecisionFields {
  const decisions = parseStandingDecisions((config as { standingDecisions?: unknown }).standingDecisions);
  return decisions === undefined ? {} : { standingDecisions: decisions };
}

/** Schreiben nach `config` (Voll-Speichern darf vorhandene Entscheidungen nie verlieren). */
export function standingDecisionsToConfig(tournament: DecisionFields): DecisionFields {
  return tournament.standingDecisions === undefined ? {} : { standingDecisions: tournament.standingDecisions };
}
