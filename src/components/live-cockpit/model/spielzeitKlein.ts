/**
 * Wann steht die Spielzeit vor dem Anpfiff klein in der Kopfzeile der Tafel statt groß in der Mitte (@SL-241, Daniel „V1b“, 2026-11-13)? Nur am Handy,
 * solange die Leibchen-Karte oder ihre Zeile unter der Tafel steht (vor dem Anpfiff): dort reicht der Platz nicht für große Spielzeit, beide Teamköpfe und
 * Karte zugleich. Ohne Karte, am Tablet und am Laptop bleibt die Spielzeit groß wie in @SL-197; nach dem Anpfiff läuft die große Uhr wie immer.
 */
import type { CockpitPhase } from './cockpitPhase';

export function spielzeitKlein(args: { isMobile: boolean; hatLeibchenKarte: boolean; phase: CockpitPhase }): boolean {
  return args.isMobile && args.hatLeibchenKarte && args.phase.zustand === 'vorAnpfiff';
}
