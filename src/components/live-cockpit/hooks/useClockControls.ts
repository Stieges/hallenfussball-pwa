import { useCallback, useEffect, useRef } from 'react';
import { isAutoFinishDue } from '../../../core/match/client/viewDuration';

export interface ClockControlsParams {
  match: { id: string; status: 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED' } | null;
  /** Nur ein steuerndes Gerät beendet das Spiel automatisch (R4/H3, @SL-018). */
  kannSteuern: boolean;
  autoFinishEnabled: boolean;
  /** Spielzeit (auch Verlängerung/Golden Goal) ist wirklich abgelaufen. */
  zeitAbgelaufen: boolean;
  sound: { enabled: boolean; play: () => void; /** Ton freigeben, falls noch nicht geschehen; läuft im Tipp (Browser-Geste), @OB-021. */ aktiviere?: () => void };
  hapticEnabled: boolean;
  onStart: (matchId: string) => void;
  onPause: (matchId: string) => void;
  onResume: (matchId: string) => void;
  onFinish: (matchId: string) => void;
}
export interface UseClockControlsReturn { starte: () => void; pauseOderWeiter: () => void; pfeifeAb: () => void }

/**
 * Anpfiff, Pause/Weiter und Abpfiff (Ton, Vibration) des Cockpits sowie der automatische Abpfiff.
 * Meldungen (Toasts) hängen die Aufrufer über die `on…`-Rückrufe an (bis Aufgabe 2.3).
 */
export function useClockControls(p: ClockControlsParams): UseClockControlsReturn {
  const { match, kannSteuern, autoFinishEnabled, zeitAbgelaufen, sound, hapticEnabled, onStart, onPause, onResume, onFinish } = p;
  const starte = useCallback(() => {
    if (!match) { return; }
    sound.aktiviere?.();
    onStart(match.id);
  }, [match, sound, onStart]);
  const pauseOderWeiter = useCallback(() => {
    if (!match) { return; }
    sound.aktiviere?.();
    if (match.status === 'RUNNING') { onPause(match.id); } else if (match.status === 'PAUSED') { onResume(match.id); }
  }, [match, sound, onPause, onResume]);
  const pfeifeAb = useCallback(() => {
    if (!match) { return; }
    // Bis B-08c: Ton und Vibration hier. B-08c P1 macht `useWhistle` zur einzigen Quelle und entfernt diese zwei Zeilen.
    if (sound.enabled) { sound.play(); }
    if (hapticEnabled && typeof navigator.vibrate === 'function') { navigator.vibrate([200, 100, 200]); }
    onFinish(match.id);
  }, [match, sound, hapticEnabled, onFinish]);

  // Automatischer Abpfiff: nur bei laufendem Spiel mit wirklich abgelaufener Zeit (C-VERLAENGERUNG-ENDET-SOFORT,
  // `isAutoFinishDue`). Einmal je Lauf: `abgepfiffenFuer` hält die Spiel-ID, solange das Spiel RUNNING bleibt
  // (bekannte Schleife bei neu erzeugtem `sound`/`match`, vgl. LiveCockpit.readOnly.test.tsx) und wird frei, sobald
  // das Spiel nicht mehr läuft – so endet auch ein folgender Abschnitt desselben Spiels (Verlängerung) von selbst.
  // B-08b ersetzt diesen Effekt durch useAutoSectionEnd.
  const abgepfiffenFuer = useRef<string | null>(null);
  useEffect(() => {
    if (match?.status !== 'RUNNING') { abgepfiffenFuer.current = null; return; }
    if (!kannSteuern || !autoFinishEnabled || !isAutoFinishDue(match, zeitAbgelaufen)) { return; }
    if (abgepfiffenFuer.current === match.id) { return; }
    abgepfiffenFuer.current = match.id;
    pfeifeAb();
  }, [kannSteuern, autoFinishEnabled, match, zeitAbgelaufen, pfeifeAb]);
  return { starte, pauseOderWeiter, pfeifeAb };
}
