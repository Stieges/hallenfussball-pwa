/**
 * Manuelle Besetzung einer Spielseite durch die Leitung (A-04a, K6 aus dem A-03-Review).
 *
 * Eine von Hand gesetzte Seite ist ein direkt besetztes Team OHNE `resolvedFrom`: Nur so gilt sie in
 * `OfflineRepository` als Strukturänderung und geht beim Voll-Speichern in die Cloud. Bliebe die alte
 * Herkunft stehen, hielte der Delta-Sync sie für eine nur lokal aufgelöste Seite und verwürfe den Tausch.
 */
import type { Match } from '../../types/tournament';
import { teamSlot, transitionalSides } from './matchSlot';

/** Setzt `side` (`'A'` = Heim) des Spiels auf das Team; eine vorhandene Herkunft wird verworfen. */
export function assignTeamToSide(match: Match, side: 'A' | 'B', teamId: string): Match {
  const slot = teamSlot(teamId);
  return side === 'A'
    ? { ...match, slotA: slot, ...transitionalSides(slot, match.slotB) }
    : { ...match, slotB: slot, ...transitionalSides(match.slotA, slot) };
}

/** Tauscht die Seiten zweier Spiele (jeweils `'A'`/`'B'`); beide Seiten sind danach ohne Herkunft besetzt. */
export function swapTeamsBetweenMatches(
  first: { match: Match; side: 'A' | 'B' },
  second: { match: Match; side: 'A' | 'B' },
): [Match, Match] {
  const firstTeam = sideTeamId(first.match, first.side);
  const secondTeam = sideTeamId(second.match, second.side);
  return [
    assignTeamToSide(first.match, first.side, secondTeam),
    assignTeamToSide(second.match, second.side, firstTeam),
  ];
}

function sideTeamId(match: Match, side: 'A' | 'B'): string {
  const slot = side === 'A' ? match.slotA : match.slotB;
  if (slot.kind !== 'team') {
    throw new Error('Tausch: nur besetzte Seiten lassen sich tauschen');
  }
  return slot.teamId;
}
