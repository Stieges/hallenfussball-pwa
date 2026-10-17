/**
 * Hinweis in der Kopfzeile der Live-Folie (B-48a, @ME-006): Der rechte Kopfbereich zeigt statt der Gruppen-Angabe diesen
 * Text, solange er gesetzt ist. Die Monitor-Seite setzt ihn für 10 Sekunden; ohne Anbieter bleibt die Gruppe stehen.
 */
import { createContext, useContext } from 'react';

export const HeaderNoticeContext = createContext<string | null>(null);

export function useHeaderNotice(): string | null {
  return useContext(HeaderNoticeContext);
}
