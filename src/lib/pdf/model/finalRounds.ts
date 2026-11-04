/**
 * Runden der Finalrunde (B-28a3-4b Punkt 4, @DR-019): die Finalspiele nach Runden gegliedert, Runden in der Reihenfolge ihrer
 * ersten Anstoßzeit, Spiele darin nach Anstoßzeit. Rein; die Überschrift kommt aus den Übersetzungen, die Regel der Runde aus
 * den Einstellungen des Turniers.
 */
import type { ScheduledMatch } from '../../../core/generators';
import type { FinalsConfig, KnockoutRound, TiebreakerMode } from '../../../types/tournament';
import { bracketRoundPerMatch, koModeFor, type KoKey } from '../koSlots';
import type { StatefulMatch } from '../tournamentState';
import type { PdfTexts } from '../translations';
import type { SmallLineKind } from './types';

/** Überschrift einer Runde: eine Runde des Brackets oder ein Platzierungsspiel. */
export type FinalRoundKey = KnockoutRound | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';

export interface FinalRound {
  key: FinalRoundKey;
  /** Spiele der Runde, nach Anstoßzeit (bei gleicher Zeit nach Spielnummer). */
  matches: StatefulMatch[];
}

const PLACEMENT_KEYS: readonly FinalRoundKey[] = ['thirdPlace', 'fifthSixth', 'seventhEighth'];

/** Zeitfolge: Anstoßzeit, dann Spielnummer. */
function byKickoff(a: ScheduledMatch, b: ScheduledMatch): number {
  return a.startTime.getTime() - b.startTime.getTime() || a.matchNumber - b.matchNumber;
}

/** Finalspiele in Runden gegliedert. Die Runde eines Bracket-Spiels kommt aus `bracketRoundPerMatch` (Phase oder Bracket-Größe). */
export function finalRounds(finals: readonly StatefulMatch[]): FinalRound[] {
  const bracket = finals.filter(m => m.finalType !== 'final' && !PLACEMENT_KEYS.includes(m.finalType as FinalRoundKey));
  const rounds = bracketRoundPerMatch(bracket);
  const bracketRound = new Map<ScheduledMatch, KnockoutRound>(bracket.map((match, index) => [match, rounds[index]]));

  const groups = new Map<FinalRoundKey, StatefulMatch[]>();
  for (const match of finals) {
    const key: FinalRoundKey = match.finalType === 'final'
      ? 'final'
      : (match.finalType as FinalRoundKey | undefined) ?? bracketRound.get(match) ?? 'roundOf16';
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }

  return Array.from(groups, ([key, matches]) => ({ key, matches: [...matches].sort(byKickoff) }))
    .sort((a, b) => byKickoff(a.matches[0], b.matches[0]));
}

/** Überschrift einer Runde über die Übersetzungen. */
export function roundTitle(key: FinalRoundKey, t: PdfTexts): string {
  switch (key) {
    case 'thirdPlace': return t.thirdPlace;
    case 'fifthSixth': return t.fifthSixth;
    case 'seventhEighth': return t.seventhEighth;
    default: return t.phaseTitle(key, key);
  }
}

/** K.-o.-Schlüssel der Regel einer Runde: Platzierungsspiele 5 und 7 folgen der Regel „placement“. */
function koKeyOf(key: FinalRoundKey): KoKey {
  return key === 'fifthSixth' || key === 'seventhEighth' ? 'placement' : key;
}

/**
 * Kleine Linien, die die Regel der Runde vorsieht (@DR-019): Strafstoßschießen allein; Verlängerung, dann Strafstoßschießen
 * und Golden Goal beide (auch ein Golden-Goal-Spiel kann im Strafstoßschießen enden).
 */
export function smallKindsFor(key: FinalRoundKey, finalsConfig: FinalsConfig | null | undefined): SmallLineKind[] {
  const mode: TiebreakerMode = koModeFor(koKeyOf(key), finalsConfig);
  return mode === 'shootout' ? ['shootout'] : ['overtime', 'shootout'];
}
