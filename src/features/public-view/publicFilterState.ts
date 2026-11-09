/**
 * Filter der Zuschauer-Seite, die hinter der Taste „Filter“ liegen (@ZM-196, @ZM-197): Phase und Status (und der Altlink-Schalter
 * „Nur Mein Team“, `my=1`). Die Gruppen-Auswahl steht sichtbar in der Zeile und zählt nicht mit. Ein gesetzter Filter bleibt
 * sichtbar: die Taste trägt die Zahl, über dem Spielplan steht die Hinweiszeile mit „Alle zeigen“.
 */
import type { ViewFilters } from './publicScheduleFilters';

/** Wörter der Hinweiszeile in der Reihenfolge Phase, Status, Mein Team. */
export type HiddenFilterKey = 'phase:groupStage' | 'phase:final' | 'status:scheduled' | 'status:live' | 'status:finished' | 'myTeam';

export function hiddenFilterKeys(filters: ViewFilters): HiddenFilterKey[] {
  const keys: HiddenFilterKey[] = [];
  if (filters.selectedPhase !== 'all') {
    keys.push(`phase:${filters.selectedPhase}`);
  }
  if (filters.selectedStatus !== 'all') {
    keys.push(`status:${filters.selectedStatus}`);
  }
  if (filters.showOnlyMyTeam && filters.myTeamId !== null) {
    keys.push('myTeam');
  }
  return keys;
}
