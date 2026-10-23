/**
 * Zahlknöpfe (A-18a, S-1, @HE-105): eine Reihe gleichwertiger Knöpfe mit je einer Zahl, ein Tipp wählt und löst aus. Fachfrei –
 * der Baustein weiß nicht, wofür die Zahl steht und welche richtig ist; er zeigt sie nur in der Reihenfolge, die der Aufrufer
 * liefert. Keine Haupttaste: Der Knopf selbst ist die Handlung (Mockup M4 `r4`). Jeder Knopf ist mindestens
 * `touchTargets.primary` hoch (56 px), die Zahl steht in 24 px fett; `legend` benennt die Gruppe, `aria-label` am Knopf
 * spricht „Zahl 47“.
 *
 * Hinweis A-17b: Dort liegt der Baustein `CheckNumberBadge` (nur Anzeige der Prüfzahl); dieser hier ist die Auswahl dazu.
 * Wenn beide auf main liegen, kann die Zahl in den Knöpfen den Badge in der Größe `regular` nutzen.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { Button } from '../Button';

export interface NumberChoiceRowProps {
  legend: string;
  /** Kleiner Hilfetext unter den Knöpfen. */
  hint?: string;
  values: readonly number[];
  onChoose: (value: number) => void;
  disabled?: boolean;
  /** Gesprochener Text je Knopf, z. B. `(n) => \`Zahl ${n}\``. */
  valueLabel: (value: number) => string;
  /** `data-testid` des Behälters; die Knöpfe heißen `<testId>-<Zahl>`. */
  testId?: string;
}

const fieldset: CSSProperties = { border: 0, margin: 0, padding: 0, minWidth: 0 };
const legendStyle: CSSProperties = { padding: 0, margin: `0 0 ${cssVars.spacing.sm}`, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, color: cssVars.colors.textPrimary };
const row: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))', gridAutoFlow: 'column', gap: cssVars.spacing.sm };
const buttonStyle: CSSProperties = { minHeight: cssVars.touchTargets.primary, fontSize: cssVars.fontSizes.xxl, fontWeight: cssVars.fontWeights.bold, fontVariantNumeric: 'tabular-nums', padding: `0 ${cssVars.spacing.xs}` };
const hintStyle: CSSProperties = { margin: `${cssVars.spacing.xs} 0 0`, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };

export const NumberChoiceRow = ({ legend, hint, values, onChoose, disabled = false, valueLabel, testId = 'number-choices' }: NumberChoiceRowProps) => (
  <fieldset style={fieldset} data-testid={testId}>
    <legend style={legendStyle}>{legend}</legend>
    <div style={row}>
      {values.map((value) => (
        <Button
          key={value}
          variant="secondary"
          size="lg"
          style={buttonStyle}
          disabled={disabled}
          aria-label={valueLabel(value)}
          data-testid={`${testId}-${value}`}
          onClick={() => onChoose(value)}
        >
          {value}
        </Button>
      ))}
    </div>
    {hint ? <p style={hintStyle}>{hint}</p> : null}
  </fieldset>
);
