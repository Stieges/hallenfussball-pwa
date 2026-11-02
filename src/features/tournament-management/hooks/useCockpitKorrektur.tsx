/**
 * useCockpitKorrektur (B-10a2, @SL-159): „Korrigieren“ im Cockpit nach dem Abpfiff. Es gibt keinen zweiten Korrektur-Weg: das Ergebnis geht
 * über `useScheduleResultEntry.enterScore` – Turnierleitung-Prüfung, Stand-Abgleich (veraltet = Hinweis), Grund-Auswahl (Grundpflicht
 * @EK-004), `CORRECTION` über die Engine und Ablehnungstexte sind dieselben wie im Spielplan. Neu ist nur der Einstieg: ein Dialog mit dem
 * bisherigen und dem korrigierten Ergebnis. Nur die Turnierleitung (`istLeitung`) bekommt einen Handler; der Helfer keinen (@HE-043).
 * Solange die Korrektur offen ist (Dialog, Grund-Auswahl, Senden), pausiert der Countdown des Endstands (`onBeginn`, @SL-163); nach Speichern
 * oder Abbruch läuft er weiter (`onEnde`, @SL-164).
 */
import { useCallback, type ReactElement } from 'react';
import { useToast } from '../../../components/ui/Toast';
import { liveMatchFinalScore } from '../../../utils/matchScore';
import type { LiveMatch } from '../../../components/live-cockpit/types';
import type { Tournament } from '../../../types/tournament';
import { ScheduleResultEntryPrompt } from '../components/ScheduleResultEntryPrompt';
import { useKorrekturEinstieg, type KorrekturPause, type KorrekturSpiel } from './useKorrekturEinstieg';
import { useScheduleResultEntry } from './useScheduleResultEntry';

export interface CockpitKorrektur {
  /** Fehlt für Helfer; mit Handler steht „Korrigieren“ in der Leiste. */
  onKorrigieren: ((matchId: string) => void) | undefined;
  /** Dialog und Grund-Auswahl, wenn offen; sonst `null`. */
  dialoge: ReactElement | null;
}

export type CockpitKorrekturPause = KorrekturPause;

export function useCockpitKorrektur(
  tournament: Tournament, liveMatches: ReadonlyMap<string, LiveMatch>, istLeitung: boolean, pause: CockpitKorrekturPause = {},
): CockpitKorrektur {
  const { showWarning } = useToast();
  // Das Sperrfeld des Spielplans („Ergebnisse beendeter Spiele sperren“) gilt für die Schnelleingabe dort; „Korrigieren“ ist die ausdrückliche Korrektur.
  const resultEntry = useScheduleResultEntry({ tournament, showWarning, lockFinishedResults: false });
  const spielOf = useCallback((matchId: string): KorrekturSpiel | null => {
    const match = liveMatches.get(matchId);
    if (!match) { return null; }
    const stand = liveMatchFinalScore(match);
    return { number: match.number, homeName: match.homeTeam.name, awayName: match.awayTeam.name, scoreHome: stand.a, scoreAway: stand.b };
  }, [liveMatches]);
  const einstieg = useKorrekturEinstieg({ enterScore: resultEntry.enterScore, spielOf, istLeitung, pause });

  const prompt = resultEntry.prompt ? <ScheduleResultEntryPrompt prompt={resultEntry.prompt} answerPrompt={resultEntry.answerPrompt} /> : null;
  return { onKorrigieren: einstieg.onKorrigieren, dialoge: einstieg.dialog ?? prompt };
}
