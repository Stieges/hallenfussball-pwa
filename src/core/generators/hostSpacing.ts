/**
 * Abstand zwischen den Spielen der beiden Mannschaften des Veranstalters (@W4-050, @W4-048).
 * Reine Zählung auf dem fertigen Plan: wie oft folgt ein Spiel der einen Mannschaft direkt auf ein Spiel der anderen,
 * und das wievielte Spiel ist das Vereinsduell. Genutzt von der Eröffnung (Auswahl) und der Übersicht (Anzeige).
 */
import type { MatchSides } from '../models/matchSlot';
import { matchSideTeamId } from '../models/matchSlot';

/** Was die Zählung von einem Spiel braucht (Match und ScheduledMatch genügen). */
export type SpacingMatch = MatchSides & { slot?: number; round?: number; field: number; phase?: string };

const slotOf = (match: SpacingMatch): number => match.slot ?? (match.round ?? 1) - 1;

/** Nur Gruppenspiele, in Spielreihenfolge (Zeitfenster, dann Feld). */
function groupMatchesInOrder<T extends SpacingMatch>(matches: readonly T[]): T[] {
  return matches
    .filter((match) => match.phase === undefined || match.phase === 'groupStage')
    .sort((a, b) => slotOf(a) - slotOf(b) || a.field - b.field);
}

function teamsOf(match: SpacingMatch): string[] {
  const ids: string[] = [];
  for (const side of ['A', 'B'] as const) {
    const id = matchSideTeamId(match, side);
    if (id !== undefined) { ids.push(id); }
  }
  return ids;
}

/**
 * Zahl der Stellen, an denen in Spielreihenfolge ein Spiel von `a` (ohne `b`) direkt vor einem Spiel von `b`
 * (ohne `a`) liegt oder umgekehrt. Das Vereinsduell selbst zählt nicht: dort spielen sie gegeneinander.
 */
export function hostFollowCount(matches: readonly SpacingMatch[], a: string, b: string): number {
  const ordered = groupMatchesInOrder(matches);
  let count = 0;
  for (let i = 0; i + 1 < ordered.length; i += 1) {
    const first = teamsOf(ordered[i]);
    const next = teamsOf(ordered[i + 1]);
    const onlyA = (ids: string[]): boolean => ids.includes(a) && !ids.includes(b);
    const onlyB = (ids: string[]): boolean => ids.includes(b) && !ids.includes(a);
    if ((onlyA(first) && onlyB(next)) || (onlyB(first) && onlyA(next))) { count += 1; }
  }
  return count;
}

/** Spielnummer (1-basiert, in Spielreihenfolge) des Vereinsduells `a` gegen `b`; undefined, wenn sie nicht gegeneinander spielen. */
export function hostDuelNumber(matches: readonly SpacingMatch[], a: string, b: string): number | undefined {
  const index = groupMatchesInOrder(matches).findIndex((match) => {
    const ids = teamsOf(match);
    return ids.includes(a) && ids.includes(b);
  });
  return index < 0 ? undefined : index + 1;
}
