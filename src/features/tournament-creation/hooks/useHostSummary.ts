/**
 * Die Angaben des Assistenten zu den Mannschaften des Veranstalters (@W4-034): der Plan wird nur erzeugt, wenn
 * mindestens zwei markiert sind (nur dann hängt die Wahl der Eröffnung am Plan), und nur bei Änderung der Felder,
 * die den Plan bestimmen.
 */
import { useMemo } from 'react';
import type { Tournament } from '../../../types/tournament';
import { effectiveHostTeamIds } from '../../../core/models/hostTeams';
import { hostSummary, planForHostSummary, type HostSummary } from '../utils/hostOpeningSummary';

export function useHostSummary(formData: Partial<Tournament>): HostSummary | undefined {
  return useMemo(() => {
    const teams = formData.teams ?? [];
    const marked = effectiveHostTeamIds(formData.hostTeamIds, teams.filter((team) => !team.isRemoved));
    if (marked.length === 0) { return undefined; }
    const schedule = marked.length >= 2 ? planForHostSummary(formData as Tournament) : null;
    return hostSummary({ teams, hostTeamIds: formData.hostTeamIds, openingMode: formData.openingMode, groupSystem: formData.groupSystem }, schedule);
    // formData wechselt bei jeder Eingabe; der Plan hängt nur an diesen Feldern
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.teams, formData.hostTeamIds, formData.openingMode, formData.groupSystem, formData.numberOfFields, formData.numberOfRounds,
    formData.groupPhaseGameDuration, formData.groupPhaseBreakDuration, formData.minRestSlots, formData.numberOfGroups,
    formData.startTime, formData.timeSlot, formData.date, formData.gamePeriods, formData.halftimeBreak, formData.numberOfTeams]);
}
