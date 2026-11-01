/**
 * Texte zum Entwurf: welche Änderungen beim Speichern nicht übernommen wurden (@ZP-102) – mit Spielnummern.
 */
import type { TFunction } from 'i18next';
import { ensureMatchNumbers } from '../../../core/models/matchNumbers';
import type { Match } from '../../../types/tournament';
import type { SkippedChange } from './draftSteps';

/** Spielnummer je Spiel-ID (gespeicherte Nummer, sonst Spielplan-Reihenfolge). */
export function matchNumberLookup(matches: readonly Match[]): (matchId: string) => number | string {
  const numbers = new Map(ensureMatchNumbers(matches).map((m) => [m.id, m.matchNumber]));
  return (matchId) => numbers.get(matchId) ?? '?';
}

/** „Tausch von Spiel 6 und Spiel 9 – Spiel 6 ist angepfiffen“ bzw. „… inzwischen auf einem anderen Gerät geändert“, je Zeile. */
export function describeSkipped(skipped: readonly SkippedChange[], numberOf: (id: string) => number | string, t: TFunction<'tournament'>): string {
  return skipped.map((entry) => {
    const [a, b] = entry.matchIds.map(numberOf);
    const what = entry.kind === 'swap'
      ? t('draft.skipped.swap', { a, b })
      : entry.kind === 'field' || entry.kind === 'redistributeFields'
        ? t('draft.skipped.field', { a })
        : entry.kind === 'move'
          ? t('draft.skipped.move', { a })
          : t('draft.skipped.referee', { a });
    const why = [
      ...entry.startedIds.map((id) => t('draft.skipped.started', { number: numberOf(id) })),
      ...entry.changedIds.map((id) => t('draft.skipped.changedElsewhere', { number: numberOf(id) })),
    ].join(', ');
    return `${what} – ${why}`;
  }).join('\n');
}
