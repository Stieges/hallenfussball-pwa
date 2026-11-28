/**
 * Wertung auf der Zuschauer-Seite (@ZM-221): „Wertung: Sieg 3 · Unentschieden 1 · Niederlage 0 Punkte“ und die Reihenfolge bei
 * Punktgleichheit aus `placementLogic` (nur eingeschaltete Kriterien, in deren Reihenfolge, ohne „points“ selbst). Reine Rechnung;
 * die Texte kommen aus dem Namespace `publicView` (Schlüssel `wertung.*`).
 */
import type { TFunction } from 'i18next';
import type { Tournament } from '../../types/tournament';

export interface WertungLines {
  /** „Wertung: Sieg 3 · Unentschieden 1 · Niederlage 0 Punkte“ */
  points: string;
  /** „Bei Punktgleichheit: 1. direkter Vergleich · 2. Tordifferenz · 3. mehr Tore“ (Einzelheiten); fehlt ohne weitere Kriterien */
  tiebreakNumbered?: string;
  /** „Bei Punktgleichheit: direkter Vergleich, Tordifferenz, mehr Tore“ (unter den Tabellen); fehlt ohne weitere Kriterien */
  tiebreakShort?: string;
}

const NAME_KEY = {
  directComparison: 'wertung.criterion.directComparison',
  goalDifference: 'wertung.criterion.goalDifference',
  goalsFor: 'wertung.criterion.goalsFor',
} as const;

/** Namen der eingeschalteten Kriterien nach „Punkte“, in der Reihenfolge des Turniers; Unbekanntes nur mit eigener Beschriftung. */
export function tiebreakNames(t: TFunction<'publicView'>, logic: Tournament['placementLogic']): string[] {
  return logic.flatMap((c) => {
    if (!c.enabled || c.id === 'points') { return []; }
    if (c.id in NAME_KEY) { return [t(NAME_KEY[c.id as keyof typeof NAME_KEY])]; }
    const label = c.label?.trim();
    return label === undefined || label === '' ? [] : [label];
  });
}

export function wertungLines(t: TFunction<'publicView'>, tournament: Pick<Tournament, 'pointSystem' | 'placementLogic'>): WertungLines {
  const { win, draw, loss } = tournament.pointSystem;
  const names = tiebreakNames(t, tournament.placementLogic);
  return {
    points: t('wertung.points', { win, draw, count: loss }),
    tiebreakNumbered: names.length === 0 ? undefined : t('wertung.tiebreak', { list: names.map((n, i) => `${String(i + 1)}. ${n}`).join(' · ') }),
    tiebreakShort: names.length === 0 ? undefined : t('wertung.tiebreak', { list: names.join(', ') }),
  };
}
