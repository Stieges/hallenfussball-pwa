/**
 * Hat die Nummer in diesem Spiel schon eine Gelbe Karte? (L5, @SL-088)
 * Nur Gelb zählt (Gelb-Rot und Rot nicht), und nur für dasselbe Team: Nr. 7 von FC Nord ist eine andere Person als Nr. 7 von SV Süd.
 * `events` enthält kein Zurückgenommenes (G6), eine zurückgenommene Gelbe zählt also nicht.
 */
import { cardKindOf } from '../../../utils/cardKind';
import type { RuntimeMatchEvent } from '../../../types/tournament';

export function hatSchonGelb(events: readonly RuntimeMatchEvent[], teamId: string, nummer: number): boolean {
  return events.some((e) => cardKindOf(e) === 'YELLOW' && e.payload.teamId === teamId && e.payload.playerNumber === nummer);
}
