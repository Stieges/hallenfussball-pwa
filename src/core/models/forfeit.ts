/**
 * Nichtantritts-Wertung (A-25, E-A4; GA4 A-25c): Lesefunktionen und die Einstellung „Wertung bei Nichtantritt“.
 *
 * - Eine Wertung ist ein Ergebniseintrag mit Wertungsmerkmal: `decidedBy 'forfeit'`, wer fehlte in `forfeitAbsent`
 *   (Spalte `matches.forfeit_absent` ab Migration `20261110_005`, gesetzt nur von `append_match_events`).
 * - Fehlt eine Seite, steht die Wertung als Stand im Spiel (z. B. 0:2). Fehlen beide, ist der Stand 0:0 (Regel der
 *   Engine, A-25n); beide verlieren dann mit 0:`winner` Toren, keiner gewinnt (@W2A-024, @TM-063) – das rechnet
 *   `matchOutcome` (`core/standings/countsForStandings.ts`) mit der Einstellung des Turniers.
 * - Gilt nur zusammen: `forfeitAbsent` ohne `decidedBy 'forfeit'` (z. B. nach einer Korrektur, bevor die Zeile neu
 *   geladen ist) ist keine Wertung.
 *
 * Rein, ohne React.
 */
import { z } from 'zod';
import type { ForfeitAbsent, ForfeitScore, Match, Tournament } from '../../types/tournament';

export const FORFEIT_ABSENT_VALUES = ['A', 'B', 'both'] as const satisfies readonly ForfeitAbsent[];

/** Voreinstellung der Wertung: 2:0 (@W2A-022). */
export const DEFAULT_FORFEIT_SCORE: Readonly<ForfeitScore> = Object.freeze({ winner: 2, loser: 0 });

/** Schema der Einstellung: ganze Tore ab 0, die angetretene Seite gewinnt; sonst ungültig (dann gilt 2:0). */
export const ForfeitScoreSchema = z
  .strictObject({ winner: z.number().int().min(1), loser: z.number().int().min(0) })
  .refine((s) => s.winner > s.loser, { message: 'Die Wertung braucht einen Sieger' });

/** Gespeicherte Einstellung lesen (Cloud-`config`, lokale Kopie): unbrauchbar oder fehlend → `undefined`. */
export function parseForfeitScore(raw: unknown): ForfeitScore | undefined {
  const parsed = ForfeitScoreSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** Die geltende Wertung des Turniers (Einstellung oder 2:0). */
export function effectiveForfeitScore(tournament: Pick<Tournament, 'forfeitScore'>): ForfeitScore {
  return parseForfeitScore(tournament.forfeitScore) ?? { ...DEFAULT_FORFEIT_SCORE };
}

/** Wert der Spalte `forfeit_absent` lesen; NULL, fehlend oder unbekannt → `undefined`. */
export function parseForfeitAbsent(raw: unknown): ForfeitAbsent | undefined {
  return FORFEIT_ABSENT_VALUES.find((value) => value === raw);
}

/** Ist das Spiel als Nichtantritt gewertet (Kennzeichen „Wertung“ in allen Ansichten, @W2A-022)? */
export const isForfeitMatch = (match: Pick<Match, 'decidedBy'>): boolean => match.decidedBy === 'forfeit';

/** Sind beide Teams nicht angetreten (nur bei einer Wertung)? */
export const isDoubleForfeit = (match: Pick<Match, 'decidedBy' | 'forfeitAbsent'>): boolean =>
  isForfeitMatch(match) && match.forfeitAbsent === 'both';

/**
 * Tore je Seite, die die Markierung „nicht angetreten“ einträgt (für den Ergebniseintrag `RESULT_ENTRY`, B-12): die
 * fehlende Seite erhält `loser`, die angetretene `winner` Tore (@W2A-025); fehlen beide, 0:0. Bewusst `a`/`b` statt
 * `scoreA`/`scoreB`: die Funktion schreibt keinen Spielstand, das tut nur die Engine (Wächter A-08e).
 */
export function forfeitResultFor(
  tournament: Pick<Tournament, 'forfeitScore'>,
  absent: ForfeitAbsent,
): { a: number; b: number } {
  if (absent === 'both') {
    return { a: 0, b: 0 };
  }
  const { winner, loser } = effectiveForfeitScore(tournament);
  return absent === 'A' ? { a: loser, b: winner } : { a: winner, b: loser };
}
