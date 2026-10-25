/**
 * toStrafenModel – laufende Zeitstrafen als Karten am Laptop (Plan Cockpit v2 B3; @SL-186).
 *
 * Rein, ohne React. Je Team höchstens zwei Karten (die mit der kürzesten Restzeit zuerst), jede weitere zählt in „+ n weitere“.
 * Die Karten stehen nach Restzeit, die kürzeste oben. Quelle ist die Engine-Ansicht (`PhaseView.penalties`): sie enthält nur laufende,
 * nicht zurückgenommene Strafen und keine nach dem Abpfiff (@SL-097). Teamfarbe am Randstreifen wie im Ergebniskasten (@SL-176).
 */
import type { SideBox } from '../../../core/models/scoreBoxColors';
import type { PhasePenalty } from '../engine/phaseView';
import type { LiveMatch } from '../types';
import type { CockpitKasten } from '../typesFarben';
import { formatUhr } from './toScoreboardModel';

/** So viele Karten je Team; weitere stehen als „+ n weitere“ (@SL-186). */
export const STRAFEN_KARTEN_JE_TEAM = 2;

export interface StrafenKarte {
  id: string;
  teamName: string;
  /** Rückennummer; `null` = ohne Nummer. */
  nummer: number | null;
  /** Restzeit „1:12“. */
  rest: string;
  /** Anteil der Strafe, der noch zu verbüßen ist (0 bis 1): der Balken nimmt ab. */
  anteil: number;
  /** Länge der Strafe in ganzen Minuten (mindestens 1). */
  minuten: number;
  /** Spielzeit im Abschnitt, in dem die Strafe verhängt wurde („3:18“); `null`, wenn sie aus einem früheren Abschnitt stammt. */
  seit: string | null;
  /** Strafe aus der 1. Halbzeit in der 2.: Spielzeit des Beginns in der 1. Halbzeit („9:30“), sonst `null`. */
  seitErsteHalbzeit: string | null;
  /** Restzeit in ms, nach der die Karten sortiert sind. */
  restMs: number;
  kasten: SideBox;
}

/** Weitere Strafen eines Teams, die keine Karte mehr bekommen („+ 1 weitere“ nennt das Team). */
export interface WeitereStrafen { teamName: string; anzahl: number }
export interface StrafenModel { karten: StrafenKarte[]; weitere: number; weitereJeTeam: WeitereStrafen[] }

export const KEINE_STRAFEN: StrafenModel = { karten: [], weitere: 0, weitereJeTeam: [] };

export function toStrafenModel(penalties: readonly PhasePenalty[] | undefined, match: Pick<LiveMatch, 'homeTeam' | 'awayTeam'>, kasten: CockpitKasten): StrafenModel {
  if (!penalties || penalties.length === 0) { return KEINE_STRAFEN; }
  const jeTeam = new Map<string, PhasePenalty[]>();
  for (const strafe of penalties) { jeTeam.set(strafe.teamId, [...(jeTeam.get(strafe.teamId) ?? []), strafe]); }
  const karten: StrafenKarte[] = [];
  const weitereJeTeam: WeitereStrafen[] = [];
  for (const [teamId, strafen] of jeTeam) {
    const seite = teamId === match.homeTeam.id ? 'home' : 'away';
    const name = seite === 'home' ? match.homeTeam.name : match.awayTeam.name;
    const nachRest = [...strafen].sort((a, b) => a.remainingMs - b.remainingMs);
    if (nachRest.length > STRAFEN_KARTEN_JE_TEAM) { weitereJeTeam.push({ teamName: name, anzahl: nachRest.length - STRAFEN_KARTEN_JE_TEAM }); }
    for (const strafe of nachRest.slice(0, STRAFEN_KARTEN_JE_TEAM)) {
      const dauerMs = strafe.durationMs ?? strafe.remainingMs;
      karten.push({
        id: strafe.id, teamName: name, nummer: strafe.playerNumber ?? null, rest: formatUhr(strafe.remainingMs / 1000),
        anteil: dauerMs > 0 ? Math.min(1, strafe.remainingMs / dauerMs) : 0, minuten: Math.max(1, Math.round(dauerMs / 60_000)),
        seit: strafe.seitMs === undefined || strafe.seitMs === null ? null : formatUhr(strafe.seitMs / 1000), kasten: kasten[seite],
        seitErsteHalbzeit: strafe.seitErsteHalbzeitMs === undefined ? null : formatUhr(strafe.seitErsteHalbzeitMs / 1000), restMs: strafe.remainingMs,
      });
    }
  }
  return { karten: karten.sort((a, b) => a.restMs - b.restMs), weitere: weitereJeTeam.reduce((summe, w) => summe + w.anzahl, 0), weitereJeTeam };
}
