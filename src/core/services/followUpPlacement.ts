/**
 * GA4 A-13c: Besetzen der Finalrunde mit der Rangfolge einer abgeschlossenen Gruppe – rein, ohne React.
 * Am Server besetzt `complete_group` die Folgespiele selbst (`apply_follow_up`, @TM-016, @TM-047). Diese Funktion ist die
 * Entsprechung für den lokalen Speicher (Gast, `LocalStorageRepository`) und für Tests, die den Server nicht haben – seit
 * R2 PR 2 (A-15b, Befund C-LOKALER-NEUABSCHLUSS-KEIN-ZWILLING) auch für den erneuten Abschluss, dieselbe Regel je Seite:
 * - gleiches Team bzw. schon offen → nichts (@EK-017);
 * - von Hand besetzt (Team ohne Herkunft) → bleibt, nie still überschreiben (@TM-073); eine Seite ohne Herkunft aus dieser
 *   Gruppe gehört ohnehin nicht dazu;
 * - besetzt und das Spiel schon angepfiffen → bleibt (@TM-099);
 * - Platz in `openRanks` (@TM-145) → zurück auf die Herkunft;
 * - sonst → das Team des Platzes, die Herkunft bleibt in `resolvedFrom` (@TM-016, @TM-071).
 * Den Folgen-Hinweis und den Verlauf führt nur der Server; lokal gibt es beides nicht.
 */
import type { Match, Tournament } from '../../types/tournament';
import { pendingSlot, resolveSlot, slotSource, slotTeamId } from '../models/matchSlot';
import type { MatchSlot } from '../models/schemas/MatchSlotSchema';

export type FollowUpResult = 'assigned' | 'reassigned' | 'released';

export interface FollowUpPlacement {
  tournament: Tournament;
  changed: Array<{ matchId: string; side: 'A' | 'B'; result: FollowUpResult }>;
}

const NOT_STARTED = new Set(['scheduled', 'waiting', undefined]);

export function placeFollowUps(
  tournament: Tournament,
  groupId: string,
  ranking: readonly string[],
  openRanks: readonly number[] = [],
): FollowUpPlacement {
  const changed: FollowUpPlacement['changed'] = [];
  const place = (match: Match, side: 'A' | 'B', slot: MatchSlot): MatchSlot => {
    const source = slotSource(slot);
    if (source?.kind !== 'groupRank' || source.group !== groupId) {
      return slot;
    }
    const current = slotTeamId(slot);
    const next = openRanks.includes(source.rank) ? undefined : ranking[source.rank - 1];
    if (next === current) {
      return slot;
    }
    if (current !== undefined && !NOT_STARTED.has(match.matchStatus)) {
      return slot; // angepfiffen: der Server gibt einen Folgen-Hinweis, die Seite bleibt
    }
    if (next === undefined) {
      changed.push({ matchId: match.id, side, result: 'released' });
      return pendingSlot(source);
    }
    changed.push({ matchId: match.id, side, result: current === undefined ? 'assigned' : 'reassigned' });
    return resolveSlot(source, next);
  };
  const matches = tournament.matches.map((match) => {
    if (match.isFinal !== true) {
      return match;
    }
    const slotA = place(match, 'A', match.slotA);
    const slotB = place(match, 'B', match.slotB);
    return slotA === match.slotA && slotB === match.slotB ? match : { ...match, slotA, slotB };
  });
  return { tournament: changed.length === 0 ? tournament : { ...tournament, matches }, changed };
}
