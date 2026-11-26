/**
 * Torzahlen „9:4“ der Gruppentabelle. Bei Sortierung nach Tore (erste Zahl) oder Gegentore (zweite Zahl) ist genau diese Zahl
 * unterstrichen und trägt `data-goals-focus` – nie nur Farbe, und getrennt von der Fläche der Wertung (`placementHighlights`, @TS-014).
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';

const focusStyle: CSSProperties = { textDecoration: 'underline', textUnderlineOffset: cssVars.spacing.xs, fontWeight: cssVars.fontWeights.bold };

export interface GoalsPairProps {
  goalsFor: number;
  goalsAgainst: number;
  focus?: 'for' | 'against';
}

export function GoalsPair({ goalsFor, goalsAgainst, focus }: GoalsPairProps) {
  if (focus === undefined) {return <>{goalsFor}:{goalsAgainst}</>;}
  return (
    <>
      <span data-goals-focus={focus === 'for' ? 'for' : undefined} style={focus === 'for' ? focusStyle : undefined}>{goalsFor}</span>
      :
      <span data-goals-focus={focus === 'against' ? 'against' : undefined} style={focus === 'against' ? focusStyle : undefined}>{goalsAgainst}</span>
    </>
  );
}
