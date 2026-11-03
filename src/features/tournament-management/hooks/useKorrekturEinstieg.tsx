/**
 * useKorrekturEinstieg (@EK-063): der EINE Einstieg in die Korrektur eines beendeten Spiels – für den Spielplan („Ergebnis
 * korrigieren“ in der Aktionsauswahl, @SL-193) und das Cockpit („Korrigieren“ nach dem Abpfiff, @SL-159). Beide öffnen denselben
 * Dialog (`CockpitKorrekturDialog`: bisher und neu) und danach denselben Weg (`enterScore` der Schnelleingabe: Stand-Abgleich,
 * Grund-Auswahl @EK-004, `CORRECTION`). Nur die Turnierleitung bekommt einen Handler; der Helfer keinen (@HE-043, @FU-113).
 * Solange die Korrektur offen ist, melden `pause.onBeginn`/`onEnde` das (Countdown des Endstands im Cockpit, @SL-163, @SL-164).
 */
import { useCallback, useState, type ReactElement } from 'react';
import { CockpitKorrekturDialog } from '../components/CockpitKorrekturDialog';
import type { EnterScore } from './useScheduleResultEntry';

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
  enterScore: EnterScore;
  spielOf: (matchId: string) => KorrekturSpiel | null;
  istLeitung: boolean;
  pause?: KorrekturPause;
}): KorrekturEinstieg {
  const { enterScore, spielOf, istLeitung, pause = {} } = options;
  const { onBeginn, onEnde } = pause;
  // Beim Öffnen festgehalten: das „bisher“ des Dialogs (@FU-082). Läuft während des offenen Dialogs ein fremdes Ergebnis ein oder liegt es
  // schon am Server, bleibt es stehen; das Speichern vergleicht damit und lehnt dann mit Namen ab. Dann (@EK-032) öffnet derselbe Dialog
  // mit dem neuen Stand als „bisher“ und dem Hinweis; dieser Stand ist die neue Basis, gesendet wird erst beim erneuten Speichern.
  const [offen, setOffen] = useState<{ matchId: string; spiel: KorrekturSpiel | null; hinweis: string | null; sendet: boolean } | null>(null);
  const onKorrigieren = useCallback((matchId: string) => {
    setOffen({ matchId, spiel: spielOf(matchId), hinweis: null, sendet: false });
    onBeginn?.(matchId);
  }, [spielOf, onBeginn]);
  const spiel = offen !== null ? offen.spiel ?? spielOf(offen.matchId) : null;

  const dialog = spiel !== null && offen !== null && !offen.sendet
    ? (
      <CockpitKorrekturDialog
        key={`${offen.matchId}:${spiel.scoreHome}:${spiel.scoreAway}`} matchNumber={spiel.number} homeName={spiel.homeName} awayName={spiel.awayName}
        scoreHome={spiel.scoreHome} scoreAway={spiel.scoreAway} staleHint={offen.hinweis ?? undefined}
        onAbbrechen={() => { setOffen(null); onEnde?.(); }}
        onWeiter={(home, away) => {
          // Während die Grund-Auswahl bzw. das Senden läuft, ist der Dialog ausgeblendet (Prompt und Dialog nie zugleich, @SL-163).
          setOffen({ ...offen, sendet: true });
          let abgelehnt = false;
          void enterScore(offen.matchId, home, away, { a: spiel.scoreHome, b: spiel.scoreAway }, ({ message, now }) => {
            abgelehnt = true;
            setOffen({ matchId: offen.matchId, spiel: { ...spiel, scoreHome: now.a, scoreAway: now.b }, hinweis: message, sendet: false });
          }).finally(() => {
            if (!abgelehnt) {
              setOffen(null);
              onEnde?.();
            }
          });
        }}
      />
    )
    : null;

  return { onKorrigieren: istLeitung ? onKorrigieren : undefined, dialog };
}
