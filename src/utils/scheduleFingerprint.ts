/**
 * scheduleFingerprint (C3a-2a Fixrunde 1, I2): eine referenzstabile Zusammenfassung der
 * SPIELPLAN-Daten eines Turniers (IDs, Teams, Schiri, Feld, Zeit, Phase) -- ausdruecklich OHNE
 * Ergebnis-/Status-Felder (`scoreA/B`, `matchStatus`, `overtimeScoreA/B`, `penaltyScoreA/B`,
 * `decidedBy`, `finishedAt`), die das W7-Overlay (`useEngineOverlayForTournament`) bei jeder
 * Stand-/Statusaenderung eines Engine-Spiels neu schreibt.
 *
 * Ohne diese Trennung haengen Lade-Effekte (`useMatchExecution.ts` Lade-Effekt,
 * `useEngineMatches.ts` ensureMatch-Effekt) an `tournament.matches` selbst -- JEDE
 * Overlay-Aenderung erzeugt ein neues `matches`-Array und loest sie erneut aus (Netzaufruf
 * `liveMatchRepository.getAll`, IDB-Schreibzugriffe `ensureMatch` fuer ALLE Spiele, Sammelabfrage,
 * `catchUpLoaded`) -- ein Verstoss gegen W3 ("Sammelabfrage nur beim tatsaechlichen Laden").
 *
 * Der Fingerprint ist ein einfacher String (Wertevergleich in einer `useMemo`/Effekt-
 * Abhaengigkeitsliste) -- KEINE Objektreferenz, bleibt also bei inhaltlich gleichem Spielplan
 * ueber Renders hinweg identisch, auch wenn `tournament`/`tournament.matches` selbst eine neue
 * Referenz sind (Overlay-Objekt).
 */
import type { Tournament } from '../types/tournament';

export function scheduleFingerprint(tournament: Tournament): string {
  return tournament.matches
    .map((match) =>
      [
        match.id,
        match.teamA,
        match.teamB,
        match.referee ?? '',
        match.field,
        match.round,
        match.matchNumber ?? '',
        match.phase ?? '',
        match.group ?? '',
        match.label ?? '',
        match.scheduledTime instanceof Date ? match.scheduledTime.toISOString() : (match.scheduledTime ?? ''),
      ].join('\u0001'),
    )
    .join('\u0002');
}
