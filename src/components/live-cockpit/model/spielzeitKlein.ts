/**
 * Wann steht die Spielzeit vor dem Anpfiff klein in der Kopfzeile der Tafel statt groß in der Mitte (@SL-241, Daniel 2026-11-13: „am Handy immer“)? Am Handy
 * vor jedem Anpfiff, unabhängig von der Leibchen-Karte: so kappt auf keinem Weg etwas, und die Tafel ändert ihre Höhe bei keinem Zustand der Karte. Am Tablet und am
 * Laptop bleibt die Spielzeit groß wie in @SL-197; nach dem Anpfiff läuft die große Uhr wie immer.
 */
import type { CockpitPhase } from './cockpitPhase';

export function spielzeitKlein(args: { isMobile: boolean; phase: CockpitPhase }): boolean {
  return args.isMobile && args.phase.zustand === 'vorAnpfiff';
}
