/**
 * GA4 A-13c: Besetzen der Finalrunde mit der Rangfolge einer abgeschlossenen Gruppe – rein, ohne React.
 * Am Server besetzt `complete_group` die Folgespiele selbst (`apply_follow_up`, @TM-016, @TM-047). Diese Funktion ist die
 * Entsprechung für den lokalen Speicher (Gast, `LocalStorageRepository`) und für Tests, die den Server nicht haben.
 * Besetzt werden nur offene Seiten mit Herkunft aus dieser Gruppe; eine schon besetzte Seite bleibt (nie still überschreiben,
 * @TM-073). Plätze in `openRanks` (@TM-145) bleiben offen. Die Herkunft bleibt in `resolvedFrom` erhalten.
 */
import type { Tournament } from '../../types/tournament';
import { isPendingSlot, resolveSlot } from '../models/matchSlot';
import type { MatchSlot } from '../models/schemas/MatchSlotSchema';

export interface FollowUpPlacement {
  tournament: Tournament;
  changed: Array<{ matchId: string; side: 'A' | 'B'; result: 'assigned' }>;
}

export function placeFollowUps(
  tournament: Tournament,
  groupId: string,
  ranking: readonly string[],
  openRanks: readonly number[] = [],
): FollowUpPlacement {
  const changed: FollowUpPlacement['changed'] = [];
  const place = (matchId: string, side: 'A' | 'B', slot: MatchSlot): MatchSlot => {
    if (!isPendingSlot(slot) || slot.source.kind !== 'groupRank' || slot.source.group !== groupId || openRanks.includes(slot.source.rank)) {
      return slot;
    }
    const teamId = ranking[slot.source.rank - 1];
    if (teamId === undefined) {
      return slot;
    }
    changed.push({ matchId, side, result: 'assigned' });
    return resolveSlot(slot.source, teamId);
  };
  const matches = tournament.matches.map((match) => {
    if (match.isFinal !== true) {
      return match;
    }
    const slotA = place(match.id, 'A', match.slotA);
    const slotB = place(match.id, 'B', match.slotB);
    return slotA === match.slotA && slotB === match.slotB ? match : { ...match, slotA, slotB };
  });
  return { tournament: changed.length === 0 ? tournament : { ...tournament, matches }, changed };
}
