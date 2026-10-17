/**
 * K.-o.-Runden aus dem erzeugten Spielplan (B-28a3-3b, Fixliste 1 zu B-28a3-3a). Rein, ohne Zeichnen.
 *
 * Die Runde kommt zuerst aus `phase` (`knockoutRoundOf`). Der Generator setzt `phase` heute aber für alle Finalspiele
 * auf `final` (`scheduleMatches`, C-FINALPHASE-AUS-ID). `final` ist deshalb keine Auskunft über die Runde. Dann zählt
 * die Bracket-Größe: vom Finale aus rückwärts je Runde 2 (Halbfinale), 4 (Viertelfinale), 8 (Achtelfinale) Spiele.
 * Platzierungsspiele (`finalType`) stehen vor dem Finale und zählen nie zum Bracket.
 */
import type { ScheduledMatch } from '../../core/generators';
import { TIEBREAK_FALLBACK_MODE, isPlacementFinal, knockoutRoundOf, resolveTiebreakMode } from '../../core/match/tiebreakDecision';
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
 * Runde jedes Bracket-Spiels in der Reihenfolge der Eingabe (B-28a3-4b Punkt 4). Nennt jedes Spiel seine Runde über
 * `phase`, gilt sie. Sonst zählt die Bracket-Größe: vom Finale aus rückwärts nach Anstoßzeit je 2, 4, 8 Spiele.
 * Übrige Spiele (unvollständiger Plan) gehen in die früheste Runde, damit sie nicht verloren gehen.
 */
export function bracketRoundPerMatch(bracket: readonly ScheduledMatch[]): KnockoutRound[] {
  const known = bracket.map(roundOfPhase);
  if (known.length > 0 && known.every((round): round is KnockoutRound => round !== null)) {
    return known;
  }
  const result: KnockoutRound[] = bracket.map(() => 'roundOf16');
  const byTime = bracket.map((_, index) => index).sort((a, b) =>
    bracket[a].startTime.getTime() - bracket[b].startTime.getTime() || bracket[a].matchNumber - bracket[b].matchNumber);
  let end = bracket.length;
  let size = 2;
  for (const round of ROUNDS_BACKWARDS) {
    const start = Math.max(0, end - size);
    for (let k = start; k < end; k++) {
      result[byTime[k]] = round;
    }
    end = start;
    size *= 2;
  }
  return result;
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
 * Ohne gespeicherte Regel gilt der Rückfall des Servers „Verlängerung, dann Strafstoßschießen“ (ZA-3, E1, @SL-145).
 */
export function koModeFor(key: KoKey, finalsConfig: FinalsConfig | null | undefined): TiebreakerMode {
  const mode = key === 'placement' || key === 'thirdPlace'
    ? resolveTiebreakMode(finalsConfig, null, 'thirdPlace')
    : resolveTiebreakMode(finalsConfig, key);
  return mode ?? TIEBREAK_FALLBACK_MODE;
}
