/**
 * sideLabel — EIN Zugriffspunkt auf die Spielseiten im Wizard-Modul
 * (Ein-Stellen-Regel W1–W3). `matches` = Vorgängerspiele für „Sieger/Verlierer Spiel X“. Liest nur die Slots (B-35), nie `teamA/teamB`.
 */
import type { Match, Team } from '../../../types/tournament';
import { matchSideTeamId, slotTeamId } from '../../../core/models/matchSlot';
import { slotLabel, type SlotLabelMatch } from '../../../core/models/slotLabel';
import { assignTeamToSide } from '../../../core/models/matchAssignment';

export function sideLabel(
  match: Pick<Match, 'slotA' | 'slotB'>,
  side: 'A' | 'B',
  teams: Team[],
  matches: readonly SlotLabelMatch[] = []
): string {
  const slot = side === 'A' ? match.slotA : match.slotB;
  // Unbekannte Team-ID: die ID selbst (wie bisher im Panel), sonst Name bzw. Herkunft aus `slotLabel`.
  const id = slotTeamId(slot);
  if (id !== undefined && !teams.some((team) => team.id === id)) {
    return id;
  }
  return slotLabel(slot, { teams, matches });
}

/**
 * Ersetzt eine Seiten-Zuordnung (Team-Wechsel @W5-010). Die Seiten werden über
 * den Slot-Helfer `assignTeamToSide` gesetzt (Slot ist die Wahrheit, das
 * Übergangsfeld `teamA/teamB` wird daraus abgeleitet).
 *
 * A-36b: Merkmal `assignedBy: 'replaced'` – die Herkunft des Platzes gilt für das Ersatzteam weiter (@BM-014, F1).
 * Die Herkunft einer zuvor aufgelösten Seite (`resolvedFrom`) fällt beim Wechsel bewusst weg:
 * Eine manuell besetzte Seite ist ein direkt besetztes Team. Bliebe `resolvedFrom` stehen, behandelte
 * der Delta-Sync die Seite als nur lokal aufgelöst und verwürfe den Wechsel (K6, vgl. matchAssignment.ts).
 */
export function replaceSides(
  match: Match,
  fromTeamId: string,
  toTeamId: string
): Match {
  let next = match;
  if (matchSideTeamId(match, 'A') === fromTeamId) {
    next = assignTeamToSide(next, 'A', toTeamId, 'replaced');
  }
  if (matchSideTeamId(match, 'B') === fromTeamId) {
    next = assignTeamToSide(next, 'B', toTeamId, 'replaced');
  }
  return next;
}
