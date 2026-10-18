/**
 * useWhistle (B-08c): die einzige Quelle für Abpfiff-Ton und Vibration des Cockpits. Gepfiffen wird genau einmal
 * je gesendetem Ende-Ereignis dieses Geräts (Schlüssel = Ereignis-ID); ein zweites Auslösen desselben Endes, ein
 * Neuzeichnen oder ein Neuladen (kein neues Ereignis) pfeift nicht noch einmal. Ton bei Abschnittsende und Abpfiff
 * (nur wenn eingeschaltet), Vibration nur beim Abpfiff (nur wenn eingeschaltet und möglich).
 * Szenarien: @SL-005, @SL-009, @SL-062, @SL-063, @SL-125, @FU-070.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';

export type WhistleKind = 'abschnitt' | 'spiel';

export interface WhistleOptions {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  play: () => void;
}

export interface Whistle {
  /** `eventId`: das gesendete Ende-Ereignis (`null`: nichts gespeichert, kein Pfiff). */
  pfeife: (eventId: string | null, kind: WhistleKind) => void;
}

const VIBRATION_MS = [200, 100, 200];

export function useWhistle(options: WhistleOptions): Whistle {
  const latest = useRef(options);
  useEffect(() => { latest.current = options; });
  const gepfiffen = useRef<Set<string>>(new Set());

  const pfeife = useCallback((eventId: string | null, kind: WhistleKind): void => {
    if (eventId === null || gepfiffen.current.has(eventId)) { return; }
    gepfiffen.current.add(eventId);
    const { soundEnabled, hapticEnabled, play } = latest.current;
    if (soundEnabled) { play(); }
    if (kind === 'spiel' && hapticEnabled && typeof navigator.vibrate === 'function') { navigator.vibrate(VIBRATION_MS); }
  }, []);

  return useMemo(() => ({ pfeife }), [pfeife]);
}
