/**
 * Bedienteile von Endstand und Torschützenliste (@TS-001, @TS-003, @TS-005, @TS-012, @TS-021): Kopfzeile aus `div role="columnheader"`
 * (beide Listen sind Tabellen ohne `<table>`) und die Leiste mit „Sortieren nach …“ (nur Handy) und „Nach Platzierung“.
 * Am Handy sind die Köpfe nur Anzeige (Pfeil, `aria-sort`); bedient wird über die Auswahl. Ohne Sortierung (`sort === null`,
 * kein Provider) bleibt jeder Kopf einfacher Text.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import type { SortColumn, SortedColumn, SortState } from '../../../core/standings/tableSort';
import { ShortLabel } from '../../../components/ui/atoms';
import { SHORT_TERMS, type TableHeadTerm } from '../../../components/ui/atoms/shortTerms';
import { Icons } from '../../../components/ui/Icons';
import { SORT_HEAD_TOUCH_OK } from '../../../components/ui/molecules/sortTouchExemption';
import { MobileSortHeadWord } from '../../../components/ui/molecules/MobileSortHeadWord';
import { SortableHeader } from '../../../components/ui/molecules/SortableHeader';
import { SortPicker, type SortPickerOption } from '../../../components/ui/molecules/SortPicker';
import { SortReset } from '../../../components/ui/molecules/SortReset';

/** Sortierung einer Liste, wie sie die Liste an Kopfzeile und Leiste reicht. `key` = Tabellenschlüssel (`end`, `tor`). */
export interface ListSort {
  key: string;
  state: SortState;
  onTap: (column: SortColumn) => void;
  onChange: (state: SortState) => void;
  onReset: () => void;
}

export interface HeadSpec {
  column: SortedColumn | 'platz' | 'plain';
  term?: TableHeadTerm;
  text?: string;
  align: 'start' | 'end';
}

/** Schlüssel aus `SHORT_TERMS` (Gleichlauf geprüft in `kurzformen.test.ts`); die Union aller Schlüssel ist für den typisierten `t` zu groß. */
type Translate = (key: string, options?: Record<string, string>) => string;

const FEWEST_FIRST: readonly SortColumn[] = ['team', 'gruppe', 'n', 'gegentore'];

/** Die Taste hat links und rechts `spacing.xs` Polster: der Rand der Zelle rückt um dasselbe Maß hinaus, damit das Wort auf der Kante der Zeilen steht. */
const cellStyle = (align: HeadSpec['align'], withButton: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: align === 'end' ? 'flex-end' : 'flex-start', minWidth: 0,
  ...(!withButton ? {} : align === 'end' ? { marginRight: `calc(-1 * ${cssVars.spacing.xs})` } : { marginLeft: `calc(-1 * ${cssVars.spacing.xs})` }),
});

const platzButton: CSSProperties = {
  display: 'inline-flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: cssVars.spacing.xs,
  minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.spacing.lg, padding: `0 ${cssVars.spacing.xs}`,
  background: 'transparent', border: 0, color: 'inherit', font: 'inherit', fontWeight: 'inherit', cursor: 'pointer',
};

function Head({ spec, sort, mobile }: { spec: HeadSpec; sort: ListSort | null; mobile: boolean }) {
  const { t } = useTranslation();
  const long = t as unknown as Translate;
  const visual: ReactNode = spec.term ? <ShortLabel term={spec.term} /> : spec.text;
  const style = cellStyle(spec.align, sort !== null && spec.column !== 'plain' && !mobile);
  if (sort === null) {return <div role="columnheader" style={style}>{visual}</div>;}
  // Handy mit Sortierung: auch der nicht sortierbare Kopf trägt die Pfeilreihe, damit alle Wörter auf einer Linie stehen
  if (spec.column === 'plain') {return <div role="columnheader" style={style}>{mobile ? <MobileSortHeadWord visual={visual} arrow={null} /> : visual}</div>;}
  const column = spec.column;
  const active = column === 'platz' ? sort.state === null : sort.state?.column === column;
  const descending = column === 'platz' || sort.state === null ? false : FEWEST_FIRST.includes(column) === sort.state.reversed;
  const testId = `sort-head-${sort.key}-${column}`;
  if (mobile) {
    const ariaSort = !active ? 'none' : descending ? 'descending' : 'ascending';
    const arrow = column === 'platz' || !active ? null : descending ? 'desc' : 'asc';
    return (
      <div role="columnheader" aria-sort={ariaSort} style={style} data-sort-indicator={arrow ?? undefined}>
        <MobileSortHeadWord visual={visual} arrow={arrow} />
      </div>
    );
  }
  if (column === 'platz') {
    return (
      <div role="columnheader" aria-sort={active ? 'ascending' : 'none'} style={style}>
        <button type="button" style={platzButton} data-testid={testId} data-touch-ok={SORT_HEAD_TOUCH_OK} data-sorted={active ? 'true' : 'false'} onClick={() => sort.onTap('platz')}>
          {visual}
          {active ? <Icons.ArrowUp size={iconSizeValues.xs} /> : null}
        </button>
      </div>
    );
  }
  const label = spec.term ? long(SHORT_TERMS[spec.term].long) : (spec.text ?? '');
  return <SortableHeader as="div" column={column} label={label} visual={spec.term ? visual : undefined} state={sort.state} onTap={sort.onTap} testId={testId} style={style} />;
}

export function SortHeadRow({ specs, sort, mobile, style, testId }: { specs: readonly HeadSpec[]; sort: ListSort | null; mobile: boolean; style: CSSProperties; testId?: string }) {
  return (
    <div role="row" style={style} data-testid={testId}>
      {specs.map((spec) => <Head key={`${spec.column}-${spec.text ?? spec.term ?? ''}`} spec={spec} sort={sort} mobile={mobile} />)}
    </div>
  );
}

export interface PickerColumn { column: SortedColumn; term?: TableHeadTerm; text?: string }

/** „Sortieren nach …“ (nur Handy) und „Nach Platzierung“ (nur wenn sortiert); beides im Druck ausgeblendet. */
export function SortBar({ sort, columns, mobile, scope }: { sort: ListSort; columns: readonly PickerColumn[]; mobile: boolean; scope: string }) {
  const { t } = useTranslation('tournament');
  const long = t as unknown as Translate;
  const name = ({ term, text }: PickerColumn): string => (term ? long(SHORT_TERMS[term].long) : (text ?? ''));
  const options: SortPickerOption[] = columns.flatMap((c) => [
    { value: { column: c.column, reversed: false }, label: name(c) },
    { value: { column: c.column, reversed: true }, label: long('tableSort.optionReversed', { label: name(c) }) },
  ]);
  return (
    <>
      {mobile && (
        <div className={`${scope} sort-picker-mobile`} style={{ marginBottom: cssVars.spacing.md }}>
          <SortPicker options={options} state={sort.state} onChange={sort.onChange} testId={`sort-picker-${sort.key}`} />
        </div>
      )}
      {sort.state !== null && (
        <div className={`${scope} sort-reset-bar`} style={{ marginBottom: cssVars.spacing.md }}>
          <SortReset visible onReset={sort.onReset} testId={`sort-reset-${sort.key}`} />
        </div>
      )}
      <style>{`@media print { .${scope}.sort-picker-mobile, .${scope}.sort-reset-bar { display: none !important; } }`}</style>
    </>
  );
}
