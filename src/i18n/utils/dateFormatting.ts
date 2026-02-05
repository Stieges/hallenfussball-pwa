import i18n from 'i18next';

/**
 * Locale-aware date formatting using Intl.DateTimeFormat.
 *
 * Uses the current i18n language so dates automatically
 * switch format when the user changes language.
 *
 * German: 01.02.2026
 * English: 02/01/2026
 */

export function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}
