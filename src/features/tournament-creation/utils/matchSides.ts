/**
 * sideLabel — EIN Zugriffspunkt auf die Spielseiten im Wizard-Modul
 * (Ein-Stellen-Regel W1–W3). Liest nur die Slots (B-35), nie `teamA/teamB`.
 */
import type { Match, Team } from '../../../types/tournament';
import { matchSideTeamId, slotTeamId } from '../../../core/models/matchSlot';
import { slotLabel } from '../../../core/models/slotLabel';
import { assignTeamToSide } from '../../../core/models/matchAssignment';

export function sideLabel(
  match: Pick<Match, 'slotA' | 'slotB'>,
  side: 'A' | 'B',
  teams: Team[]
): string {
  const slot = side === 'A' ? match.slotA : match.slotB;
  // Unbekannte Team-ID: die ID selbst (wie bisher im Panel), sonst Name bzw. Herkunft aus `slotLabel`.
  const id = slotTeamId(slot);
  if (id !== undefined && !teams.some((team) => team.id === id)) {
    return id;
  }
  return slotLabel(slot, { teams, matches: [] });
}

/** Team-ID der Seite oder `'TBD'`, solange sie offen ist (Schlüssel der Paarung bei der Neuplanung). */
export function sidePairingRef(match: Pick<Match, 'slotA' | 'slotB'>, side: 'A' | 'B'): string {
  return matchSideTeamId(match, side) ?? 'TBD';
}

/**
 * Ersetzt eine Seiten-Zuordnung (Team-Wechsel @W5-010). Die Seiten werden über
 * den Slot-Helfer `assignTeamToSide` gesetzt (Slot ist die Wahrheit, das
 * Übergangsfeld `teamA/teamB` wird daraus abgeleitet).
 *
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
    next = assignTeamToSide(next, 'A', toTeamId);
  }
  if (matchSideTeamId(match, 'B') === fromTeamId) {
    next = assignTeamToSide(next, 'B', toTeamId);
  }
  return next;
}
