/**
 * useCockpitNotices – Meldezeile des Cockpits mit Vorrang und Dauer (Cockpit-Spec § 7).
 *
 * Höchstens eine Meldung zugleich. Höhere Stufe (kleinere Zahl) ersetzt sofort, gleiche Stufe ersetzt.
 * Eine Stufe-2-Meldung unter einer höheren wartet (nur die jüngste), eine Stufe-3-Bestätigung unter
 * einer höheren wird verworfen. Jede Stufe hat eine Dauer; der Zeitablauf hängt an der Meldung (`id`),
 * nicht am Neuzeichnen der Uhr (Ursache von C-COCKPIT-TOASTS-HANDY).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type NoticeStufe = 1 | 2 | 3;
/** Meldung mit Kennung, die die Tafel gezielt unterdrücken darf: „Spiel abgepfiffen“ entfällt, solange die Quittung steht (@SL-152). */
export type NoticeKennung = 'abgepfiffen';
export interface CockpitNotice { id: number; stufe: NoticeStufe; text: string; dauerMs: number; kennung?: NoticeKennung }
export const NOTICE_DAUER_MS: Record<NoticeStufe, number> = { 1: 6000, 2: 5000, 3: 3000 };
export interface UseCockpitNoticesReturn {
  aktuell: CockpitNotice | null;
  melde: (stufe: NoticeStufe, text: string, kennung?: NoticeKennung) => void;
  schliesse: () => void;
  /** Fehler als Stufe-2-Meldung; stabil, für Rückrufe, die nur einen Text bekommen. */
  fehler: (text: string) => void;
}

export function useCockpitNotices(): UseCockpitNoticesReturn {
  const [aktuell, setAktuell] = useState<CockpitNotice | null>(null);
  const aktuellRef = useRef<CockpitNotice | null>(null);
  const wartendStufe2 = useRef<CockpitNotice | null>(null);
  const naechsteId = useRef(1);

  const zeige = useCallback((notice: CockpitNotice | null) => {
    aktuellRef.current = notice;
    setAktuell(notice);
  }, []);

  const zeigeNaechste = useCallback(() => {
    const naechste = wartendStufe2.current;
    wartendStufe2.current = null;
    zeige(naechste);
  }, [zeige]);

  const melde = useCallback((stufe: NoticeStufe, text: string, kennung?: NoticeKennung) => {
    const jetzt = aktuellRef.current;
    const notice = (): CockpitNotice => ({ id: naechsteId.current++, stufe, text, dauerMs: NOTICE_DAUER_MS[stufe], ...(kennung ? { kennung } : {}) });
    if (jetzt === null || stufe <= jetzt.stufe) {
      zeige(notice());
    } else if (stufe === 2) {
      wartendStufe2.current = notice();
    }
  }, [zeige]);

  const fehler = useCallback((text: string) => { melde(2, text); }, [melde]);

  const id = aktuell?.id;
  const dauerMs = aktuell?.dauerMs;
  useEffect(() => {
    if (id === undefined || dauerMs === undefined) { return undefined; }
    const timer = setTimeout(zeigeNaechste, dauerMs);
    return () => clearTimeout(timer);
  }, [id, dauerMs, zeigeNaechste]);

  return { aktuell, melde, schliesse: zeigeNaechste, fehler };
}
