import { useCallback } from 'react';

export interface ClockControlsParams {
  match: { id: string; status: 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED' } | null;
  /** Engine-Zustand `section_break` (Halbzeitpause oder Pause vor der Verlängerung): „Weiter“ heißt dort Wiederanpfiff. */
  abschnittspause: boolean;
  /** Ton freigeben, falls noch nicht geschehen; läuft im Tipp (Browser-Geste), @OB-021. */
  sound: { aktiviere?: () => void };
  onStart: (matchId: string) => void;
  onPause: (matchId: string) => void;
  onResume: (matchId: string) => void;
  /** Wiederanpfiff nach der Abschnittspause (SECTION_START, B-08b). */
  onStartSection: (matchId: string) => void;
  /** Abpfiff von Hand; liefert (als Promise) die ID des gesendeten Endes, wenn der Aufrufer sie kennt (für `useWhistle`). */
  onFinish: (matchId: string) => unknown;
  /** Das Ende von Hand ist gesendet (`null`: abgelehnt oder nichts gespeichert). */
  onFinished?: (eventId: string | null) => void;
}
export interface UseClockControlsReturn { starte: () => void; pauseOderWeiter: () => void; pfeifeAb: () => void }

/**
 * Anpfiff, Pause/Weiter, Wiederanpfiff und Abpfiff von Hand des Cockpits. Ton und Vibration kommen allein aus
 * `useWhistle` (B-08c), das Abschnittsende und den Abpfiff von selbst macht `useAutoSectionEnd` (B-08b).
 * Meldungen (Toasts) hängen die Aufrufer über die `on…`-Rückrufe an (bis Aufgabe 2.3).
 */
export function useClockControls(p: ClockControlsParams): UseClockControlsReturn {
  const { match, abschnittspause, sound, onStart, onPause, onResume, onStartSection, onFinish, onFinished } = p;
  const starte = useCallback(() => {
    if (!match) { return; }
    sound.aktiviere?.();
    onStart(match.id);
  }, [match, sound, onStart]);
  const pauseOderWeiter = useCallback(() => {
    if (!match) { return; }
    sound.aktiviere?.();
    if (match.status === 'RUNNING') { onPause(match.id); return; }
    if (match.status !== 'PAUSED') { return; }
    // C-COCKPIT-HALBZEIT-START: in der Abschnittspause gibt es kein RESUME, sondern den Wiederanpfiff (SECTION_START).
    if (abschnittspause) { onStartSection(match.id); } else { onResume(match.id); }
  }, [match, abschnittspause, sound, onPause, onResume, onStartSection]);
  const pfeifeAb = useCallback(() => {
    if (!match) { return; }
    const gesendet = onFinish(match.id);
    void Promise.resolve(gesendet).then((id) => { onFinished?.(typeof id === 'string' ? id : null); });
  }, [match, onFinish, onFinished]);
  return { starte, pauseOderWeiter, pfeifeAb };
}
