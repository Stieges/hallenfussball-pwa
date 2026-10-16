/**
 * Felder und Feld-/Gruppenziele für den Monitor-Editor (B-22b-F K4, @ME-061).
 * Dieselbe Feldliste wie die Übernahme-Prüfung: ohne `fields` gelten field-1 … field-N aus der Anzahl,
 * damit die Feldwahl im Editor einen Warnhinweis auflösen kann.
 */

import { useMemo } from 'react';
import type { Tournament } from '../../../types/tournament';
import { useFields } from '../../../hooks';
import type { UseFieldsResult } from '../../../hooks/useFields';
import {
  tournamentFieldList,
  tournamentSlotTargets,
} from '../../../core/services/monitorConfigTransferChecks';
import type { SlotTargets } from '../../../core/services/monitorConfigTransferChecks';

export type UseSlotFieldsResult = UseFieldsResult & { slotTargets: SlotTargets };

export function useSlotFields(
  tournament: Tournament,
  saveTournament: (tournament: Tournament) => Promise<void>
): UseSlotFieldsResult {
  const withSlotFields = useMemo(
    () => ({ ...tournament, fields: tournamentFieldList(tournament) }),
    [tournament]
  );
  const fieldApi = useFields(withSlotFields, saveTournament);
  const slotTargets = useMemo(() => tournamentSlotTargets(tournament), [tournament]);
  return { ...fieldApi, slotTargets };
}
