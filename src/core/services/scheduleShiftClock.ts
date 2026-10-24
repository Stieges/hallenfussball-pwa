/**
 * B-26 Zeitbasis für „Zeiten verschieben“ (Review PR #376, A4): Die Regeln vergleichen Anpfiffe mit „jetzt“. Beides muss dieselbe
 * Wanduhr sein wie im Rest der App – Anpfiff = Turnierdatum + Uhrzeit (`kickoffInstant`, C-KOPIE-ANSTOSS-ALTES-DATUM),
 * „jetzt“ = Serverzeit als Wanduhr der Turnier-Zeitzone (`toTournamentLocal`, A-36b). So stimmen Vorziehen, „beginnt in X Minuten“
 * und die 30-Minuten-Regel auch für eine Kopie mit neuem Datum und auf einem Gerät in einer anderen Zeitzone.
 */
import type { Match } from '../../types/tournament';
import { kickoffInstant, toTournamentLocal, TOURNAMENT_TIME_ZONE } from '../view/time';

/** Spiele mit Anpfiff (und ursprünglicher Uhrzeit) am Turnierdatum. */
export function onTournamentDay(matches: readonly Match[], tournamentDate: string | undefined): Match[] {
  return matches.map((m) => {
    const scheduledTime = kickoffInstant(tournamentDate, m.scheduledTime);
    const originalStart = kickoffInstant(tournamentDate, m.originalStart);
    return {
      ...m,
      ...(scheduledTime === undefined ? {} : { scheduledTime }),
      ...(originalStart === undefined ? {} : { originalStart }),
    };
  });
}

/** Ein Zeitpunkt (Serverzeit, echter Anpfiff) als Wanduhr der Turnier-Zeitzone, im selben Format wie `onTournamentDay`. */
export function tournamentWallClock(instant: Date, timeZone: string = TOURNAMENT_TIME_ZONE): Date {
  const clock = toTournamentLocal(instant, timeZone);
  const wall = new Date(`${clock.date}T${clock.time}:00`);
  wall.setSeconds(instant.getUTCSeconds(), instant.getUTCMilliseconds());
  return wall;
}

/**
 * Tatsächlicher Anpfiff eines laufenden Spiels aus dem Stand der Uhr (Start des laufenden Abschnitts minus schon gespielte
 * Sekunden), als Wanduhr; ohne Uhrstand `undefined`.
 */
export function actualKickoffWallClock(match: Match, timeZone: string = TOURNAMENT_TIME_ZONE): Date | undefined {
  if (match.timerStartTime === undefined) {
    return undefined;
  }
  const started = new Date(match.timerStartTime).getTime() - (match.timerElapsedSeconds ?? 0) * 1000;
  return Number.isNaN(started) ? undefined : tournamentWallClock(new Date(started), timeZone);
}
