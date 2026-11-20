/**
 * @HE-113: ein einzelner Bereich innerhalb einer Kategorie (z. B. „Spielplan zurücksetzen“, „Sicherung wiederherstellen“),
 * der nur mit einem Recht angeboten wird. Ohne das Recht steht „Ändern nur durch die Turnierleitung“; solange die Rolle
 * noch lädt, steht ein Platzhalter und nicht der Hinweis (die Turnierleitung sieht ihn nie aufblitzen). Rechte nur über
 * useCanState (= useCan plus Ladezustand); `useCan`, Rolle und Rechtematrix bleiben unberührt.
 */
import type { ReactNode } from 'react';
import { useCanState } from '../../auth/hooks/useCan';
import type { Permission } from '../../auth/utils/permissions';
import { LeadOnlyHint } from '../../../components/ui/molecules/LeadOnlyHint';
import { CategorySkeleton } from './CategorySkeleton';

interface RightSlotProps {
  permission: Permission;
  tournamentId: string;
  children: ReactNode;
}

export function RightSlot({ permission, tournamentId, children }: RightSlotProps) {
  const { allowed, isLoading } = useCanState(permission, tournamentId);
  if (allowed) {
    return <>{children}</>;
  }
  return isLoading ? <div data-testid="right-slot-loading"><CategorySkeleton /></div> : <LeadOnlyHint data-testid="right-slot-hint" />;
}
