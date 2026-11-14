/**
 * Fakten der Kopfzeile der Zuschauer-Seite (@ZM-210): „Sa, 28.11. · ab 16:30 Uhr · Sporthalle Waging“ und ob die Einzelheiten
 * von sich aus aufgeklappt stehen (bis zum ersten Anpfiff). Reine Rechnung, ohne React.
 */
import { clockKey, type MatchView } from '../../core/view';
import type { Tournament } from '../../types/tournament';

/** „Sa, 28.11.“ (de) bzw. „Sat, 28/11“ (sonst) aus einem ISO-Datum; Wochentag in Turnier-Kalender (UTC-Mittag, kein Zeitzonen-Sprung). */
export function headDateText(isoDate: string | undefined, language: string): string | undefined {
  const found = isoDate === undefined ? null : /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (found === null) { return undefined; }
  const [, year, month, day] = found;
  const noon = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  const german = language.startsWith('de');
  const weekday = new Intl.DateTimeFormat(german ? 'de-DE' : 'en-GB', { weekday: 'short', timeZone: 'UTC' }).format(noon).replace(/\.$/, '');
  return german ? `${weekday}, ${day}.${month}.` : `${weekday}, ${day}/${month}`;
}

/** Anstoß des ersten Spiels („HH:MM“) – das früheste Spiel des Turniers; ohne Anstoßzeiten `undefined`. */
export function firstKickoffTime(matches: readonly Pick<MatchView, 'kickoff'>[]): string | undefined {
  const clocks = matches.flatMap((m) => (m.kickoff === undefined ? [] : [m.kickoff]));
  clocks.sort((a, b) => clockKey(a).localeCompare(clockKey(b)));
  return clocks[0]?.time;
}

/** Ein Spiel ist angepfiffen worden: läuft, ist unterbrochen oder beendet (ausgefallene Spiele zählen nicht). */
export function anyMatchStarted(matches: readonly Pick<MatchView, 'status'>[]): boolean {
  return matches.some((m) => m.status === 'running' || m.status === 'paused' || m.status === 'finished' || m.status === 'awarded');
}

/** Ort ausgeschrieben: „Sporthalle Waging, Mozartstraße 9, 83329 Waging am See“; fehlende Teile fehlen. */
export function locationLong(location: Tournament['location'] | undefined): string | undefined {
  if (location === undefined) { return undefined; }
  const cityLine = [location.postalCode, location.city].filter((p): p is string => p !== undefined && p.trim() !== '').join(' ');
  const parts = [location.name, location.street, cityLine].filter((p): p is string => p !== undefined && p.trim() !== '');
  return parts.length === 0 ? undefined : parts.join(', ');
}

export const headStorageKey = (shareCode: string): string => `live:${shareCode}:headDetails`;

/** Eigene Wahl am Gerät: 'open' | 'closed' | undefined (nie gewählt oder kein Speicher). */
export function readHeadChoice(shareCode: string): boolean | undefined {
  try {
    const value = window.localStorage.getItem(headStorageKey(shareCode));
    return value === 'open' ? true : value === 'closed' ? false : undefined;
  } catch { return undefined; }
}

export function writeHeadChoice(shareCode: string, open: boolean): void {
  try { window.localStorage.setItem(headStorageKey(shareCode), open ? 'open' : 'closed'); } catch { /* ohne Speicher gilt der Standard */ }
}
