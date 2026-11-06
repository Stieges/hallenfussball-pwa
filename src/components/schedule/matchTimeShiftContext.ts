/** B-26: Kontext der Spielkarten für „Zeiten verschieben“ (siehe `MatchTimeShiftSlots.tsx`). */
import { createContext, type ReactNode } from 'react';

export interface MatchTimeShiftSlotsValue {
  /** „hh:mm“ der ursprünglichen Uhrzeit (Anzeige „(war hh:mm)“), wenn sie angezeigt werden soll */
  originalTimeOf: (matchId: string) => string | undefined;
  /** ⋮-Knopf je Spiel; fehlt = kein Menü */
  renderMenu?: (matchId: string) => ReactNode;
  /** „Ab hier verschieben“ aus der Aktionsauswahl des Spiels (@SL-193): öffnet den Dialog ab diesem Spiel; fehlt = nicht angeboten */
  shiftFrom?: (matchId: string) => void;
}

export const MatchTimeShiftContext = createContext<MatchTimeShiftSlotsValue | null>(null);
