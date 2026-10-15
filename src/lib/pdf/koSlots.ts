/**
 * K.-o.-Runden aus dem erzeugten Spielplan (B-28a3-3b, Fixliste 1 zu B-28a3-3a). Rein, ohne Zeichnen.
 *
 * Der Generator setzt `phase` für alle Finalspiele auf `final` (`scheduleMatches`), die Runde steckt also nicht im
 * Feld. Sie wird deshalb aus der Zahl der Bracket-Spiele ermittelt: vom Finale aus rückwärts je Runde 2 (Halbfinale),
 * 4 (Viertelfinale), 8 (Achtelfinale) Spiele. Platzierungsspiele (`finalType`) stehen vor dem Finale.
 */
import type { ScheduledMatch } from '../../core/generators';
import { isPlacementFinal, resolveTiebreakMode } from '../../core/match/tiebreakDecision';
import type { FinalsConfig, KnockoutRound, TiebreakerMode } from '../../types/tournament';

/** Eine Zeile der K.-o.-Regeln: K.-o.-Runde, Platzierungsspiele insgesamt oder nur „Spiel um Platz 3“. */
export type KoKey = KnockoutRound | 'placement' | 'thirdPlace';

/** Runden vom Finale aus rückwärts. Jede frühere Runde hat doppelt so viele Spiele wie die folgende. */
const ROUNDS_BACKWARDS: readonly KnockoutRound[] = ['semifinal', 'quarterfinal', 'roundOf16'];

/**
 * K.-o.-Schlüssel in Ablaufreihenfolge: Runden vor den Platzierungsspielen, das Finale zuletzt. Ohne Finalspiele
 * (z. B. jeder gegen jeden) leer.
 */
export function koSlotsFrom(finals: readonly ScheduledMatch[]): KoKey[] {
  const placement = finals.filter(m => isPlacementFinal(m.finalType));
  const bracket = finals.filter(m => m.finalType !== 'final' && !isPlacementFinal(m.finalType)).length;

  const rounds: KnockoutRound[] = [];
  let remaining = bracket;
  let size = 2;
  for (const round of ROUNDS_BACKWARDS) {
    if (remaining >= size) {
      rounds.unshift(round);
      remaining -= size;
    }
    size *= 2;
  }
  // Unvollständiger Plan: übrige Spiele gelten als erste Runde, damit sie nicht still verloren gehen.
  if (remaining > 0) {
    rounds.unshift('roundOf16');
  }

  const slots: KoKey[] = [...rounds];
  if (placement.length === 1 && placement[0].finalType === 'thirdPlace') {
    slots.push('thirdPlace');
  } else if (placement.length > 0) {
    slots.push('placement');
  }
  if (finals.some(m => m.finalType === 'final')) {
    slots.push('final');
  }
  return slots;
}

/**
 * Entscheidungsregel eines K.-o.-Schlüssels. Platzierungsspiele folgen ihrer Regel, dann dem Finale (@W2A-039).
 * `shootout` ist der Rückfall des Servers (S14), falls keine Regel gespeichert ist.
 */
export function koModeFor(key: KoKey, finalsConfig: FinalsConfig | null | undefined): TiebreakerMode {
  const mode = key === 'placement' || key === 'thirdPlace'
    ? resolveTiebreakMode(finalsConfig, null, 'thirdPlace')
    : resolveTiebreakMode(finalsConfig, key);
  return mode ?? 'shootout';
}
