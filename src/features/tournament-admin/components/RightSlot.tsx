/**
 * @HE-113: ein einzelner Bereich innerhalb einer Kategorie (z. B. „Spielplan zurücksetzen“, „Backup wiederherstellen“),
 * der nur mit einem Recht angeboten wird. Ohne das Recht steht „Ändern nur durch die Turnierleitung“; solange die Rolle
 * noch lädt, steht ein Platzhalter und nicht der Hinweis. Ist die Rolle UNBEKANNT (Prüfung gescheitert, z. B. kein Netz,
 * und auf diesem Gerät nie gelernt), bleibt der Inhalt für ein Konto und den lokalen Gast sichtbar (Notfall-Weg der
 * Turnierleitung; der Server lehnt Unberechtigte ohnehin ab). Eine anonyme Sitzung (Helfer-Handy) sieht dann den Hinweis.
 * Rechte nur über useCanState; `useCan`, Rolle und Rechtematrix bleiben unberührt.
 */
import type { ReactNode } from 'react';
import type { Permission } from '../../auth/utils/permissions';
import { LeadOnlyHint } from '../../../components/ui/molecules/LeadOnlyHint';
import { CategorySkeleton } from './CategorySkeleton';
import { useRightView } from '../hooks/useRightView';

interface RightSlotProps {
  permission: Permission;
  tournamentId: string;
  children: ReactNode;
}

export function RightSlot({ permission, tournamentId, children }: RightSlotProps) {
  const view = useRightView(permission, tournamentId);
  if (view === 'content') {
    return <>{children}</>;
  }
  return view === 'loading' ? <div data-testid="right-slot-loading"><CategorySkeleton /></div> : <LeadOnlyHint data-testid="right-slot-hint" />;
}
