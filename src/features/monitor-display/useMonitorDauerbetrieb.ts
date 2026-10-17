/**
 * Hooks für den Monitor-Dauerbetrieb (B-17): Mauszeiger nach Ruhe ausblenden, Tasten abfangen.
 */
import { useEffect, useState } from 'react';
import type { WakeLockStatus } from '../../hooks/useWakeLock';
import { MAUSZEIGER_RUHE_MS, istAbgefangenerTastendruck, istEingabeZiel } from './monitorDauerbetrieb';

/**
 * Liefert `true`, wenn der Mauszeiger ruht (kein Mausbewegen und kein Tippen auf dem Bildschirm seit `ruheMs`).
 * Die Seite blendet ihn dann per `cursor: none` aus (@ME-002).
 */
export function useIdleCursor(ruheMs: number = MAUSZEIGER_RUHE_MS): boolean {
  const [ruht, setRuht] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bewegt = () => {
      setRuht(false);
      clearTimeout(timer);
      timer = setTimeout(() => setRuht(true), ruheMs);
    };

    bewegt();
    window.addEventListener('mousemove', bewegt);
    window.addEventListener('pointerdown', bewegt);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', bewegt);
      window.removeEventListener('pointerdown', bewegt);
    };
  }, [ruheMs]);

  return ruht;
}

/**
 * Fängt die Tasten ab, die die Seite verlassen oder anhalten könnten (Leertaste, Backspace, Pfeile, Escape),
 * indem die Standardaktion unterdrückt wird (@ME-003, @ME-022). Die Funktion der Taste (Pause, Folie wechseln)
 * bleibt in useSlideshow.
 */
export function useTastenAbfang(): void {
  useEffect(() => {
    const abfangen = (e: KeyboardEvent) => {
      if (istEingabeZiel(e.target)) { return; }
      if (istAbgefangenerTastendruck(e)) { e.preventDefault(); }
    };
    window.addEventListener('keydown', abfangen);
    return () => window.removeEventListener('keydown', abfangen);
  }, []);
}

/**
 * Zustände, in denen die erste Eingabe die Anfrage erneut stellt (Safari verlangt manchmal eine Nutzergeste).
 * Nicht bei `noAnswer`: Eine hängende Anfrage (LG webOS) läuft weiter, eine neue würde ihre späte Zusage verwerfen.
 */
const ERNEUT_NACH_EINGABE: ReadonlySet<WakeLockStatus> = new Set<WakeLockStatus>(['denied']);

/**
 * Fordert den Wake Lock nach der ersten Eingabe erneut an, wenn die erste Anfrage abgelehnt wurde
 * (B-17 Fixrunde 2, B-48a). Nur einmal je Zustandswechsel.
 */
export function useWakeLockNachEingabe(status: WakeLockStatus, anfordern: () => Promise<void>): void {
  const erneut = ERNEUT_NACH_EINGABE.has(status);
  useEffect(() => {
    if (!erneut) { return undefined; }
    const nochmal = (): void => {
      window.removeEventListener('pointerdown', nochmal);
      window.removeEventListener('keydown', nochmal);
      void anfordern();
    };
    window.addEventListener('pointerdown', nochmal);
    window.addEventListener('keydown', nochmal);
    return () => {
      window.removeEventListener('pointerdown', nochmal);
      window.removeEventListener('keydown', nochmal);
    };
  }, [erneut, anfordern]);
}
