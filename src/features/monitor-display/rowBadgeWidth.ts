/**
 * Breite der Abzeichen-Spalte in den Spielzeilen je Turnier (@ZM-151, @ZM-185).
 *
 * Das längste Wort, das in DIESEM Turnier als Abzeichen vorkommen kann, bestimmt die Breite – gleich in allen Zeilen, auf allen Seiten
 * und in allen Folien, damit die Kästen an derselben Stelle stehen. „Verlängerung“ und „Strafstoßschießen“ gibt es nur in K.-o.-Spielen
 * (Server: `knockout = phase != groupStage`); ein Gleichstand in der Gruppe ist eine Platzentscheidung (StandingDecision), kein Spiel
 * mit Abzeichen. Zwei feste Breiten (Token, im Browser gemessen) statt einer Schätzung aus der Zeichenzahl: eine für Turniere ohne
 * K.-o.-Spiele, eine für Turniere mit. Kein React.
 */
import { displayLayout, displayList } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';

/** Gibt es in diesem Turnier K.-o.-Spiele (Finalrunde eingerichtet oder ein Spiel außerhalb der Gruppenphase)? */
export function hasKnockoutMatches(tournament: Tournament): boolean {
  const cfg = tournament.finalsConfig;
  return (cfg !== undefined && cfg.preset !== 'none') || tournament.matches.some((m) => (m.phase ?? 'groupStage') !== 'groupStage');
}

/** Flex-Breite der Abzeichen-Spalte (Zeilen) für dieses Turnier: Wortbreite (Token) plus seitliches Polster des Abzeichens. */
export function rowBadgeWidth(tournament: Tournament): string {
  const word = hasKnockoutMatches(tournament) ? displayList.badgeColumnKnockout : displayList.badgeColumnGroup;
  return `calc(${word} + 2 * ${displayLayout.scoreArea.badgePadX})`;
}
