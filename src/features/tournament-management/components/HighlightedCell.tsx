/**
 * HighlightedCell - Wiederverwendbare Zelle mit bedingtem Highlight
 *
 * Verwendet in RankingTab für Statistik-Spalten (Punkte, Tore, Diff, etc.)
 * Zeigt grünen Hintergrund wenn das Kriterium für die Platzierung relevant ist.
 */

import { CSSProperties, ReactNode } from 'react';
import { colors, fontWeights, fontSizes, FontSizeKey } from '../../../design-tokens';

export interface HighlightedCellProps {
  /** Wert der angezeigt wird */
  children: ReactNode;
  /** Ob diese Zelle hervorgehoben werden soll */
  highlight?: boolean;
  /** Font-Weight wenn highlighted (default: bold) */
  highlightWeight?: 'bold' | 'semibold';
  /** Base Font-Weight wenn nicht highlighted (default: normal) */
  baseWeight?: 'normal' | 'semibold' | 'bold';
  /** Zusätzliche Text-Farbe */
  color?: string;
  /** Font-Size als Design Token Key (xs, sm, md, lg, xl, xxl, xxxl) */
  fontSize?: FontSizeKey;
  /** Padding-Größe: 'sm' für Mobile, 'md' für Desktop */
  size?: 'sm' | 'md';
}

/**
 * Zellen-Inhalt mit bedingtem Highlight-Styling
 *
 * @example
 * // Punkte mit Highlight
 * <HighlightedCell highlight={highlightPoints}>
 *   {standing.points}
 * </HighlightedCell>
 *
 * // Tordifferenz mit Farbe
 * <HighlightedCell
 *   highlight={highlightGoalDiff}
 *   color={goalDiff > 0 ? colors.primary : colors.error}
 * >
 *   {goalDiff > 0 ? '+' : ''}{goalDiff}
 * </HighlightedCell>
 */
export const HighlightedCell: React.FC<HighlightedCellProps> = ({
  children,
  highlight = false,
  highlightWeight = 'bold',
  baseWeight = 'normal',
  color,
  fontSize,
  size = 'md',
}) => {
  const padding = size === 'sm' ? '2px 6px' : '2px 8px';

  const style: CSSProperties = {
    fontWeight: highlight ? fontWeights[highlightWeight] : fontWeights[baseWeight],
    padding: highlight ? padding : '0',
    background: highlight ? colors.rankingHighlightBg : 'transparent',
    borderRadius: highlight ? '4px' : '0',
    ...(color && { color }),
    ...(fontSize && { fontSize: fontSizes[fontSize] }),
  };

  return <span style={style}>{children}</span>;
};
