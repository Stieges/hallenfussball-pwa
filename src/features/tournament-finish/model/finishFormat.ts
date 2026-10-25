/**
 * Zeitangaben im Abschluss-Dialog und in der Verwaltung („Sa., 28.11.2026“, „13:10“; Mockup Zustand C). Rein, ohne React.
 * Ortszeit des Geräts; ein unlesbarer Zeitstempel ergibt `null` statt „Invalid Date“.
 */
export function localeTag(language: string): string {
  return language.startsWith('en') ? 'en-GB' : 'de-DE';
}

function parse(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** „Sa., 28.11.2026“. */
export function formatDay(value: string | number | Date | null | undefined, language = 'de'): string | null {
  const date = parse(value);
  return date === null ? null : date.toLocaleDateString(localeTag(language), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** „13:10“. */
export function formatClock(value: string | number | Date | null | undefined, language = 'de'): string | null {
  const date = parse(value);
  return date === null ? null : date.toLocaleTimeString(localeTag(language), { hour: '2-digit', minute: '2-digit' });
}

/** Ganze Tage von `from` bis `now` (abgerundet); `null` bei unlesbarem Wert. */
export function daysBetween(from: string | number | Date | null | undefined, now: Date): number | null {
  const date = parse(from);
  return date === null ? null : Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}
