/**
 * Wann wandert der Uhr-Bereich der Tafel in die Quittungszeile (@SL-240, Daniel 2026-11-13: „am Handy immer“)? Im Endstand am Handy, unabhängig von der
 * Leibchen-Karte: so kappt auf keinem Weg etwas, und die Tafel ändert ihre Höhe bei keinem Zustand der Karte. Am Tablet und am Laptop bleibt der Uhr-Bereich wie in @SL-169.
 */
import type { CockpitPhase } from './cockpitPhase';

export function uhrInQuittung(args: { isMobile: boolean; phase: CockpitPhase }): boolean {
  return args.isMobile && args.phase.zustand === 'abgepfiffen';
}
