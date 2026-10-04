/**
 * HelpCategory - Help & Support
 *
 * Platzhalter-Liste Nr. 20 (Record 2026-10-02_oberflaeche.md): Die neun
 * Knöpfe ohne Wirkung (u. a. „E-Mail Support" ohne belegte Adresse) und die
 * erfundenen Tastenkürzel sind ausgeblendet. Ein Kontakt zum Support kommt
 * erst mit einer belegten Adresse (Zielbild Ü3, Impressum).
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.10
 */

import type { Tournament } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface HelpCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HelpCategory(_props: HelpCategoryProps) {
  return null;
}

export default HelpCategory;
