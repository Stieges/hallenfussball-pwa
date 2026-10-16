/**
 * K.-o.-Entscheidung bei Unentschieden (B-04c, @W2A-007/@W2A-009/@W2A-039).
 *
 * GENAU EINE Ermittlung der Entscheidungsregel — Konsumennten sind die
 * Spielsteuerung/Cockpit (der Anpfiff über die Engine-Regeln schreibt das
 * Ergebnis als `tiebreakerMode` auf das Match, das Cockpit zeigt es nach dem
 * Unentschieden an) und der Monitor (monitorTiebreakerMode). Keine zweite,
 * abweichende Ermittlung irgendwo im Code.
 *
 * B-04c Fixrunde 2 (@W2A-039): Platzierungsspiele haben eine eigene Regel. Die
 * Klassifizierung als Platzierungsspiel läuft über das Feld `match.finalType`
 * (thirdPlace/fifthSixth/seventhEighth) — NICHT über die Phase (die
 * Phasen-Ermittlung aus der ID ist ein bekannter Fehler, Spur A).
 */
import type {
  FinalsConfig,
  FinalsPreset,
  KnockoutRound,
  Match,
  TiebreakerMode,
  TiebreakerRoundKey,
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

const PLACEMENT_FINAL_TYPES: readonly NonNullable<Match['finalType']>[] = [
  'thirdPlace',
  'fifthSixth',
  'seventhEighth',
];

const TIEBREAKER_MODES: readonly TiebreakerMode[] = [
  'shootout',
  'overtime-then-shootout',
  'goldenGoal',
];

const TIEBREAKER_ROUND_KEYS: readonly TiebreakerRoundKey[] = [
  'roundOf16',
  'quarterfinal',
  'semifinal',
  'final',
  'placement',
];

/** Gültiger Regelwert (Import-Prüfung, B-04c Fixrunde 3 / F3-1). */
export function isTiebreakerMode(value: unknown): value is TiebreakerMode {
  return TIEBREAKER_MODES.some((modus) => modus === value);
}

/** Gültiger Rundenschlüssel inkl. `placement` (Import-Prüfung, B-04c Fixrunde 3 / F3-1). */
export function isTiebreakerRoundKey(key: string): key is TiebreakerRoundKey {
  return TIEBREAKER_ROUND_KEYS.some((schluessel) => schluessel === key);
}

const PRESETS_WITH_PLACEMENT_GAMES: readonly FinalsPreset[] = [
  'top-4',
  'top-8',
  'top-16',
  'all-places',
];

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
 * Platzierungsspiel? Erkennung über `match.finalType` (Spiel um Platz 3/5/7) —
 * bewusst NICHT über die Phase (@W2A-039; Phasen-Ermittlung aus der ID: Spur A).
 */
export function isPlacementFinal(finalType: Match['finalType'] | null | undefined): boolean {
  return PLACEMENT_FINAL_TYPES.some((typ) => typ === finalType);
}

/** Finalmodus mit Platzierungsspielen (eigene UI-Zeile „Platzierungsspiele“, @W2A-039). */
export function presetHasPlacementGames(preset: FinalsPreset): boolean {
  return PRESETS_WITH_PLACEMENT_GAMES.some((modus) => modus === preset);
}

/**
 * Entscheidung bei Unentschieden für eine K.-o.-Runde des gespeicherten Turniers.
 *
 * `undefined` = keine Entscheidung (z. B. Gruppenspiel). Die Runden-Regel
 * `finalsConfig.tiebreakerByRound[round]` überschreibt die Vorgabe
 * `finalsConfig.tiebreaker` (@W2A-007). Ohne jede gespeicherte Regel gilt in einer
 * K.-o.-Runde derselbe Rückfall wie beim Server: `'shootout'` (S14).
 *
 * Platzierungsspiele (`finalType` thirdPlace/fifthSixth/seventhEighth) folgen der
 * eigenen Regel `tiebreakerByRound.placement`, dann der Regel des Finales
 * (`tiebreakerByRound.final`), dann der bisherigen Kette (@W2A-039).
 */
export function resolveTiebreakMode(
  finalsConfig: FinalsConfig | null | undefined,
  round: KnockoutRound | null | undefined,
  finalType?: Match['finalType'] | null,
): TiebreakerMode | undefined {
  if (isPlacementFinal(finalType)) {
    return (
      finalsConfig?.tiebreakerByRound?.placement ??
      finalsConfig?.tiebreakerByRound?.final ??
      finalsConfig?.tiebreaker ??
      'shootout'
    );
  }
  if (!round) {
    return undefined;
  }
  return finalsConfig?.tiebreakerByRound?.[round] ?? finalsConfig?.tiebreaker ?? 'shootout';
}
