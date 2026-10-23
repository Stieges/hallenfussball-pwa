/**
 * useCockpitKorrektur (B-10a2, @SL-159): „Korrigieren“ im Cockpit nach dem Abpfiff. Es gibt keinen zweiten Korrektur-Weg: das Ergebnis geht
 * über `useScheduleResultEntry.enterScore` – Turnierleitung-Prüfung, Stand-Abgleich (veraltet = Hinweis), Grund-Auswahl (Grundpflicht
 * @EK-004), `CORRECTION` über die Engine und Ablehnungstexte sind dieselben wie im Spielplan. Neu ist nur der Einstieg: ein Dialog mit dem
 * bisherigen und dem korrigierten Ergebnis. Nur die Turnierleitung (`istLeitung`) bekommt einen Handler; der Helfer keinen (@HE-043).
 * Solange die Korrektur offen ist (Dialog, Grund-Auswahl, Senden), pausiert der Countdown des Endstands (`onBeginn`, @SL-163); nach Speichern
 * oder Abbruch läuft er weiter (`onEnde`, @SL-164).
 */
import { useCallback, useState, type ReactElement } from 'react';
import { useToast } from '../../../components/ui/Toast';
import { liveMatchFinalScore } from '../../../utils/matchScore';
import type { LiveMatch } from '../../../components/live-cockpit/types';
import type { Tournament } from '../../../types/tournament';
import { CockpitKorrekturDialog } from '../components/CockpitKorrekturDialog';
import { ScheduleResultEntryPrompt } from '../components/ScheduleResultEntryPrompt';
import { useScheduleResultEntry } from './useScheduleResultEntry';

export interface CockpitKorrektur {
  /** Fehlt für Helfer; mit Handler steht „Korrigieren“ in der Leiste. */
  onKorrigieren: ((matchId: string) => void) | undefined;
  /** Dialog und Grund-Auswahl, wenn offen; sonst `null`. */
  dialoge: ReactElement | null;
}

export interface CockpitKorrekturPause {
  /** Korrektur geöffnet: Countdown des Endstands anhalten (@SL-163). */
  onBeginn?: (matchId: string) => void;
  /** Korrektur gespeichert, abgelehnt oder abgebrochen: Countdown fortsetzen (@SL-164). */
  onEnde?: () => void;
}

export function useCockpitKorrektur(
  tournament: Tournament, liveMatches: ReadonlyMap<string, LiveMatch>, istLeitung: boolean, pause: CockpitKorrekturPause = {},
): CockpitKorrektur {
  const { onBeginn, onEnde } = pause;
  const { showWarning } = useToast();
  // Das Sperrfeld des Spielplans („Ergebnisse beendeter Spiele sperren“) gilt für die Schnelleingabe dort; „Korrigieren“ ist die ausdrückliche Korrektur.
  const resultEntry = useScheduleResultEntry({ tournament, showWarning, lockFinishedResults: false });
  const [offen, setOffen] = useState<string | null>(null);
  const onKorrigieren = useCallback((matchId: string) => { setOffen(matchId); onBeginn?.(matchId); }, [onBeginn]);
  const match = offen !== null ? liveMatches.get(offen) ?? null : null;
  const stand = match ? liveMatchFinalScore(match) : null;

  const prompt = resultEntry.prompt ? <ScheduleResultEntryPrompt prompt={resultEntry.prompt} answerPrompt={resultEntry.answerPrompt} /> : null;
  const dialoge = match && stand && offen !== null
    ? (
      <CockpitKorrekturDialog
        key={offen} matchNumber={match.number} homeName={match.homeTeam.name} awayName={match.awayTeam.name} scoreHome={stand.a} scoreAway={stand.b}
        onAbbrechen={() => { setOffen(null); onEnde?.(); }}
        onWeiter={(home, away) => { setOffen(null); void resultEntry.enterScore(offen, home, away).finally(() => { onEnde?.(); }); }}
      />
    )
    : prompt;

  return { onKorrigieren: istLeitung ? onKorrigieren : undefined, dialoge };
}
