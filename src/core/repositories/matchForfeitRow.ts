/**
 * Nichtantritts-Wertung an der Cloud (A-25c): Spalte `matches.forfeit_absent` (Migration `20261110_005`, A-25b) und
 * die Einstellung `forfeitScore` im `tournaments.config`-JSONB (keine Spalte, keine Migration).
 *
 * Die Spalte wird NUR gelesen, und nur aus `select('*')`-Zeilen: vor `_005` fehlt sie in der Zeile ganz (dann keine
 * Wertung), eine explizite Spaltenliste mit ihrem Namen schlüge vor dem Einspielen fehl. Gesetzt wird sie allein von
 * `append_match_events`; kein Schreibweg in `supabaseMappers.ts` sendet sie (Wächter-Test `supabaseMappers.wertung`).
 * Ausgelagert, damit `supabaseMappers.ts` nicht wächst.
 */
import type { ForfeitScore, Match, Tournament } from '../../types/tournament';
import { parseForfeitAbsent, parseForfeitScore } from '../models/forfeit';

/** Von Hand ergänzt, bis `src/types/supabase.ts` nach dem Einspielen von `_005` neu erzeugt ist. */
export interface MatchForfeitColumns {
  forfeit_absent?: string | null;
}

/** Lesen aus der Cloud-Zeile: gültiger Wert → `{ forfeitAbsent }`, sonst `{}`. */
export function forfeitFromRow(row: MatchForfeitColumns): Pick<Match, 'forfeitAbsent'> {
  const forfeitAbsent = parseForfeitAbsent(row.forfeit_absent);
  return forfeitAbsent === undefined ? {} : { forfeitAbsent };
}

/** Lesen aus `config` (beliebiges JSON): gültige Einstellung → `{ forfeitScore }`, sonst `{}` (dann gilt 2:0). */
export function forfeitScoreFromConfig(config: object): Pick<Tournament, 'forfeitScore'> {
  const forfeitScore = parseForfeitScore((config as { forfeitScore?: unknown }).forfeitScore);
  return forfeitScore === undefined ? {} : { forfeitScore };
}

/** Schreiben nach `config`: nur eine gültige Einstellung. */
export function forfeitScoreToConfig(tournament: Pick<Tournament, 'forfeitScore'>): { forfeitScore?: ForfeitScore } {
  const forfeitScore = parseForfeitScore(tournament.forfeitScore);
  return forfeitScore === undefined ? {} : { forfeitScore };
}
