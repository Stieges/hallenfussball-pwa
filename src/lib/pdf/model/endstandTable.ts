/**
 * Abstufung der Tabellenspalten im Endstand (@DR-051). Rein. „Platz“ und „Punkte“ stehen immer gleich und am größten (fett);
 * die übrigen Zahlen folgen der Wertungsreihenfolge des Turniers: die erste Wertung nach den Punkten, die eine Spalte hat
 * (Tordifferenz oder Tore), eine Stufe darunter, alles Weitere in der kleinsten Stufe. Der direkte Vergleich hat keine Spalte.
 */
import { printEndTable } from '../../../design-tokens/print-endstand';
import { effectivePlacementLogic } from '../../../core/standings/placementDefaults';
import type { PlacementCriterion } from '../../../types/tournament';
import type { FontWeight } from './measure';

/** Spalten einer Gruppentabelle, die eine Zahl tragen. */
export type NumberColumn = 'pos' | 'played' | 'won' | 'drawn' | 'lost' | 'goals' | 'diff' | 'points';

export interface ColumnStyle { pt: number; weight: FontWeight }

/** Wertung → Spalte; die übrigen Kriterien (Punkte, direkter Vergleich) bestimmen die Abstufung nicht. */
const COLUMN_OF: Readonly<Record<string, NumberColumn>> = { goalDifference: 'diff', goalsFor: 'goals' };

/** Schrift jeder Zahlenspalte nach der Wertungsreihenfolge (`placementLogic`; leer = Voreinstellung der App). */
export function endstandColumnStyles(placementLogic: readonly PlacementCriterion[]): Record<NumberColumn, ColumnStyle> {
  const order = effectivePlacementLogic(placementLogic)
    .filter(criterion => criterion.enabled)
    .map(criterion => COLUMN_OF[criterion.id])
    .filter((column): column is NumberColumn => column !== undefined);
  const rest: ColumnStyle = { pt: printEndTable.restPt, weight: 'normal' };
  const styleOf = (column: NumberColumn): ColumnStyle => (order[0] === column ? { pt: printEndTable.secondPt, weight: 'normal' } : rest);
  const top: ColumnStyle = { pt: printEndTable.topPt, weight: 'bold' };
  return { pos: top, points: top, played: rest, won: rest, drawn: rest, lost: rest, goals: styleOf('goals'), diff: styleOf('diff') };
}

/** Beschriftungen der Wertung in ihrer Reihenfolge („Punkte“, „Tordifferenz“, „Tore“), nur die eingeschalteten Kriterien. */
export function tiebreakCriteria(placementLogic: readonly PlacementCriterion[], criterionText: (id: string, fallback: string) => string): string[] {
  return effectivePlacementLogic(placementLogic).filter(criterion => criterion.enabled).map(criterion => criterionText(criterion.id, criterion.label ?? criterion.id));
}
