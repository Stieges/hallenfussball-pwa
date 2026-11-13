/**
 * Zusatz „beendet durch Tor“ an der Zeitstrafe im Ereignisprotokoll des Cockpits (@SL-242, Zusammenspiel @SL-030, @SL-044,
 * @SL-200). Kein eigenes Ereignis: Die Antwort kommt aus derselben Ableitung wie das Ende der Strafe im Cockpit
 * (`penaltyStatuses`/`resolvePenalties`), über die wirksamen Strafen und Tore -- Zurückgenommenes ist dort schon entfernt, deshalb
 * verschwindet der Zusatz mit dem Tor und die Strafe läuft weiter. Eine abgelaufene oder laufende Strafe taucht nicht auf.
 */
import { penaltyStatuses, type MatchState } from '../';

const MS_PER_SECOND = 1000;

/**
 * Strafe (Ereignis-ID) -> volle Sekunde der Spieluhr, in der das beendende Tor fiel (wie die Zeit seiner eigenen Protokollzeile).
 * `elapsedMs` ist die aktuelle Spielzeit der Uhr, dieselbe wie bei der Tafel: Wurde die Uhr nach dem Tor zurückgestellt, sieht die
 * Tafel die Strafe wieder als laufend, und das Protokoll trägt dann keinen Zusatz (kein Widerspruch zwischen beiden).
 */
export function penaltyEndSeconds(state: MatchState, elapsedMs: number): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  for (const { penalty, endedByGoal } of penaltyStatuses(state, elapsedMs)) {
    if (endedByGoal !== null) {
      result.set(penalty.id, Math.floor(endedByGoal.atMs / MS_PER_SECOND));
    }
  }
  return result;
}
