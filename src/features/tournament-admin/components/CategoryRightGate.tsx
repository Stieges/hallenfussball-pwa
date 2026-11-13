/**
 * A-11: Kategorien des Admin Centers, die nur mit einem Recht angeboten werden. Ohne das Recht steht statt der Kategorie
 * „Ändern nur durch die Turnierleitung“ (@W5-017 „Bearbeiten“: Stammdaten, Einstellungen, Sponsoren; @LZ-022 „die
 * öffentliche Ansicht beenden / auf ‚dauerhaft‘ stellen“: Sichtbarkeit). Rechte nur über useCan.
 */
import type { ReactNode } from 'react';
import { useCan, useCanState } from '../../auth/hooks/useCan';
import { useTournamentClosed } from '../../../hooks/useTournamentClosed';
import { TournamentClosedHint } from '../../../components/ui/molecules/TournamentClosedHint';
import type { Permission } from '../../auth/utils/permissions';
import { LeadOnlyHint } from '../../../components/ui/molecules/LeadOnlyHint';
import type { AdminCategoryId } from '../types/admin.types';
import { CategorySkeleton } from './CategorySkeleton';

const CATEGORY_RIGHT: Partial<Record<AdminCategoryId, Permission>> = {
  metadata: 'tournamentSettings',
  settings: 'tournamentSettings',
  sponsors: 'tournamentSettings',
  visibility: 'manageLifecycle',
};

/**
 * R3-3 (@LZ-037): die einzige Kategorie, die nach dem Abschluss offen bleibt -- öffentliche Ansicht teilen/beenden. Was
 * darin sonst steht (Zuschauer-Schalter), sperrt sich selbst über `useCan('tournamentSettings')`.
 */
const OPEN_AFTER_CLOSE: ReadonlySet<AdminCategoryId> = new Set<AdminCategoryId>(['visibility']);

/**
 * R3-3 (@LZ-036): Kategorien ohne eigenes Recht, deren Einstellungen im Turnier gespeichert werden (Cockpit-Regeln, Ton):
 * nach dem Abschluss steht dort nur der Hinweis. „Gefahrenbereich“ regelt sich selbst (Zurücksetzen entfällt, Löschen
 * braucht `deleteTournament`).
 */
const CLOSED_LOCKED: ReadonlySet<AdminCategoryId> = new Set<AdminCategoryId>(['match-cockpit']);

interface CategoryRightGateProps {
  category: AdminCategoryId;
  tournamentId: string;
  children: ReactNode;
}

function RightCheck({ permission, category, tournamentId, children }: { permission: Permission; category: AdminCategoryId; tournamentId: string; children: ReactNode }) {
  const allowed = useCan(permission, tournamentId, { openAfterClose: OPEN_AFTER_CLOSE.has(category) });
  const closed = useTournamentClosed(tournamentId);
  if (allowed) {
    return <>{children}</>;
  }
  // Abgeschlossen: der Grund ist der Abschluss, nicht ein fehlendes Recht
  return closed ? <TournamentClosedHint /> : <LeadOnlyHint />;
}

/**
 * H4-8 (@HT-022, @HT-046): „Hallenton“ lesen darf, wer `manageScreens` hat – auch nach dem Turnierende (dann lesbar, ändern sperrt jede
 * Taste selbst über `useCan('manageScreens')` ohne Ausnahme). Kein `CLOSED_LOCKED`, kein `RightCheck`: ohne das Recht steht immer
 * „Ändern nur durch die Turnierleitung“ (Helfer, Helfer-Zugang und Bildschirm), nie der Abschluss-Hinweis.
 */
function HallentonLesen({ tournamentId, children }: { tournamentId: string; children: ReactNode }) {
  const { allowed, isLoading } = useCanState('manageScreens', tournamentId, { openAfterClose: true });
  if (allowed) {
    return <>{children}</>;
  }
  return isLoading ? <CategorySkeleton /> : <LeadOnlyHint />;
}

export function CategoryRightGate({ category, tournamentId, children }: CategoryRightGateProps) {
  const closed = useTournamentClosed(tournamentId);
  if (category === 'hallenton') {
    return <HallentonLesen tournamentId={tournamentId}>{children}</HallentonLesen>;
  }
  if (closed && CLOSED_LOCKED.has(category)) {
    return <TournamentClosedHint />;
  }
  const permission = CATEGORY_RIGHT[category];
  if (!permission) {
    return <>{children}</>;
  }
  return <RightCheck permission={permission} category={category} tournamentId={tournamentId}>{children}</RightCheck>;
}
