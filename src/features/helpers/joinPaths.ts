/**
 * Ziele der Helfer-Seite (A-17b): reine Funktionen, damit Adressen und Datumsform an einer Stelle stehen und testbar sind.
 * Der Live-Reiter liegt unter `/tournament/:id/live`, das Feld in `?f=` (URL-ROUTING.md, `useFieldMatchSelection`).
 */
export const HELPER_JOIN_PATH_PREFIX = '/join/';

/** @HE-095, @HE-098 Z.3: Feld öffnen; ohne Feld Feld 1 (die Ansicht liefert `field` schon mit Vorgabe 1). */
export function helperFieldPath(tournamentId: string, field: number): string {
  return `/tournament/${encodeURIComponent(tournamentId)}/live?f=${field}`;
}

export function helperTournamentPath(tournamentId: string): string {
  return `/tournament/${encodeURIComponent(tournamentId)}`;
}

/** @HE-055 Z.2: wer nur noch zusieht, sieht den Spielplan. */
export function helperSchedulePath(tournamentId: string): string {
  return `/tournament/${encodeURIComponent(tournamentId)}/schedule`;
}

/** @HE-098 Z.2: nach dem Abschluss der Endstand. */
export function helperStandingsPath(tournamentId: string): string {
  return `/tournament/${encodeURIComponent(tournamentId)}/standings`;
}

/** @HE-033: Weg zur Zuschauer-Ansicht, nur wenn das Turnier einen Zuschauer-Link hat. */
export function spectatorPath(shareCode: string): string {
  return `/live/${encodeURIComponent(shareCode)}`;
}

/** „Sa 28.11.“ aus `YYYY-MM-DD` (Ortszeit, ohne Zeitzonen-Sprung); unlesbare Werte kommen unverändert zurück. */
export function formatJoinDate(date: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) {
    return date;
  }
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }).format(parsed);
}
