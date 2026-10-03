/**
 * Was die Spielplan-Komponenten von einem Turnier lesen (A-04b, K5-Rest aus A-04a).
 *
 * `ScheduleDisplay` hat nur einen `GeneratedSchedule`, kein `Tournament`. Statt ein Turnier mit `as unknown as`
 * vorzutäuschen, nennen die Komponenten ihre Eingabe als schmalen Typ: ein `Tournament` passt, ein Stand-in
 * aus Gruppen, Teams und Spielen ebenso.
 */
import type { ScheduledMatch } from '../../core/generators';
import { transitionalSides } from '../../core/models/matchSlot';
import type { Match, Tournament } from '../../types/tournament';
import type { ConflictSource } from '../../features/schedule-editor/hooks/useMatchConflicts';
import type { SideSource } from './matchSides';

/** Anzeige-Eingabe der Karten und Tabellen: Teams, Gruppen, Spiele (Herkunft) und die Wertungsregeln. */
export type ScheduleSource = SideSource & Partial<Pick<Tournament, 'id' | 'placementLogic'>>;

/** Eingabe der Vorrunde: zusätzlich, was die Konflikterkennung im Bearbeitungsmodus braucht. */
export type GroupStageSource = ScheduleSource & ConflictSource;

/** Ein angezeigtes Spiel als `Match` für die Konflikterkennung (Zeit aus `startTime`, Seiten aus den Slots). */
export function toConflictMatch(scheduled: ScheduledMatch): Match {
  return {
    id: scheduled.id,
    round: scheduled.matchNumber,
    field: scheduled.field,
    slot: scheduled.slot,
    slotA: scheduled.slotA,
    slotB: scheduled.slotB,
    ...transitionalSides(scheduled.slotA, scheduled.slotB),
    group: scheduled.group,
    label: scheduled.label,
    matchNumber: scheduled.matchNumber,
    scheduledTime: scheduled.startTime,
    referee: scheduled.referee,
  };
}
