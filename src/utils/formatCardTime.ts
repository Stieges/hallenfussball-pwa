/**
 * Zeit auf der Turnierkarte der Startseite (@OB-079): unter „Heute“ nur die Uhrzeit („08:30“), sonst Tag und Uhrzeit
 * („Sa 28.11. · 08:30“, englisch „Sat 28 Nov · 08:30“). Sprache aus i18n, 24-Stunden-Uhr, kein „Uhr“.
 * Ohne Uhrzeit steht nur der Tag („Sa 28.11.“); unter „Heute“ dann nichts (leerer Text). Ohne jedes Datum der Ersatztext.
 */
import type { Tournament } from '../types/tournament';
import { getTournamentDateTime } from './tournamentCategories';

function localeFor(language: string): string {
  return language.startsWith('de') ? 'de-DE' : 'en-GB';
}

/** Der Starttag aus `startDate` (ISO) oder dem alten Feld `date` („2026-11-28“ oder „28.11.2026“); sonst null. */
function startDay(tournament: Tournament): Date | null {
  const raw = tournament.startDate ?? tournament.date;
  if (!raw) {
    return null;
  }
  const iso = raw.includes('.') ? raw.split('.').reverse().join('-') : raw;
  const day = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(day.getTime()) ? null : day;
}

function dayText(date: Date, locale: string): string {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date).replace(/\.$/, '');
  const day = new Intl.DateTimeFormat(locale, locale === 'de-DE' ? { day: 'numeric', month: 'numeric' } : { day: 'numeric', month: 'short' }).format(date);
  return `${weekday} ${day}`;
}

export function formatCardTime(tournament: Tournament, language: string, withDay: boolean, noDateText: string): string {
  const locale = localeFor(language);
  const dateTime = getTournamentDateTime(tournament);
  if (dateTime !== null) {
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(dateTime);
    return withDay ? `${dayText(dateTime, locale)} · ${time}` : time;
  }
  const day = startDay(tournament);
  if (day === null) {
    return noDateText;
  }
  return withDay ? dayText(day, locale) : '';
}
