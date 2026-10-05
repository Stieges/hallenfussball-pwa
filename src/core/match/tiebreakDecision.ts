/**
 * K.-o.-Entscheidung bei Unentschieden (B-04c, @W2A-007/@W2A-009).
 *
 * GENAU EINE Ermittlung der Entscheidungsregel — Konsumennten sind die
 * Spielsteuerung/Cockpit (MatchExecutionService.initializeMatch schreibt das
 * Ergebnis als `tiebreakerMode` auf das Match, das Cockpit zeigt es nach dem
 * Unentschieden an) und der Monitor (monitorTiebreakerMode). Keine zweite,
 * abweichende Ermittlung irgendwo im Code.
 */
import type {
  FinalsConfig,
  FinalsPreset,
  KnockoutRound,
  TiebreakerMode,
} from '../../types/tournament';

const ROUNDS_BY_PRESET: Record<FinalsPreset, KnockoutRound[]> = {
  none: [],
  'final-only': ['final'],
  'top-4': ['semifinal', 'final'],
  'top-8': ['quarterfinal', 'semifinal', 'final'],
  'top-16': ['roundOf16', 'quarterfinal', 'semifinal', 'final'],
  'all-places': ['semifinal', 'final'],
};

const KNOCKOUT_ROUNDS: readonly KnockoutRound[] = ['roundOf16', 'quarterfinal', 'semifinal', 'final'];

/** K.-o.-Runde aus einer Phasen-Angabe — außerhalb einer K.-o.-Runde (z. B. Gruppenspiel) `null`. */
export function knockoutRoundOf(phase: string | null | undefined): KnockoutRound | null {
  return KNOCKOUT_ROUNDS.find((round) => round === phase) ?? null;
}

/**
 * K.-o.-Runden, für die ein Finalmodus eine Entscheidung bei Unentschieden
 * vorsieht (liefert die Runden der UI-Auswahl je Runde).
 */
export function knockoutRoundsForPreset(preset: FinalsPreset): KnockoutRound[] {
  return ROUNDS_BY_PRESET[preset] ?? [];
}

/**
 * Entscheidung bei Unentschieden für eine K.-o.-Runde des gespeicherten Turniers.
 *
 * `undefined` = keine Entscheidung (z. B. Gruppenspiel). Die Runden-Regel
 * `finalsConfig.tiebreakerByRound[round]` überschreibt die Vorgabe
 * `finalsConfig.tiebreaker` (@W2A-007).
 */
export function resolveTiebreakMode(
  finalsConfig: FinalsConfig | null | undefined,
  round: KnockoutRound | null | undefined,
): TiebreakerMode | undefined {
  if (!round) {
    return undefined;
  }
  return finalsConfig?.tiebreakerByRound?.[round] ?? finalsConfig?.tiebreaker;
}
