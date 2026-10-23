/**
 * usePublicView (A-36c): die gemeinsame Ansicht der Zuschauer (`buildTournamentView`, Zielgruppe `viewer`).
 * Status, Seitentexte, Endstand und Sichtbarkeit der Zuschauer-Seiten kommen nur von hier. Die Sprache ist die feste
 * Anzeigesprache der Seite (B-41, bis @ZM-106), die Uhrzeit die Ortszeit des Turniers (@ZM-111).
 * Erst mit fertigem Spielplan: ein Turnier, dessen Spielplan nicht entsteht, bekommt keine Ansicht.
 */
import { useMemo } from 'react';
import { buildTournamentView, engineDetailFromMatches, toTournamentLocal, TOURNAMENT_TIME_ZONE, type TournamentView } from '../../core/view';
import type { GeneratedSchedule } from '../../core/generators';
import { ANZEIGE_SPRACHE } from '../../i18n/anzeigeSprache';
import type { Tournament } from '../../types/tournament';

/**
 * `fetchedAtMs`: Serverzeit, zu der der Stand abgerufen wurde (B-15, @ZM-026): auf sie beziehen sich die Uhren der laufenden
 * Spiele. Ohne Angabe die Geräteuhr zum Zeitpunkt der Berechnung.
 */
export function usePublicView(tournament: Tournament | null, schedule: GeneratedSchedule | null, fetchedAtMs?: number | null): TournamentView | null {
  return useMemo(
    () => (tournament === null || schedule === null
      ? null
      : buildTournamentView({ ...tournament, engineDetail: engineDetailFromMatches(tournament.matches, fetchedAtMs ?? new Date().getTime()) }, {
        audience: 'viewer',
        medium: 'app',
        locale: ANZEIGE_SPRACHE,
        now: toTournamentLocal(new Date(), TOURNAMENT_TIME_ZONE),
      })),
    [tournament, schedule, fetchedAtMs],
  );
}
