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
import { SORT_HEAD_TOUCH_OK } from '../ui/molecules/sortTouchExemption';
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
  flexDirection: 'column', // der Pfeil steht unter dem Wort: die Spalte wird nicht breiter (Teamspalte braucht die Breite)
  justifyContent: 'center',
  alignItems: 'center',
  gap: 0,
  minHeight: cssVars.touchTargets.minimum,
  minWidth: cssVars.spacing.lg, // 24 px (WCAG 2.5.8), sonst so breit wie der Inhalt
  padding: `0 ${cssVars.spacing.xs}`,
  background: 'transparent',
  border: 0,
  color: 'inherit',
  font: 'inherit',
  fontWeight: 'inherit',
  cursor: 'pointer',
};

interface HeadCellProps {
  sort: GroupSort | null;
  column: SortedColumn | 'platz';
  /** Kurzform mit Glossar-Begriff (Sp., S, Pkt. …); ohne: `text`. */
  term?: TableHeadTerm;
  text?: string;
  style: CSSProperties;
  /** Handy-Tabelle: kein Bedienelement, nur Anzeige (Pfeil unter dem Wort, `aria-sort` am Kopf); bedient wird über „Sortieren nach …“. */
  indicator?: boolean;
}

const FEWEST_FIRST: readonly SortColumn[] = ['team', 'gruppe', 'n', 'gegentore'];

/** Handy-Kopf: Text wie ohne Sortierung, bei aktiver Sortierung der Pfeil unter dem Wort (die Spalte wird nicht breiter). */
function IndicatorHead({ sort, column, visual, style }: { sort: GroupSort; column: SortedColumn | 'platz'; visual: ReactNode; style: CSSProperties }) {
  const active = column === 'platz' ? sort.state === null : sort.state?.column === column;
  const descending = column === 'platz' || sort.state === null ? false : FEWEST_FIRST.includes(column) === sort.state.reversed;
  const Arrow = descending ? Icons.ArrowDown : Icons.ArrowUp;
  const ariaSort = !active ? 'none' : descending ? 'descending' : 'ascending';
  return (
    <th style={style} scope="col" aria-sort={ariaSort} data-sort-indicator={active ? (descending ? 'desc' : 'asc') : undefined}>
      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: style.textAlign === 'left' ? 'flex-start' : 'center' }}>
        {visual}
        {active ? <Arrow size={iconSizeValues.xs} /> : null}
      </span>
    </th>
  );
}

/** Ein Spaltenkopf: mit Sortierung eine Taste, sonst Text. Der Kopf „Platz“ trägt die Platzierung (Pfeil, Tipp = zurück). */
export function GroupHeadCell({ sort, column, term, text, style, indicator = false }: HeadCellProps) {
  const { t } = useTranslation();
  const visual: ReactNode = term ? <ShortLabel term={term} /> : text;
  if (sort === null) {return <th style={style}>{visual}</th>;}
  if (indicator) {return <IndicatorHead sort={sort} column={column} visual={visual} style={style} />;}
  const testId = `sort-head-${sort.key}-${column}`;
  // Spaltenbreite wie ohne Sortierung: die Taste (mindestens 24 px breit) ersetzt das waagerechte Polster der Zelle (Teamspalte behält links ihr Polster)
  const cellStyle: CSSProperties = { ...style, paddingLeft: column === 'team' ? style.paddingLeft : 0, paddingRight: 0 };
  if (column === 'platz') {
    return (
      <th style={cellStyle} scope="col" aria-sort={sort.state === null ? 'ascending' : 'none'}>
        <button type="button" style={platzButton} data-testid={testId} data-touch-ok={SORT_HEAD_TOUCH_OK} data-sorted={sort.state === null ? 'true' : 'false'} onClick={() => sort.onTap('platz')}>
          {visual}
          {sort.state === null ? <Icons.ArrowUp size={iconSizeValues.xs} /> : null}
        </button>
      </th>
    );
  }
  const label = term ? (t as (key: string) => string)(SHORT_TERMS[term].long) : (text ?? '');
  return <SortableHeader column={column} label={label} visual={term ? visual : undefined} state={sort.state} onTap={sort.onTap} testId={testId} style={cellStyle} />;
}

/** Spalten und Richtungen der Handy-Auswahl (die Köpfe der Handy-Tabelle zeigen nur einen Teil). */
const PICKER_COLUMNS: ReadonlyArray<{ column: SortedColumn; term?: TableHeadTerm }> = [
  { column: 'team' }, { column: 'sp', term: 'played' }, { column: 's', term: 'won' }, { column: 'u', term: 'drawn' }, { column: 'n', term: 'lost' },
  { column: 'tore' }, { column: 'gegentore' }, { column: 'diff', term: 'goalDifference' }, { column: 'pkt', term: 'points' },
];

const GROUP_PICKER_COLUMN = { column: 'gruppe', term: 'group' } as const;

interface BarProps {
  sort: GroupSort;
  onChange: (state: SortState) => void;
  onReset: () => void;
  /** Auswahl auch mit „Gruppe“ (Platzierung über alle Gruppen bei einem Turnier mit Gruppen). */
  withGroup?: boolean;
  /** Auswahl „Sortieren nach …“ anzeigen (Vorgabe: ja, am Handy per CSS der Karte). Die Platzierung entscheidet selbst, ob Handy. */
  picker?: boolean;
}

/** Einmal je Karte: „Nach Platzierung“ (nur wenn sortiert) und am Handy die Auswahl „Sortieren nach …“. */
export function GroupSortBar({ sort, onChange, onReset, withGroup = false, picker = true }: BarProps) {
  const { t } = useTranslation('tournament');
  const long = t as unknown as (key: string, options?: Record<string, string>) => string;
  const name = (column: SortedColumn, term?: TableHeadTerm): string => {
    if (term) {return long(SHORT_TERMS[term].long);}
    return column === 'team' ? long('groupTables.columns.team') : column === 'tore' ? long('groupTables.columns.goals') : long('tableSort.gegentore');
  };
  const columns = withGroup ? [PICKER_COLUMNS[0], GROUP_PICKER_COLUMN, ...PICKER_COLUMNS.slice(1)] : PICKER_COLUMNS;
  const options: SortPickerOption[] = columns.flatMap(({ column, term }) => [
    { value: { column, reversed: false }, label: name(column, term) },
    { value: { column, reversed: true }, label: long('tableSort.optionReversed', { label: name(column, term) }) },
  ]);
  return (
    <>
      {/* Die Auswahl gibt es nur am Handy (CSS der Karte); das Maß hängt am Wrapper, damit ohne Auswahl keine Lücke bleibt */}
      {picker && (
        <div className="sort-picker-mobile" style={{ marginBottom: cssVars.spacing.md }}>
          <SortPicker options={options} state={sort.state} onChange={onChange} testId={`sort-picker-${sort.key}`} />
        </div>
      )}
      {sort.state !== null && (
        <div className="sort-reset-bar" style={{ marginBottom: cssVars.spacing.md }}>
          <SortReset visible onReset={onReset} testId={`sort-reset-${sort.key}`} />
        </div>
      )}
    </>
  );
}
