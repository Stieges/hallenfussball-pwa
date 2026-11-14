/**
 * HallentonCategory – Unterpunkt „Hallenton“ im Admin-Center (H4-8, Route `/tournament/:id/admin/hallenton`).
 * Zugang und Rechte regelt das `CategoryRightGate` (lesen mit `manageScreens`, auch nach dem Turnierende); der Inhalt steht in
 * `features/hallenton/ui/HallentonSeite.tsx`.
 */
import { CategoryPage } from '../shared';
import { HallentonSeite } from '../../../hallenton/ui/HallentonSeite';
import { useBreakpoint } from '../../../../hooks/useBreakpoint';
import { ADMIN_LAYOUT, getAdminCategory } from '../../constants/admin.constants';
import type { Tournament } from '../../../../types/tournament';

interface HallentonCategoryProps {
  tournamentId: string;
  tournament: Tournament;
}

export function HallentonCategory({ tournamentId, tournament }: HallentonCategoryProps) {
  const kategorie = getAdminCategory('hallenton');
  const { isMobile } = useBreakpoint();
  return (
    <CategoryPage icon={kategorie?.icon ?? '🔊'} title={kategorie?.label ?? 'Hallenton'} description={kategorie?.description}>
      <HallentonSeite tournamentId={tournamentId} felderAnzahl={tournament.numberOfFields} seitenleisteBreite={isMobile ? 0 : ADMIN_LAYOUT.sidebarWidth} />
    </CategoryPage>
  );
}

export default HallentonCategory;
