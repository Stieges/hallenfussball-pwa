/**
 * Neulade-Regel des Monitors (B-19b, @ZM-124, @ZM-128, @ME-012) – rein, ohne React.
 *
 * Eine neue App-Version lädt der Monitor nur
 * - bei mehr als einer Folie: beim Folienwechsel zu einer Folie ohne laufendes Spiel (seit dem Eintreffen der
 *   neuen Version mindestens ein Wechsel), oder
 * - bei nur einer Folie: sobald auf keinem Feld ein Spiel läuft.
 * „Laufend“ = running ODER paused (ein unterbrochenes Spiel ist nicht vorbei, `isMatchInProgress`).
 */
import {
  isMatchInProgress,
  liveSpielLaeuft,
  type ProgramSlide,
  type RuleMatch,
} from './slideProgramme';

export interface NeuladenEingabe {
  slides: readonly ProgramSlide[];
  matches: readonly RuleMatch[];
  /** Index der gezeigten Folie. */
  index: number;
  /** Folienwechsel seit dem Eintreffen der neuen Version. */
  wechselSeitUpdate: number;
}

export function neuladenErlaubt(eingabe: NeuladenEingabe): boolean {
  const { slides, matches, index, wechselSeitUpdate } = eingabe;
  if (slides.length <= 1) {
    return !matches.some(isMatchInProgress);
  }
  const gezeigt = slides[index];
  if (gezeigt === undefined) {
    return false;
  }
  return wechselSeitUpdate > 0 && !liveSpielLaeuft([gezeigt], matches);
}
