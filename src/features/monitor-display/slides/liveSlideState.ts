/**
 * Welches Spiel die Live-Folie zeigt (@ZM-074, @ZM-075, @ZM-195): gepinntes Spiel, sonst das laufende Spiel auf dem Feld der Folie
 * (Halbzeit zählt mit), sonst das nächste offene Spiel des Feldes in Anpfiff-Reihenfolge – nie ein laufendes oder unterbrochenes
 * (@ZM-041). Eine Quelle für die Live-Folie (`LiveSlide`), auch im Profil „Halle (sehr fern)“.
 */
import type { TFunction } from 'i18next';
import type { Tournament, Match } from '../../../types/tournament';
import type { TournamentView, MatchView } from '../../../core/view';
import type { MonitorSlide } from '../../../types/monitor';
import { fieldIdToNumber } from '../monitorDisplayHelpers';

export interface LiveSlideState {
  fieldNumber: number;
  fieldName: string;
  /** Spiel der Ansicht, das gezeigt wird (läuft, ist unterbrochen oder gepinnt) */
  shown: MatchView | undefined;
  /** Dasselbe Spiel in den Turnierdaten */
  runningMatch: Match | undefined;
  /** Nächstes offenes Spiel des Feldes, nur wenn keins läuft */
  nextMatch: MatchView | undefined;
  /** Dasselbe Spiel in den Turnierdaten */
  nextRaw: Match | undefined;
}

export function liveSlideState(slide: MonitorSlide, tournament: Tournament, view: TournamentView, pinnedMatchId: string | null | undefined, t: TFunction<'monitor'>): LiveSlideState {
  const fieldNumber = fieldIdToNumber(slide.config.fieldId);
  const fieldConfig = tournament.fields?.find((f) => f.id === slide.config.fieldId);
  const fieldName = fieldConfig?.customName ?? fieldConfig?.defaultName ?? t('fieldSelector.field', { field: fieldNumber });
  const { matches } = tournament;
  const field = view.currentFor(fieldNumber);
  const shown = (pinnedMatchId ? view.byId.get(pinnedMatchId) : undefined) ?? field.live[0];
  const runningMatch = shown === undefined ? undefined : matches.find((m) => m.id === shown.id);
  const nextMatch = runningMatch ? undefined : field.next;
  const nextRaw = nextMatch === undefined ? undefined : matches.find((m) => m.id === nextMatch.id);
  return { fieldNumber, fieldName, shown, runningMatch, nextMatch, nextRaw };
}
