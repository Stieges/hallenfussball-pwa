/**
 * useKorrekturEinstieg (@EK-063): der EINE Einstieg in die Korrektur eines beendeten Spiels – für den Spielplan („Ergebnis
 * korrigieren“ in der Aktionsauswahl, @SL-193) und das Cockpit („Korrigieren“ nach dem Abpfiff, @SL-159). Beide öffnen denselben
 * Dialog (`CockpitKorrekturDialog`: bisher und neu) und danach denselben Weg (`enterScore` der Schnelleingabe: Stand-Abgleich,
 * Grund-Auswahl @EK-004, `CORRECTION`). Nur die Turnierleitung bekommt einen Handler; der Helfer keinen (@HE-043, @FU-113).
 * Solange die Korrektur offen ist, melden `pause.onBeginn`/`onEnde` das (Countdown des Endstands im Cockpit, @SL-163, @SL-164).
 */
import { useCallback, useState, type ReactElement } from 'react';
import { CockpitKorrekturDialog } from '../components/CockpitKorrekturDialog';
import type { KnownScore } from './useScheduleResultEntry';

export interface KorrekturSpiel {
  number: number;
  homeName: string;
  awayName: string;
  /** Das bisher geltende Ergebnis (ohne Strafstoßschießen) */
  scoreHome: number;
  scoreAway: number;
}

export interface KorrekturPause {
  /** Korrektur geöffnet: Countdown des Endstands anhalten (@SL-163). */
  onBeginn?: (matchId: string) => void;
  /** Korrektur gespeichert, abgelehnt oder abgebrochen: Countdown fortsetzen (@SL-164). */
  onEnde?: () => void;
}

export interface KorrekturEinstieg {
  /** Fehlt für Helfer. */
  onKorrigieren: ((matchId: string) => void) | undefined;
  /** Der Dialog (erster Schritt), wenn offen; sonst `null`. Die Grund-Auswahl zeigt der Aufrufer über `ScheduleResultEntryPrompt`. */
  dialog: ReactElement | null;
}

export function useKorrekturEinstieg(options: {
  enterScore: (matchId: string, home: number, away: number, knownScore?: KnownScore) => Promise<boolean>;
  spielOf: (matchId: string) => KorrekturSpiel | null;
  istLeitung: boolean;
  pause?: KorrekturPause;
}): KorrekturEinstieg {
  const { enterScore, spielOf, istLeitung, pause = {} } = options;
  const { onBeginn, onEnde } = pause;
  // Beim Öffnen festgehalten: das „bisher“ des Dialogs (@FU-082). Läuft während des offenen Dialogs ein fremdes Ergebnis ein oder liegt es
  // schon am Server, bleibt es stehen; das Speichern vergleicht damit und lehnt dann mit Namen ab.
  const [offen, setOffen] = useState<{ matchId: string; spiel: KorrekturSpiel | null } | null>(null);
  const onKorrigieren = useCallback((matchId: string) => {
    setOffen({ matchId, spiel: spielOf(matchId) });
    onBeginn?.(matchId);
  }, [spielOf, onBeginn]);
  const spiel = offen !== null ? offen.spiel ?? spielOf(offen.matchId) : null;

  const dialog = spiel !== null && offen !== null
    ? (
      <CockpitKorrekturDialog
        key={offen.matchId} matchNumber={spiel.number} homeName={spiel.homeName} awayName={spiel.awayName} scoreHome={spiel.scoreHome} scoreAway={spiel.scoreAway}
        onAbbrechen={() => { setOffen(null); onEnde?.(); }}
        onWeiter={(home, away) => {
          setOffen(null);
          void enterScore(offen.matchId, home, away, { a: spiel.scoreHome, b: spiel.scoreAway }).finally(() => { onEnde?.(); });
        }}
      />
    )
    : null;

  return { onKorrigieren: istLeitung ? onKorrigieren : undefined, dialog };
}
