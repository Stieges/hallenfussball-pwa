/**
 * Zeit auf der Turnierkarte der Startseite (@OB-079): unter „Heute“ nur die Uhrzeit („08:30“), sonst Tag und Uhrzeit
 * („Sa 28.11. · 08:30“, englisch „Sat 28 Nov · 08:30“). Sprache aus i18n, 24-Stunden-Uhr, kein „Uhr“.
 */
import type { Tournament } from '../types/tournament';
import { getTournamentDateTime } from './tournamentCategories';

function localeFor(language: string): string {
  return language.startsWith('de') ? 'de-DE' : 'en-GB';
}

export function formatCardTime(tournament: Tournament, language: string, withDay: boolean, noDateText: string): string {
  const date = getTournamentDateTime(tournament);
  if (date === null) {
    return tournament.date || noDateText;
  }
  const locale = localeFor(language);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  if (!withDay) {
    return time;
  }
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).replace(/\.$/, '');
  const day = new Intl.DateTimeFormat(locale, locale === 'de-DE' ? { day: 'numeric', month: 'numeric' } : { day: 'numeric', month: 'short' }).format(date);
  return `${weekday} ${day} · ${time}`;
}
