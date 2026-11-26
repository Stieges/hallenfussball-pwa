/**
 * Handy-Auswahl „Sortieren nach …“ (@TS-004): natives `<select>`, Schrift ≥ 16 px, mit „Nach Platzierung“ als erster Option.
 * Die Optionen (Spalte + Richtung) liefert die Tabelle.
 */
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { sortToken, type SortState } from '../../../core/standings/tableSort';

export interface SortPickerOption {
  value: SortState;
  label: string;
}

export interface SortPickerProps {
  options: readonly SortPickerOption[];
  state: SortState;
  onChange: (state: SortState) => void;
  testId?: string;
}

const PLATZ = 'platz';
const toValue = (state: SortState): string => (state ? sortToken(state) : PLATZ);

export function SortPicker({ options, state, onChange, testId = 'sort-picker' }: SortPickerProps) {
  const { t } = useTranslation('tournament');
  const id = useId();
  const all: readonly SortPickerOption[] = options.some((o) => o.value === null)
    ? options
    : [{ value: null, label: t('tableSort.reset') }, ...options];
  return (
    <div style={{ display: 'grid', gap: cssVars.spacing.xs }}>
      <label htmlFor={id} style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textSecondary }}>
        {t('tableSort.pickerLabel')}
      </label>
      <select
        id={id}
        data-testid={testId}
        value={toValue(state)}
        onChange={(e) => onChange(all.find((o) => toValue(o.value) === e.target.value)?.value ?? null)}
        style={{
          minHeight: cssVars.touchTargets.minimum,
          padding: `0 ${cssVars.spacing.sm}`,
          fontSize: cssVars.fontSizes.lg,
          color: cssVars.colors.textPrimary,
          background: cssVars.colors.surface,
          border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
          borderRadius: cssVars.borderRadius.md,
        }}
      >
        {all.map((o) => (
          <option key={toValue(o.value)} value={toValue(o.value)}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
