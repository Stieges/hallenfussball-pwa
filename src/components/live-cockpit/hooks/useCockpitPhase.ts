import { useMemo } from 'react';
import type { PhaseView } from '../engine/phaseView';
import { cockpitPhaseOf, type CockpitPhase, type CockpitPhaseInput, type LeerGrund } from '../model/cockpitPhase';

/** Spec § 4.3: eine Stelle zum Umschalten auf das Status-Modell von A-36. */
export function useCockpitPhase(match: { status: NonNullable<CockpitPhaseInput['matchStatus']> } | null, view: PhaseView | null, leer: LeerGrund | null): CockpitPhase {
  return useMemo(
    () => cockpitPhaseOf({ view, matchStatus: match?.status ?? null, leer }),
    [view, match?.status, leer],
  );
}
