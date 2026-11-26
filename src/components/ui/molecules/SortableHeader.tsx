/**
 * Sortierkopf einer Tabellenspalte (@TS-001, @TS-021): Taste im Kopf (`th`, oder `div role="columnheader"` für die
 * Tabellen ohne `<table>`), `aria-sort` am Kopf, Pfeil-Symbol + Text (Farbe trägt nie allein), Touch-Ziel ≥ 44 px.
 * Vorlesetext je Richtung: „Tore, meiste zuerst sortiert“. Kopf „Tore“ zeigt „Gegentore“, solange danach sortiert ist (@TS-014).
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { SortColumn, SortState } from '../../../core/standings/tableSort';
import { Icons } from '../Icons';

export interface SortableHeaderProps {
  column: Exclude<SortColumn, 'platz'>;
  /** Ausgeschriebener Begriff (Vorlesetext, Standard-Inhalt). */
  label: string;
  /** Sichtbare Kurzform (z. B. `<ShortLabel />`); ohne: `label`. */
  visual?: ReactNode;
  state: SortState;
  onTap: (column: SortColumn) => void;
  testId?: string;
  as?: 'th' | 'div';
  /** Stil der Kopfzelle (Farbe, Polster der Tabelle); die Taste darin erbt Farbe und Schrift. */
  style?: CSSProperties;
  /** Schmale Spalte (Handy-Tabelle): die Taste füllt die Zelle in der Breite, nur die Höhe hat das Touch-Maß. */
  compact?: boolean;
}

type Direction = 'bestFirst' | 'fewestFirst' | 'atoZ' | 'ztoA';

/** Erste Richtung je Spalte (Rahmen: Namen A–Z, Niederlagen/Gegentore wenigste zuerst, sonst meiste/beste zuerst). */
function firstDirection(column: SortColumn): 'bestFirst' | 'fewestFirst' | 'atoZ' {
  if (column === 'team' || column === 'gruppe') {return 'atoZ';}
  if (column === 'n' || column === 'gegentore') {return 'fewestFirst';}
  return 'bestFirst';
}

function currentDirection(column: SortColumn, reversed: boolean): Direction {
  const first = firstDirection(column);
  if (!reversed) {return first;}
  if (first === 'atoZ') {return 'ztoA';}
  return first === 'bestFirst' ? 'fewestFirst' : 'bestFirst';
}

const SORTED_KEY = {
  bestFirst: 'tableSort.sortedBestFirst',
  fewestFirst: 'tableSort.sortedFewestFirst',
  atoZ: 'tableSort.sortedAtoZ',
  ztoA: 'tableSort.sortedZtoA',
} as const;

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  minHeight: cssVars.touchTargets.minimum,
  minWidth: cssVars.touchTargets.minimum,
  padding: `0 ${cssVars.spacing.xs}`,
  background: 'transparent',
  border: 0,
  color: 'inherit',
  font: 'inherit',
  fontWeight: 'inherit',
  cursor: 'pointer',
};

/** Schmale Spalte: der Pfeil steht unter dem Wort statt daneben, damit die Spalte nicht breiter wird (die Teamspalte braucht die Breite, @ZM-088). */
const compactStyle = (textAlign: CSSProperties['textAlign']): CSSProperties => ({
  minWidth: cssVars.spacing.lg, // mindestens 24 px (WCAG 2.5.8)
  width: '100%',
  padding: 0,
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: textAlign === 'left' ? 'flex-start' : 'center',
  gap: 0,
});

export function SortableHeader({ column, label, visual, state, onTap, testId, as = 'th', style, compact = false }: SortableHeaderProps) {
  const { t } = useTranslation('tournament');
  // Kopf „Tore“ steht nach dem zweiten Tipp auf „Gegentore“.
  const shown = column === 'tore' && state?.column === 'gegentore' ? 'gegentore' : column;
  const active = state !== null && state.column === shown;
  const name = shown === column ? label : t('tableSort.gegentore');
  const direction = active ? currentDirection(shown, state.reversed) : null;
  const ariaSort = direction === null ? 'none' : direction === 'bestFirst' || direction === 'ztoA' ? 'descending' : 'ascending';
  const accessibleName = direction === null ? name : t(SORTED_KEY[direction], { label: name });
  const Arrow = ariaSort === 'descending' ? Icons.ArrowDown : Icons.ArrowUp;

  const button = (
    <button type="button" style={compact ? { ...buttonStyle, ...compactStyle(style?.textAlign) } : buttonStyle} aria-label={accessibleName} data-testid={testId} data-sorted={active ? 'true' : 'false'} onClick={() => onTap(column)}>
      <span>{shown === column && visual ? visual : name}</span>
      {active ? <Arrow size={iconSizeValues.xs} /> : null}
    </button>
  );
  if (as === 'div') {
    return <div role="columnheader" aria-sort={ariaSort} style={style}>{button}</div>;
  }
  return <th scope="col" aria-sort={ariaSort} style={style}>{button}</th>;
}
