/**
 * Wann wandert der Uhr-Bereich der Tafel in die Quittungszeile (@SL-240, Daniel „Variante A“, 2026-11-13)? Nur im Endstand am Handy, solange die Karte (oder die
 * Zeile) der Leibchen für das nächste Spiel darunter steht: dort reicht der Platz nicht für große Uhr, Teamnamen und Karte zugleich. Ohne Karte, am Tablet
 * und am Laptop bleibt der Uhr-Bereich wie in @SL-169.
 */
import type { CockpitPhase } from './cockpitPhase';

export function uhrInQuittung(args: { isMobile: boolean; hatLeibchenKarte: boolean; phase: CockpitPhase }): boolean {
  return args.isMobile && args.hatLeibchenKarte && args.phase.zustand === 'abgepfiffen';
}
