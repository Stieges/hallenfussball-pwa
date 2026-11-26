/**
 * Sortierköpfe und Bedienteile der Gruppentabelle (@TS-001, @TS-003, @TS-005, @TS-012, @TS-014): geteilt von der breiten und der
 * Handy-Tabelle, damit beide dieselbe Sortierung zeigen. Ohne Sortierung (`sort === null`: kein Provider, Spielplan, Vorschau)
 * bleibt jeder Kopf ein einfacher Text wie bisher.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../design-tokens';
import type { SortColumn, SortedColumn, SortState } from '../../core/standings/tableSort';
import { ShortLabel } from '../ui/atoms';
import { SHORT_TERMS, type TableHeadTerm } from '../ui/atoms/shortTerms';
import { Icons } from '../ui/Icons';
import { SortableHeader } from '../ui/molecules/SortableHeader';
import { SortPicker, type SortPickerOption } from '../ui/molecules/SortPicker';
import { SortReset } from '../ui/molecules/SortReset';

/** Sortierung einer Gruppentabelle, wie sie die Karte an die Tabellen reicht. `key` = Tabellenschlüssel (`tableKey`). */
export interface GroupSort {
  key: string;
  state: SortState;
  onTap: (column: SortColumn) => void;
}

const platzButton: CSSProperties = {
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

const compactButton: CSSProperties = { minWidth: cssVars.spacing.lg, width: '100%', padding: 0, flexDirection: 'column', justifyContent: 'center', gap: 0 };

interface HeadCellProps {
  sort: GroupSort | null;
  column: SortedColumn | 'platz';
  /** Kurzform mit Glossar-Begriff (Sp., S, Pkt. …); ohne: `text`. */
  term?: TableHeadTerm;
  text?: string;
  style: CSSProperties;
  /** Taste füllt die Zelle in der Breite (nur die Höhe hat das Touch-Maß), Pfeil unter dem Wort: die Spalten bleiben so schmal wie ohne Sortierung. */
  compact?: boolean;
}

/** Ein Spaltenkopf: mit Sortierung eine Taste, sonst Text. Der Kopf „Platz“ trägt die Platzierung (Pfeil, Tipp = zurück). */
export function GroupHeadCell({ sort, column, term, text, style, compact = false }: HeadCellProps) {
  const { t } = useTranslation();
  const visual: ReactNode = term ? <ShortLabel term={term} /> : text;
  if (sort === null) {return <th style={style}>{visual}</th>;}
  const testId = `sort-head-${sort.key}-${column}${compact ? '-m' : ''}`;
  if (column === 'platz') {
    return (
      <th style={style} scope="col" aria-sort={sort.state === null ? 'ascending' : 'none'}>
        <button type="button" style={compact ? { ...platzButton, ...compactButton } : platzButton} data-testid={testId} data-sorted={sort.state === null ? 'true' : 'false'} onClick={() => sort.onTap('platz')}>
          {visual}
          {sort.state === null ? <Icons.ArrowUp size={iconSizeValues.xs} /> : null}
        </button>
      </th>
    );
  }
  const label = term ? (t as (key: string) => string)(SHORT_TERMS[term].long) : (text ?? '');
  return <SortableHeader column={column} label={label} visual={term ? visual : undefined} state={sort.state} onTap={sort.onTap} testId={testId} style={style} compact={compact} />;
}

/** Spalten und Richtungen der Handy-Auswahl (die Köpfe der Handy-Tabelle zeigen nur einen Teil). */
const PICKER_COLUMNS: ReadonlyArray<{ column: SortedColumn; term?: TableHeadTerm }> = [
  { column: 'team' }, { column: 'sp', term: 'played' }, { column: 's', term: 'won' }, { column: 'u', term: 'drawn' }, { column: 'n', term: 'lost' },
  { column: 'tore' }, { column: 'gegentore' }, { column: 'diff', term: 'goalDifference' }, { column: 'pkt', term: 'points' },
];

interface BarProps {
  sort: GroupSort;
  onChange: (state: SortState) => void;
  onReset: () => void;
}

/** Einmal je Karte: „Nach Platzierung“ (nur wenn sortiert) und am Handy die Auswahl „Sortieren nach …“. */
export function GroupSortBar({ sort, onChange, onReset }: BarProps) {
  const { t } = useTranslation('tournament');
  const long = t as unknown as (key: string, options?: Record<string, string>) => string;
  const name = (column: SortedColumn, term?: TableHeadTerm): string => {
    if (term) {return long(SHORT_TERMS[term].long);}
    return column === 'team' ? long('groupTables.columns.team') : column === 'tore' ? long('groupTables.columns.goals') : long('tableSort.gegentore');
  };
  const options: SortPickerOption[] = PICKER_COLUMNS.flatMap(({ column, term }) => [
    { value: { column, reversed: false }, label: name(column, term) },
    { value: { column, reversed: true }, label: long('tableSort.optionReversed', { label: name(column, term) }) },
  ]);
  return (
    <>
      {/* Die Auswahl gibt es nur am Handy (CSS der Karte); das Maß hängt am Wrapper, damit ohne Auswahl keine Lücke bleibt */}
      <div className="sort-picker-mobile" style={{ marginBottom: cssVars.spacing.md }}>
        <SortPicker options={options} state={sort.state} onChange={onChange} testId={`sort-picker-${sort.key}`} />
      </div>
      {sort.state !== null && (
        <div className="sort-reset-bar" style={{ marginBottom: cssVars.spacing.md }}>
          <SortReset visible onReset={onReset} testId={`sort-reset-${sort.key}`} />
        </div>
      )}
    </>
  );
}
