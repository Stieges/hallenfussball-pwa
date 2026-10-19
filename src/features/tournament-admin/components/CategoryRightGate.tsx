/**
 * A-11: Kategorien des Admin Centers, die nur mit einem Recht angeboten werden. Ohne das Recht steht statt der Kategorie
 * „Ändern nur durch die Turnierleitung“ (@W5-017 „Bearbeiten“: Stammdaten, Einstellungen, Sponsoren; @LZ-022 „die
 * öffentliche Ansicht beenden / auf ‚dauerhaft‘ stellen“: Sichtbarkeit). Rechte nur über useCan.
 */
import type { ReactNode } from 'react';
import { useCan } from '../../auth/hooks/useCan';
import type { Permission } from '../../auth/utils/permissions';
import { LeadOnlyHint } from '../../../components/ui/molecules/LeadOnlyHint';
import type { AdminCategoryId } from '../types/admin.types';

const CATEGORY_RIGHT: Partial<Record<AdminCategoryId, Permission>> = {
  metadata: 'tournamentSettings',
  settings: 'tournamentSettings',
  sponsors: 'tournamentSettings',
  visibility: 'manageLifecycle',
};

interface CategoryRightGateProps {
  category: AdminCategoryId;
  tournamentId: string;
  children: ReactNode;
}

function RightCheck({ permission, tournamentId, children }: { permission: Permission; tournamentId: string; children: ReactNode }) {
  return useCan(permission, tournamentId) ? <>{children}</> : <LeadOnlyHint />;
}

export function CategoryRightGate({ category, tournamentId, children }: CategoryRightGateProps) {
  const permission = CATEGORY_RIGHT[category];
  if (!permission) {
    return <>{children}</>;
  }
  return <RightCheck permission={permission} tournamentId={tournamentId}>{children}</RightCheck>;
}
