import type { HeadSpec, PickerColumn } from './FinalSortParts';

/** Optionen von „Sortieren nach …“ aus denselben Köpfen wie die Kopfzeile (@TS-012): nur sortierbare Spalten, „Platz“ ist „Nach Platzierung“. */
export function pickerColumnsOf(specs: readonly HeadSpec[]): PickerColumn[] {
  return specs.flatMap((spec) => (spec.column === 'platz' || spec.column === 'plain' ? [] : [{ column: spec.column, term: spec.term, text: spec.text }]));
}
