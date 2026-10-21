/**
 * Zwischenregel „Gruppe abgeschlossen“ bis GA4 A-13 (Review TB-3' Auflage A1): Eine Gruppe gilt als abgeschlossen,
 * sobald ein Spiel mit Herkunft aus dieser Gruppe besetzt oder angepfiffen ist. Danach darf eine Gleichstands-Entscheidung
 * nicht mehr zurückgenommen werden (@W2A-070) – sonst liefen Tabelle und schon besetzte Finalrunde auseinander
 * (die Finalrunde wird einmalig besetzt, C-FINALRUNDE-AUS-STILLEM-GLEICHSTAND). GA4 A-13 ersetzt die Regel durch den
 * echten Zustand „Gruppe abschließen“. Rein, ohne React.
 */
import type { Match, MatchStatus, Tournament } from '../../types/tournament';
import type { MatchSlot } from '../models/schemas/MatchSlotSchema';
import type { SlotSource } from '../models/schemas/MatchSlotSchema';
import { slotSource } from '../models/matchSlot';

/** Noch nicht angepfiffen. Alles andere (auch der Laufzeitwert `paused`, den der Typ nicht kennt) gilt als angepfiffen. */
const NOT_STARTED: readonly MatchStatus[] = ['scheduled', 'waiting', 'skipped'];

const fromGroup = (source: SlotSource | undefined, groupId: string): boolean =>
  source?.kind === 'groupRank' && source.group === groupId;

/** Herkunft des Platzes: die unveränderliche `originX`, sonst die der Seite (offen: `source`, aufgelöst: `resolvedFrom`). */
const placeOrigin = (origin: SlotSource | undefined, slot: MatchSlot): SlotSource | undefined => origin ?? slotSource(slot);

/** Seite besetzt (Team gesetzt, auch von Hand) und der Platz stammt aus `groupId`. */
const sideOccupiedFromGroup = (origin: SlotSource | undefined, slot: MatchSlot, groupId: string): boolean =>
  slot.kind === 'team' && fromGroup(placeOrigin(origin, slot), groupId);

const startedWithGroupSide = (m: Match, groupId: string): boolean =>
  m.matchStatus !== undefined && !NOT_STARTED.includes(m.matchStatus)
  && (fromGroup(placeOrigin(m.originA, m.slotA), groupId) || fromGroup(placeOrigin(m.originB, m.slotB), groupId));

/** Ist ein Spiel mit Herkunft aus `groupId` besetzt (Seite aus dieser Gruppe) oder angepfiffen? */
export function groupClosedByFollowUp(tournament: Pick<Tournament, 'matches'>, groupId: string): boolean {
  return tournament.matches.some((m) => startedWithGroupSide(m, groupId)
    || sideOccupiedFromGroup(m.originA, m.slotA, groupId) || sideOccupiedFromGroup(m.originB, m.slotB, groupId));
}
