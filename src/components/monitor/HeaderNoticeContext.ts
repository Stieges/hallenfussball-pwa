/**
 * Hinweis „Bildschirm kann sich abschalten“ (B-48a, @ME-006). Die Monitor-Seite setzt den Text für 10 Sekunden.
 * Hat die gezeigte Folie eine Kopfzeile (Live-Folie), steht der Hinweis dort neben der LIVE-Marke anstelle von
 * Feld/Spiel und Gruppe; sonst zeigt die Seite ihn als Ecke oben rechts. Die Kopfzeile meldet dafür ihr Dasein.
 */
import { createContext, useContext } from 'react';

export interface HeaderNoticeValue {
  /** Text des Hinweises, solange er stehen soll. */
  text: string | null;
  /** Die Kopfzeile meldet sich an (true) und ab (false). */
  setHeaderPresent: (present: boolean) => void;
}

const KEIN_ANBIETER: HeaderNoticeValue = { text: null, setHeaderPresent: () => undefined };

export const HeaderNoticeContext = createContext<HeaderNoticeValue>(KEIN_ANBIETER);

export function useHeaderNotice(): HeaderNoticeValue {
  return useContext(HeaderNoticeContext);
}
