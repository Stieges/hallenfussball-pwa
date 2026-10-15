/**
 * K.-o.-Runden aus dem erzeugten Spielplan (B-28a3-3b, Fixliste 1 zu B-28a3-3a). Rein, ohne Zeichnen.
 *
 * Die Runde kommt zuerst aus `phase` (`knockoutRoundOf`). Der Generator setzt `phase` heute aber für alle Finalspiele
 * auf `final` (`scheduleMatches`, C-FINALPHASE-AUS-ID). `final` ist deshalb keine Auskunft über die Runde. Dann zählt
 * die Bracket-Größe: vom Finale aus rückwärts je Runde 2 (Halbfinale), 4 (Viertelfinale), 8 (Achtelfinale) Spiele.
 * Platzierungsspiele (`finalType`) stehen vor dem Finale und zählen nie zum Bracket.
 */
import type { ScheduledMatch } from '../../core/generators';
import { isPlacementFinal, knockoutRoundOf, resolveTiebreakMode } from '../../core/match/tiebreakDecision';
import type { FinalsConfig, KnockoutRound, TiebreakerMode } from '../../types/tournament';

/** Eine Zeile der K.-o.-Regeln: K.-o.-Runde, Platzierungsspiele insgesamt oder nur „Spiel um Platz 3“. */
export type KoKey = KnockoutRound | 'placement' | 'thirdPlace';

/** Runden vom Finale aus rückwärts. Jede frühere Runde hat doppelt so viele Spiele wie die folgende. */
const ROUNDS_BACKWARDS: readonly KnockoutRound[] = ['semifinal', 'quarterfinal', 'roundOf16'];

/**
 * Runde eines Bracket-Spiels aus seiner Phase, nur wenn die Phase eine echte Runde nennt. `final` zählt nicht, weil
 * der Generator es für alle Finalspiele setzt.
 */
function roundOfPhase(match: ScheduledMatch): KnockoutRound | null {
  const round = knockoutRoundOf(match.phase);
  return round === 'final' ? null : round;
}

/**
 * Runden der Bracket-Spiele in Ablaufreihenfolge. Erster Weg: die Phasen, wenn jedes Spiel eine Runde nennt. Sonst
 * der Rückfall über die Zahl der Spiele.
 */
function bracketRounds(bracket: readonly ScheduledMatch[]): KnockoutRound[] {
  const known = bracket.map(roundOfPhase);
  if (known.length > 0 && known.every(round => round !== null)) {
    return ROUNDS_BACKWARDS.filter(round => known.includes(round)).reverse();
  }
  const rounds: KnockoutRound[] = [];
  let remaining = bracket.length;
  let size = 2;
  for (const round of ROUNDS_BACKWARDS) {
    if (remaining >= size) {
      rounds.unshift(round);
      remaining -= size;
    }
    size *= 2;
  }
  // Unvollständiger Plan (Rest ohne Runde): die übrigen Spiele gelten als erste Runde, damit sie nicht still verloren
  // gehen. Das ist eine Notlösung und kommt beim Generator nicht vor.
  if (remaining > 0) {
    rounds.unshift('roundOf16');
  }
  return rounds;
}

/**
 * K.-o.-Schlüssel in Ablaufreihenfolge: Runden vor den Platzierungsspielen, das Finale zuletzt. Ohne Finalspiele
 * (z. B. jeder gegen jeden) leer.
 */
export function koSlotsFrom(finals: readonly ScheduledMatch[]): KoKey[] {
  const placement = finals.filter(m => isPlacementFinal(m.finalType));
  const bracket = finals.filter(m => m.finalType !== 'final' && !isPlacementFinal(m.finalType));
  const rounds = bracketRounds(bracket);

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
