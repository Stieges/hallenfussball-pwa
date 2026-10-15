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

export function structuralOrigin(tournament: Tournament): StructuralOrigin {
  let plan: GeneratedSchedule | undefined;
  try {
    plan = generateFullSchedule({ ...tournament, matches: [] }, 'de');
  } catch {
    plan = undefined;
  }
  const byNumber = new Map((plan?.allMatches ?? []).filter(m => m.phase !== 'groupStage').map(m => [m.matchNumber, m]));
  return (match, side) => {
    const fresh = byNumber.get(match.matchNumber);
    if (!fresh || fresh.finalType !== match.finalType) {
      return undefined;
    }
    return side === 'A' ? fresh.originalTeamA : fresh.originalTeamB;
  };
}
