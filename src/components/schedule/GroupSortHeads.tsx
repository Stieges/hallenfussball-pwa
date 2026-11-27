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
import { MobileSortHeadWord } from '../ui/molecules/MobileSortHeadWord';
import { SortReset } from '../ui/molecules/SortReset';
import type { MobileSortColumn } from './mobileSortColumns';

/** Sortierung einer Gruppentabelle, wie sie die Karte an die Tabellen reicht. `key` = Tabellenschlüssel (`tableKey`). */
export interface GroupSort {
  key: string;
  state: SortState;
  onTap: (column: SortColumn) => void;
}

const platzButton: CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'row', // der Pfeil steht klein neben dem Wort: die Kopfzeile bleibt so hoch wie ohne Sortierung (Entscheidung 26.11.)
  justifyContent: 'center',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
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
  /** Handy-Tabelle: kein Bedienelement, nur Anzeige (Wort oben, Pfeilreihe darunter, `aria-sort` am Kopf); bedient wird über „Sortieren nach …“. */
  indicator?: boolean;
}

const FEWEST_FIRST: readonly SortColumn[] = ['team', 'gruppe', 'n', 'gegentore'];

/** Handy-Kopf (nur Anzeige): Wort oben, darunter die feste Pfeilreihe; Pfeil nur bei Sortierung unter der gewählten Spalte, bei „Nach Platzierung“ keiner (Entscheidung 27.11.). */
function IndicatorHead({ sort, column, visual, style }: { sort: GroupSort; column: SortedColumn | 'platz'; visual: ReactNode; style: CSSProperties }) {
  const active = column === 'platz' ? sort.state === null : sort.state?.column === column;
  const descending = column === 'platz' || sort.state === null ? false : FEWEST_FIRST.includes(column) === sort.state.reversed;
  const ariaSort = !active ? 'none' : descending ? 'descending' : 'ascending';
  const arrow = column === 'platz' || !active ? null : descending ? 'desc' : 'asc';
  return (
    <th style={style} scope="col" aria-sort={ariaSort} data-sort-indicator={arrow ?? undefined}>
      <MobileSortHeadWord visual={visual} arrow={arrow} />
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

/** Begriff je Spalte, nur für den Namen einer Spalte, die am Handy nicht sichtbar ist, aber (Adresse, Gerät) schon sortiert. */
const TERM_OF: Partial<Record<SortedColumn, TableHeadTerm>> = { sp: 'played', s: 'won', u: 'drawn', n: 'lost', diff: 'goalDifference', pkt: 'points', gruppe: 'group' };

const GROUP_PICKER_COLUMN = { column: 'gruppe', term: 'group' } as const;

interface BarProps {
  sort: GroupSort;
  /** Spalten, die die Handy-Tabelle zeigt (dieselbe Liste wie ihre Köpfe, `mobileSortColumns.ts`); nur sie stehen in der Auswahl. */
  columns: readonly MobileSortColumn[];
  onChange: (state: SortState) => void;
  onReset: () => void;
  /** Auswahl auch mit „Gruppe“ (Platzierung über alle Gruppen bei einem Turnier mit Gruppen). */
  withGroup?: boolean;
  /** Auswahl „Sortieren nach …“ anzeigen (Vorgabe: ja, am Handy per CSS der Karte). Die Platzierung entscheidet selbst, ob Handy. */
  picker?: boolean;
}

/** Einmal je Karte: „Nach Platzierung“ (nur wenn sortiert) und am Handy die Auswahl „Sortieren nach …“. */
export function GroupSortBar({ sort, columns: shown, onChange, onReset, withGroup = false, picker = true }: BarProps) {
  const { t } = useTranslation('tournament');
  const long = t as unknown as (key: string, options?: Record<string, string>) => string;
  const name = (column: SortedColumn, term?: TableHeadTerm): string => {
    if (term) {return long(SHORT_TERMS[term].long);}
    return column === 'team' ? long('groupTables.columns.team') : column === 'tore' ? long('groupTables.columns.goals') : long('tableSort.gegentore');
  };
  const columns: readonly MobileSortColumn[] = withGroup ? [shown[0], GROUP_PICKER_COLUMN, ...shown.slice(1)] : shown;
  const options: SortPickerOption[] = columns.flatMap(({ column, term }) => [
    { value: { column, reversed: false }, label: name(column, term) },
    { value: { column, reversed: true }, label: long('tableSort.optionReversed', { label: name(column, term) }) },
  ]);
  // Steht die Sortierung (Adresse, Gerät) auf einer Spalte, die am Handy fehlt, zeigt die Auswahl sie weiter als gewählt – nie still „Nach Platzierung“.
  const current = sort.state;
  if (current !== null && !options.some((o) => o.value?.column === current.column && o.value.reversed === current.reversed)) {
    const label = name(current.column, TERM_OF[current.column]);
    options.push({ value: current, label: current.reversed ? long('tableSort.optionReversed', { label }) : label });
  }
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
