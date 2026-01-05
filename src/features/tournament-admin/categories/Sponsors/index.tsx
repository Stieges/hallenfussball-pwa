/**
 * SponsorsCategory - Sponsor Management
 *
 * Wrapper around existing SponsorManagement component.
 *
 * @see docs/concepts/TOURNAMENT-ADMIN-CENTER-KONZEPT-v1.2.md Section 5.5
 */

import { CategoryPage } from '../shared';
import { SponsorManagement } from '../../../tournament-management/SponsorManagement';
import type { Tournament } from '../../../../types/tournament';

// =============================================================================
// PROPS
// =============================================================================

interface SponsorsCategoryProps {
  tournamentId: string;
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SponsorsCategory({
  tournament,
  onTournamentUpdate,
}: SponsorsCategoryProps) {
  const handleTournamentUpdate = async (updatedTournament: Tournament) => {
    onTournamentUpdate(updatedTournament);
  };

  return (
    <CategoryPage
      icon="🎯"
      title="Sponsoren"
      description="Sponsoren verwalten und deren Anzeige konfigurieren"
    >
      <SponsorManagement
        tournament={tournament}
        onTournamentUpdate={handleTournamentUpdate}
      />
    </CategoryPage>
  );
}

export default SponsorsCategory;
