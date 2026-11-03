/**
 * Welche Aktionen die Auswahl eines Spiels im Spielplan zeigt (@SL-193), eine reine Funktion ohne React.
 *
 * Die Tabelle des Szenarios gilt für Gruppenphase und Finalrunde gleich: je Zustand des Spiels (geplant, läuft, beendet)
 * und je Recht (Turnierleitung, Helfer). Gerechnet wird aus dem Status der Ansicht (`ViewMatchStatus`) und drei Rechten
 * (`useCan`); ob ein Weg in der Ansicht angeschlossen ist, sagt `wired` (kein stummer Knopf).
 *
 * Zusätzlich zur Tabelle (Ränder, die das Szenario nicht nennt, aber der Spielplan schon kannte):
 * - gewertet („nicht angetreten“): die Turnierleitung kann die Wertung zurücknehmen (@W2A-026); vor G2 Spur A schon über die
 *   Taste „Wertung zurücknehmen“ an der Spielkarte erreichbar (MatchForfeitAction, `viewStatus === 'awarded'`)
 * - abgesetzt: die Turnierleitung kann trotzdem ein Ergebnis eintragen (@FU-093); vor G2 Spur A öffnete der Tipp auf die Karte
 *   die Schnelleingabe auch bei abgesetzten Spielen (GroupStageSchedule.handleCardClick), die Rückfrage „trotzdem eintragen?“ blieb
 * Beide bleiben, damit keine bestehende Funktion verloren geht.
 */
import type { ViewMatchStatus } from '../../../core/view';

export type MatchActionId =
  | 'enterResult'
  | 'kickOff'
  | 'shiftFrom'
  | 'changeReferee'
  | 'changeField'
  | 'forfeit'
  | 'revokeForfeit'
  | 'toCockpit'
  | 'endAndEnter'
  | 'correct'
  | 'protocol';

/** Rechte aus `useCan`: Turnierleitung im Spielbetrieb, Spielbetrieb (auch Helfer), Zeitplan ändern. */
export interface MatchActionRights {
  lead: boolean;
  play: boolean;
  schedule: boolean;
}

/** Welche Wege die Ansicht überhaupt anbietet (Handler vorhanden, Schiedsrichter und mehrere Felder eingerichtet). */
export interface MatchActionWiring {
  enterResult: boolean;
  cockpit: boolean;
  shiftFrom: boolean;
  referee: boolean;
  field: boolean;
  forfeit: boolean;
  correct: boolean;
  endAndEnter: boolean;
}

export interface MatchActionInput {
  /** Status der Ansicht; ohne Ansicht gilt das Spiel als geplant */
  status: ViewMatchStatus | undefined;
  rights: MatchActionRights;
  wired: MatchActionWiring;
}

/** Zustand des Spiels, wie ihn die Tabelle von @SL-193 nennt. */
export type MatchActionPhase = 'planned' | 'running' | 'finished' | 'awarded' | 'cancelled';

export function actionPhaseOf(status: ViewMatchStatus | undefined): MatchActionPhase {
  switch (status) {
    case 'running':
    case 'paused':
      return 'running';
    case 'finished':
      return 'finished';
    case 'awarded':
      return 'awarded';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'planned';
  }
}

/** Die Aktionen in der Reihenfolge der Tabelle; leer = der Tipp öffnet nichts. */
export function matchActionsFor({ status, rights, wired }: MatchActionInput): MatchActionId[] {
  const { lead, play, schedule } = rights;
  const out: MatchActionId[] = [];
  switch (actionPhaseOf(status)) {
    case 'planned':
      if (lead && wired.enterResult) { out.push('enterResult'); }
      if (play && wired.cockpit) { out.push(lead ? 'kickOff' : 'toCockpit'); }
      if (schedule && wired.shiftFrom) { out.push('shiftFrom'); }
      if (schedule && wired.referee) { out.push('changeReferee'); }
      if (schedule && wired.field) { out.push('changeField'); }
      if (lead && wired.forfeit) { out.push('forfeit'); }
      break;
    case 'running':
      if (play && wired.cockpit) { out.push('toCockpit'); }
      if (lead && wired.endAndEnter) { out.push('endAndEnter'); }
      break;
    case 'finished':
      if (lead && wired.correct) { out.push('correct'); }
      out.push('protocol');
      break;
    case 'awarded':
      if (lead && wired.forfeit) { out.push('revokeForfeit'); }
      break;
    case 'cancelled':
      if (lead && wired.enterResult) { out.push('enterResult'); }
      break;
  }
  return out;
}

/** Aktionen, die nur mit bekannten Teams gehen: sonst sichtbar, aber gesperrt mit Satz (nie stumm weg). */
export const NEEDS_BOTH_TEAMS: ReadonlySet<MatchActionId> = new Set<MatchActionId>(['enterResult', 'forfeit']);
