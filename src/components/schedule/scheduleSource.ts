/**
 * Was die Spielplan-Komponenten von einem Turnier lesen (A-04b, K5-Rest aus A-04a).
 *
 * `ScheduleDisplay` hat nur einen `GeneratedSchedule`, kein `Tournament`. Statt ein Turnier mit `as unknown as`
 * vorzutäuschen, nennen die Komponenten ihre Eingabe als schmalen Typ: ein `Tournament` passt, ein Stand-in
 * aus Gruppen, Teams und Spielen ebenso.
 */
import type { Tournament } from '../../types/tournament';
import type { SideSource } from './matchSides';

/** Anzeige-Eingabe der Karten und Tabellen: Teams, Gruppen, Spiele (Herkunft) und die Wertungsregeln. */
export type ScheduleSource = SideSource & Partial<Pick<Tournament, 'id' | 'placementLogic'>>;
