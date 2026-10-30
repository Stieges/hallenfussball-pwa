/**
 * „Spiel fortsetzen“ nach dem Abpfiff (LT-6, Befund C-FORTSETZEN-NICHT-GEBUNDEN). Rein, ohne React.
 *
 * Angeboten nur, solange der Endstand als Quittung steht (höchstens 30 Sekunden nach dem Abpfiff, nicht nach „Weiter“,
 * @SL-075, @SL-162), mit Steuerrecht, und wenn die Engine es zuließe (Ende durch Ablauf, einmal, nicht nach dem
 * Strafstoßschießen – `fortsetzenSperre`, @SL-074, @SL-146, @SL-104). Tom stellt die Restzeit ein (@SL-074: „die Restzeit auf
 * 0:40“); daraus wird der Uhrstand des REOPEN: Grenze des Abschnitts minus Restzeit (`limitClockMs - rest`).
 * Grenzen der Restzeit wie bei „Uhr korrigieren“ (@SL-012, @SL-077): die Spielzeit liegt vor dem Ende des Abschnitts und nicht
 * vor dem jüngsten Eintrag des Abschnitts.
 */
import type { PhaseView } from '../engine/phaseView';

/** Schritt des Reglers in Sekunden (wie „Uhr korrigieren“). */
export const FORTSETZEN_SCHRITT_S = 10;
/** Vorbelegung der Restzeit beim Öffnen: eine Minute (vergessenes Anhalten in der letzten Minute, Zone 1 B1.1). */
export const FORTSETZEN_VORGABE_S = 60;

export type FortsetzenAnsicht = Pick<PhaseView, 'status' | 'quittungRestMs' | 'fortsetzenSperre' | 'sectionLimitMs' | 'fortsetzenFruehestMs' | 'limitClockMs'>;

export interface FortsetzenLage {
  /** Dieses Gerät steuert das Feld (`kannSteuern`). */
  kannSteuern: boolean;
  /** Der Endstand dieses Spiels steht noch als Quittung (nicht nach „Weiter“). */
  endstandSteht: boolean;
}

export interface RestGrenzen {
  /** Kleinste Restzeit in Sekunden (ein Schritt, sonst die größte). */
  min: number;
  /** Größte Restzeit: bis zum jüngsten Eintrag des Abschnitts. */
  max: number;
  /** Vorbelegung beim Öffnen. */
  start: number;
}

export function restGrenzenOf(view: Pick<FortsetzenAnsicht, 'sectionLimitMs' | 'fortsetzenFruehestMs'>): RestGrenzen {
  const max = Math.max(0, Math.floor((view.sectionLimitMs - (view.fortsetzenFruehestMs ?? view.sectionLimitMs)) / 1000));
  return { min: Math.min(FORTSETZEN_SCHRITT_S, max), max, start: Math.min(FORTSETZEN_VORGABE_S, max) };
}

/** Bietet das Cockpit „Spiel fortsetzen“ jetzt an? */
export function fortsetzenMoeglich(view: FortsetzenAnsicht | null, lage: FortsetzenLage): boolean {
  if (view === null || !lage.kannSteuern || !lage.endstandSteht || view.status !== 'finished') {
    return false;
  }
  return (view.quittungRestMs ?? 0) > 0 && view.fortsetzenSperre === null && restGrenzenOf(view).max > 0;
}

/** Uhrstand (absolute Spieluhr, ms) für das REOPEN aus der eingestellten Restzeit. */
export function fortsetzenUhrMs(view: Pick<FortsetzenAnsicht, 'limitClockMs'>, restSekunden: number): number {
  return view.limitClockMs - restSekunden * 1000;
}
