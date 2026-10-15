/**
 * Herkunft der Finalplätze aus der Struktur des Turniers (B-28 C5/C6-F, K1). Ist ein Platz besetzt, trägt das Spiel
 * keinen Herkunftsschlüssel mehr: `playoffResolver` ersetzt `teamA`/`teamB` durch die Team-ID, der Plan übernimmt sie als
 * `originalTeamA/B`. Die Herkunft („group-a-2nd“, „semi1-winner“) liefert deshalb der Plan, den der Generator aus derselben
 * Turnierkonfiguration ohne gespeicherte Spiele erzeugt. Zugeordnet wird über die Spielnummer, und nur, wenn die Art des
 * Spiels übereinstimmt; sonst `undefined` und der Aufrufer druckt „noch offen“, nie einen Teamnamen.
 */
import { generateFullSchedule, type GeneratedSchedule, type ScheduledMatch } from '../../core/generators';
import type { Tournament } from '../../types/tournament';

/** Rohschlüssel der Herkunft von Seite `side` eines Finalspiels; `undefined`, wenn er sich nicht sicher bestimmen lässt. */
export type StructuralOrigin = (match: ScheduledMatch, side: 'A' | 'B') => string | undefined;

export function structuralOrigin(tournament: Tournament, schedule: GeneratedSchedule): StructuralOrigin {
  let plan: GeneratedSchedule | undefined;
  try {
    plan = generateFullSchedule({ ...tournament, matches: [] }, 'de');
  } catch {
    plan = undefined;
  }
  const finals = (matches: ScheduledMatch[]): ScheduledMatch[] => matches.filter(m => m.phase !== 'groupStage');
  const numbers = (matches: ScheduledMatch[]): string => finals(matches).map(m => m.matchNumber).sort((a, b) => a - b).join(',');
  // Übergang bis die Herkunft am Spiel gespeichert wird (A-36): weicht der Aufbau des frischen Plans vom Plan des Turniers
  // ab (Zahl der Gruppenspiele, Nummern der Finalspiele), ist keine Zuordnung sicher
  const groupCount = new Set(schedule.teams.map(team => team.group).filter(Boolean)).size;
  const sameShape =
    plan !== undefined &&
    // Gruppen des Plans und der Turnierkonfiguration stimmen überein (3 Gruppen eingestellt, 2 gespielt: Paarungen verschoben)
    (groupCount === 0 || groupCount === tournament.numberOfGroups) &&
    plan.allMatches.length - finals(plan.allMatches).length === schedule.allMatches.length - finals(schedule.allMatches).length &&
    numbers(plan.allMatches) === numbers(schedule.allMatches);
  const byNumber = new Map(sameShape && plan ? finals(plan.allMatches).map(m => [m.matchNumber, m]) : []);
  return (match, side) => {
    const fresh = byNumber.get(match.matchNumber);
    // Runde und Art müssen übereinstimmen (Halbfinale, Viertelfinale und Achtelfinale haben alle `finalType` undefined)
    if (!fresh || fresh.finalType !== match.finalType || fresh.phase !== match.phase) {
      return undefined;
    }
    return side === 'A' ? fresh.originalTeamA : fresh.originalTeamB;
  };
}
