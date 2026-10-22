/**
 * Auswahl aus wenigen Möglichkeiten in einer Reihe (A-18a, Mockup M4 `seg big`, z. B. „Feld 1 · Feld 2 · Ohne Feld“).
 * Fachfrei. Genau eine Möglichkeit ist gewählt (`role="radiogroup"`, je Knopf `role="radio"` mit `aria-checked`); die
 * Wahl steht nie nur in der Farbe: der gewählte Knopf trägt zusätzlich ein Häkchen. Jeder Knopf mindestens
 * `touchTargets.primary` hoch; bei wenig Platz umbricht die Reihe auf die nächste Zeile (Beschriftungen werden nie gekürzt).
 */
import type { CSSProperties } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedChoiceProps<T extends string> {
  legend: string;
  hint?: string;
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** `data-testid` des Behälters; die Knöpfe heißen `<testId>-<value>`. */
  testId?: string;
}

const fieldset: CSSProperties = { border: 0, margin: 0, padding: 0, minWidth: 0 };
const legendStyle: CSSProperties = { padding: 0, margin: `0 0 ${cssVars.spacing.sm}`, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, color: cssVars.colors.textPrimary };
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: cssVars.spacing.sm };
const hintStyle: CSSProperties = { margin: `${cssVars.spacing.xs} 0 0`, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };

function optionStyle(selected: boolean, disabled: boolean): CSSProperties {
  return {
    flex: '1 1 auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    minHeight: cssVars.touchTargets.primary,
    padding: `0 ${cssVars.spacing.md}`,
    border: `${cssVars.borderWidth.thin} solid ${selected ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    backgroundColor: selected ? cssVars.colors.primaryLight : cssVars.colors.background,
    color: disabled ? cssVars.colors.textDisabled : cssVars.colors.textPrimary,
    fontFamily: 'inherit',
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxShadow: selected ? `inset 0 0 0 ${cssVars.borderWidth.thin} ${cssVars.colors.primary}` : 'none',
  };
}

export function SegmentedChoice<T extends string>({ legend, hint, options, value, onChange, disabled = false, testId = 'segmented-choice' }: SegmentedChoiceProps<T>) {
  return (
    <fieldset style={fieldset} data-testid={testId}>
      <legend style={legendStyle}>{legend}</legend>
      <div role="radiogroup" aria-label={legend} style={row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              style={optionStyle(selected, disabled)}
              data-testid={`${testId}-${option.value}`}
              onClick={() => onChange(option.value)}
            >
              {selected ? <Icons.Check size={iconSizeValues.sm} aria-hidden="true" /> : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? <p style={hintStyle}>{hint}</p> : null}
    </fieldset>
  );
}
