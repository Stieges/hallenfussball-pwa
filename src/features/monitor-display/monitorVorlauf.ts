/**
 * Vorlaufzeit der Live-Folie vor dem nächsten Anpfiff (@ZM-138, @ZM-122) – rein, ohne React.
 *
 * Läuft auf dem Feld eines Feld-Monitors kein Spiel, zeigt die Live-Folie ab der Vorlaufzeit vor dem nächsten Anpfiff das
 * nächste Spiel mit Anstoßzeit. Die Vorlaufzeit ist die Pausendauer zwischen den Spielen, mindestens 5 Minuten. Davor (und
 * nach dem letzten Spiel) überspringt der Monitor die Folie.
 */
import { clockKey, minutesBetween, toTournamentLocal, TOURNAMENT_TIME_ZONE, type LocalClock } from '../../core/view';
import type { Tournament } from '../../types/tournament';

/** Kürzeste Vorlaufzeit in Minuten (@ZM-138). */
export const MIN_VORLAUF_MINUTEN = 5;

/** Die Felder eines Spiels, die die Vorlaufzeit braucht; ein Spiel der Ansicht (`MatchView`) erfüllt sie strukturell. */
export interface VorlaufSpiel {
  field: number;
  /** Geplant und noch nicht angepfiffen. */
  isUpcoming?: boolean;
  kickoff?: LocalClock;
  matchNumber?: number;
  /** Vorlaufzeit vor genau diesem Anpfiff in Minuten (Pausendauer, mindestens `MIN_VORLAUF_MINUTEN`). */
  vorlaufMin?: number;
}

type Pausen = Pick<Tournament, 'groupPhaseBreakDuration' | 'finalRoundBreakDuration'>;

/** Vorlaufzeit in Minuten: die Pausendauer der Phase des Spiels, mindestens 5 (@ZM-138). */
export function vorlaufMinuten(pausen: Pausen, phase: 'groupStage' | 'final'): number {
  const pause = phase === 'final'
    ? pausen.finalRoundBreakDuration ?? pausen.groupPhaseBreakDuration ?? 0
    : pausen.groupPhaseBreakDuration ?? 0;
  return Math.max(MIN_VORLAUF_MINUTEN, pause);
}

/** Nächstes Spiel des Felds in Anpfiff-Reihenfolge (wie `currentFor(field).next`); ohne Anstoßzeit keins. */
function naechstesAufFeld(spiele: readonly VorlaufSpiel[], field: number): VorlaufSpiel | undefined {
  const offen = spiele.filter(s => s.field === field && s.isUpcoming === true);
  const geordnet = [...offen].sort((a, b) => {
    return clockKey(a.kickoff).localeCompare(clockKey(b.kickoff)) || (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
  });
  return geordnet[0];
}

/**
 * Beginnt die Vorlaufzeit des nächsten Spiels auf `field` zum Zeitpunkt `nowMs`? Ein überfälliges geplantes Spiel bleibt
 * „nächstes Spiel“ (@ZM-141) und damit in der Vorlaufzeit, bis es angepfiffen wird. Die Uhr läuft in Turnier-Ortszeit
 * (@ZM-111) und auf Minuten genau: „ab 15:25“ gilt von 15:25:00 an.
 */
export function imVorlauf(spiele: readonly VorlaufSpiel[], field: number, nowMs: number): boolean {
  const naechstes = naechstesAufFeld(spiele, field);
  if (naechstes?.kickoff === undefined) { return false; }
  const jetzt = toTournamentLocal(new Date(nowMs), TOURNAMENT_TIME_ZONE);
  return minutesBetween(jetzt, naechstes.kickoff) <= (naechstes.vorlaufMin ?? MIN_VORLAUF_MINUTEN);
}
