/** B-26: Kontext der Spielkarten für „Zeiten verschieben“ (siehe `MatchTimeShiftSlots.tsx`). */
import { createContext, type ReactNode } from 'react';

export interface MatchTimeShiftSlotsValue {
  /** „hh:mm“ der ursprünglichen Uhrzeit, wenn sie angezeigt werden soll */
  originalTimeOf: (matchId: string) => string | undefined;
  /** B-27 (@ZM-105): Uhrzeit eines K.-o.-Spiels ist „voraussichtlich“; fehlt = nie */
  tentativeOf?: (matchId: string) => boolean;
  /** ⋮-Knopf je Spiel; fehlt = kein Menü */
  renderMenu?: (matchId: string) => ReactNode;
}

export const MatchTimeShiftContext = createContext<MatchTimeShiftSlotsValue | null>(null);
