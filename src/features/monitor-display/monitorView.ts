/**
 * Die Ansicht des Hallen-Monitors (A-36c): EINE gemeinsame Turnier-Ansicht für alle Folien (Zielgruppe `screen`,
 * Medium `app`). Status, Seitentexte, Anstoßzeit, Endstand und Sichtbarkeit kommen nur von hier.
 * Die Sprache ist die feste Anzeigesprache (B-41, bis @ZM-126); `now` ist die Ortszeit des Turniers (@ZM-111).
 */
import { buildTournamentView, toTournamentLocal, TOURNAMENT_TIME_ZONE, type TournamentView } from '../../core/view';
import { ANZEIGE_SPRACHE } from '../../i18n/anzeigeSprache';
import type { Tournament } from '../../types/tournament';

export function buildMonitorView(tournament: Tournament): TournamentView {
  return buildTournamentView(tournament, {
    audience: 'screen',
    medium: 'app',
    locale: ANZEIGE_SPRACHE,
    now: toTournamentLocal(new Date(), TOURNAMENT_TIME_ZONE),
  });
}
