/**
 * Hinweis „Bildschirm kann sich abschalten“ am Monitor (B-48a, @ME-006): einmal je Seiten-Instanz, 10 Sekunden lang,
 * nur im normalen Browser. Die Anzeige selbst steht in der Kopfzeile der Live-Folie (HeaderNoticeContext).
 */
import { useEffect, useState } from 'react';
import type { WakeLockStatus } from '../../hooks/useWakeLock';
import { istBrowserQuelle, wakeLockHinweisNoetig, WAKE_LOCK_HINWEIS_MS } from './monitorDauerbetrieb';

type Phase = 'bereit' | 'zeigt' | 'erledigt';

/**
 * W4: „einmal“ ist ein Zustand der Seite. Gezeigt wird der Hinweis höchstens einmal je Seiten-Instanz, auch wenn die
 * Seite zwischendurch in den Lade- oder Fehlerzustand geht und zurückkehrt. Eine spätere Zusage nimmt ihn zurück.
 */
export function useWakeLockHinweis(status: WakeLockStatus, ansichtBereit: boolean): boolean {
  const noetig = wakeLockHinweisNoetig(status) && !istBrowserQuelle(window.location.hash, navigator.userAgent);
  const [phase, setPhase] = useState<Phase>('bereit');

  useEffect(() => {
    // Der Hinweis gilt nur für den Start: Wer einmal zugesagt hat, bekommt später mitten im Betrieb keinen (@ME-006).
    if (status === 'granted' && phase === 'bereit') {
      setPhase('erledigt');
    } else if (phase === 'bereit' && ansichtBereit && noetig) {
      setPhase('zeigt');
    } else if (phase === 'zeigt' && (!ansichtBereit || !noetig)) {
      setPhase('erledigt');
    }
  }, [phase, ansichtBereit, noetig, status]);

  useEffect(() => {
    if (phase !== 'zeigt') { return undefined; }
    const timer = setTimeout(() => setPhase('erledigt'), WAKE_LOCK_HINWEIS_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return phase === 'zeigt';
}
