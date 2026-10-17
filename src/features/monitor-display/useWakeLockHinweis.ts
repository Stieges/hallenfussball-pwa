/**
 * Hinweis „Bildschirm kann sich abschalten“ am Monitor (B-48a, @ME-006), Variante B (Daniel 2026-10-17): nur wenn beim
 * Start auf dem Feld kein Spiel läuft, 10 Sekunden lang als Ecke oben rechts. Startet während der 10 Sekunden ein
 * Spiel, verschwindet er sofort. Die Anzeige selbst steht in `components/monitor/WakeLockNotice.tsx`.
 */
import { useEffect, useState } from 'react';
import type { WakeLockStatus } from '../../hooks/useWakeLock';
import { istBrowserQuelle, wakeLockHinweisNoetig, WAKE_LOCK_HINWEIS_MS } from './monitorDauerbetrieb';

type Phase = 'bereit' | 'zeigt' | 'erledigt';

/**
 * W4: „einmal“ ist ein Zustand der Seite. Gezeigt wird der Hinweis höchstens einmal je Seiten-Instanz, auch wenn die
 * Seite zwischendurch in den Lade- oder Fehlerzustand geht und zurückkehrt. Eine Zusage oder ein Spiel auf dem Feld
 * beendet die Startphase endgültig.
 */
export function useWakeLockHinweis(status: WakeLockStatus, ansichtBereit: boolean, spielLaeuft: boolean): boolean {
  const noetig = wakeLockHinweisNoetig(status) && !istBrowserQuelle(window.location.hash, navigator.userAgent);
  const [phase, setPhase] = useState<Phase>('bereit');

  useEffect(() => {
    if (phase === 'bereit') {
      // Zusage oder laufendes Spiel beim Start: der Hinweis entfällt für diese Seite (@ME-006).
      if (status === 'granted' || spielLaeuft) {
        setPhase('erledigt');
      } else if (ansichtBereit && noetig) {
        setPhase('zeigt');
      }
    } else if (phase === 'zeigt' && (!ansichtBereit || !noetig || spielLaeuft)) {
      setPhase('erledigt');
    }
  }, [phase, ansichtBereit, noetig, status, spielLaeuft]);

  useEffect(() => {
    if (phase !== 'zeigt') { return undefined; }
    const timer = setTimeout(() => setPhase('erledigt'), WAKE_LOCK_HINWEIS_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Ein Spiel, das während der Anzeige startet, nimmt den Hinweis sofort weg (ohne auf den Effekt zu warten).
  return phase === 'zeigt' && !spielLaeuft;
}
