/**
 * „Tauschen mit …“ (@ZP-100): der Spielplan-Reiter stellt die Auswahl des Zielspiels bereit, die Karten im
 * Bearbeiten-Modus öffnen sie. Ohne Anbieter (Zuschauer, Vorschau) gibt es keine Taste.
 */
import { createContext, useContext } from 'react';

export interface SwapWithApi {
  /** Öffnet die Auswahl „Tauschen mit …“ für dieses Spiel */
  request: (matchId: string) => void;
}

export const SwapWithContext = createContext<SwapWithApi | null>(null);

export const useSwapWith = (): SwapWithApi | null => useContext(SwapWithContext);
