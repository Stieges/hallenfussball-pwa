/**
 * Zwischenregel „Gruppe abgeschlossen“ bis GA4 A-13 (Review TB-3' Auflage A1): Eine Gruppe gilt als abgeschlossen,
 * sobald ein Spiel mit Herkunft aus dieser Gruppe besetzt oder angepfiffen ist. Danach darf eine Gleichstands-Entscheidung
 * nicht mehr zurückgenommen werden (@W2A-070) – sonst liefen Tabelle und schon besetzte Finalrunde auseinander
 * (die Finalrunde wird einmalig besetzt, C-FINALRUNDE-AUS-STILLEM-GLEICHSTAND). GA4 A-13 ersetzt die Regel durch den
 * echten Zustand „Gruppe abschließen“. Rein, ohne React.
 */
import type { Match, MatchStatus, Tournament } from '../../types/tournament';
import type { MatchSlot } from '../models/schemas/MatchSlotSchema';
import { slotSource } from '../models/matchSlot';

const STARTED: readonly MatchStatus[] = ['running', 'finished'];

const fromGroup = (slot: MatchSlot | undefined, groupId: string): boolean => {
  const source = slot === undefined ? undefined : slotSource(slot);
  return source?.kind === 'groupRank' && source.group === groupId;
};

const isFromGroup = (match: Match, groupId: string): boolean =>
  [match.originA, match.originB].some((o) => o?.kind === 'groupRank' && o.group === groupId)
  || fromGroup(match.slotA, groupId) || fromGroup(match.slotB, groupId);

const occupiedFromGroup = (slot: MatchSlot, groupId: string): boolean => slot.kind === 'team' && fromGroup(slot, groupId);

/** Ist ein Spiel mit Herkunft aus `groupId` besetzt (Seite aus dieser Gruppe) oder angepfiffen? */
export function groupClosedByFollowUp(tournament: Pick<Tournament, 'matches'>, groupId: string): boolean {
  return tournament.matches.some((m) => isFromGroup(m, groupId)
    && (occupiedFromGroup(m.slotA, groupId) || occupiedFromGroup(m.slotB, groupId)
      || (m.matchStatus !== undefined && STARTED.includes(m.matchStatus))));
}
