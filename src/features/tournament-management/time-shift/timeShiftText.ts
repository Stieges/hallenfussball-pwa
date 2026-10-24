/**
 * B-26: Texte für „Zeiten verschieben“ aus dem Plan (Uhrzeiten als Wanduhr wie im ganzen Spielplan, Spiele mit Nummer).
 */
import type { TFunction } from 'i18next';
import type { KeptMatch, ShiftPlan, ShiftWarning } from '../../../core/services/scheduleShift';

/** „hh:mm“ einer Wanduhr; ohne Uhrzeit `undefined`. */
export function clockText(value: Date | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return undefined;
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** „Spiel 15 und Spiel 16“, „Spiel 1, Spiel 2 und Spiel 3“ */
export function matchList(t: TFunction<'tournament'>, numbers: ReadonlyArray<number | undefined>): string {
  const names = numbers.map((n) => t('timeShift.matchName', { number: n ?? '?' }));
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')}${t('timeShift.and')}${names[names.length - 1]}`;
}

/** „15 und 16“ für Sätze, die „Spiel“ schon tragen */
export function numberList(t: TFunction<'tournament'>, numbers: ReadonlyArray<number | undefined>): string {
  const names = numbers.map((n) => String(n ?? '?'));
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')}${t('timeShift.and')}${names[names.length - 1]}`;
}

const KEPT_KEY = {
  running: 'timeShift.keptRunning',
  finished: 'timeShift.keptFinished',
  cancelled: 'timeShift.keptCancelled',
  past: 'timeShift.keptPast',
} as const satisfies Record<KeptMatch['reason'], string>;

/** „Spiel 6 (beendet), Spiel 7 (läuft)“ */
export function keptText(t: TFunction<'tournament'>, kept: readonly KeptMatch[]): string {
  return kept.map((k) => t(KEPT_KEY[k.reason], { number: k.matchNumber ?? '?' })).join(', ');
}

export function warningText(t: TFunction<'tournament'>, w: ShiftWarning): string {
  if (w.kind === 'shortNotice') {
    return t('timeShift.warnShortNotice', { count: w.matchNumbers.length, numbers: numberList(t, w.matchNumbers), minutes: w.inMinutes });
  }
  if (w.gapMinutes < 0) {
    return t('timeShift.warnOverlap', { field: w.field, before: w.before ?? '?', after: w.after ?? '?', minutes: -w.gapMinutes });
  }
  return t('timeShift.warnBuffer', { field: w.field, before: w.before ?? '?', after: w.after ?? '?', gap: w.gapMinutes, count: w.requiredMinutes });
}

/** Erstes und letztes verschobenes Spiel nach Nummer */
export function rangeOf(plan: ShiftPlan): { first: number | undefined; last: number | undefined } {
  const numbers = plan.changes.map((c) => c.matchNumber).filter((n): n is number => n !== undefined).sort((a, b) => a - b);
  return { first: numbers[0], last: numbers[numbers.length - 1] };
}
