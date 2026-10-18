/**
 * SW (@EK-062, Befund C-STRAFSTOSS-NACH-WIEDERERÖFFNEN): Zustand des Strafstoßergebnisses, das mit einem
 * Direkteintrag (A-25a, @FU-094) eingetragen wurde. Eine Regel für TS: `cacheColumns` wertet nur `counts`,
 * der SQL-Zwilling (`match_engine.cache_columns`, 20261028_007) prüft dieselbe Bedingung (beendet, letzte
 * Überschreibung mit Strafstoß, effektiver Gleichstand).
 *
 * - `counts`: beendet, letzte Überschreibung trägt `shootout`, effektiver Endstand gleich. `reopened` → nach
 *   der Überschreibung wurde das Spiel wieder eröffnet; die App fragt das Strafstoßschießen neu ab, vorbelegt
 *   mit `shootout` (B-24/B-07).
 * - `stale`: beendet ohne Gleichstand – das alte Ergebnis zählt nirgends, Klärungsfall (A-35).
 * - `null`: nicht beendet oder kein eingetragenes Strafstoßergebnis. Wirft nie.
 */
import { effectiveScoreFor, type MatchContext, type MatchState } from './types';

export type EnteredShootoutStatus =
  | { kind: 'counts'; shootout: Record<string, number>; reopened: boolean }
  | { kind: 'stale'; shootout: Record<string, number>; finalScores: Record<string, number> };

/** Steht nach der Überschreibung `overrideId` ein angenommenes REOPEN (Einfügereihenfolge = Log-Reihenfolge, RC16)? */
function reopenedAfter(state: MatchState, overrideId: string): boolean {
  const ids = Object.keys(state.accepted);
  const from = ids.indexOf(overrideId);
  return ids
    .slice(from + 1)
    .some((id) => state.accepted[id].type === 'REOPEN' && !state.retracted.includes(id));
}

export function enteredShootoutStatus(state: MatchState, ctx: MatchContext): EnteredShootoutStatus | null {
  const lastOverride = state.overrides[state.overrides.length - 1];
  if (state.status !== 'finished' || lastOverride?.shootout === undefined) {
    return null;
  }
  const scoreA = effectiveScoreFor(state, ctx.teamAId);
  const scoreB = effectiveScoreFor(state, ctx.teamBId);
  if (scoreA !== scoreB) {
    return {
      kind: 'stale',
      shootout: lastOverride.shootout,
      finalScores: { [ctx.teamAId]: scoreA, [ctx.teamBId]: scoreB },
    };
  }
  return { kind: 'counts', shootout: lastOverride.shootout, reopened: reopenedAfter(state, lastOverride.id) };
}
