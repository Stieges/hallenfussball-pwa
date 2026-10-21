/**
 * Zwei Zahlenfelder für das Ergebnis eines Strafstoßschießens (Paket TB-B, TB-6c; Mockup v3). Fachfrei: Namen, Beschriftungen
 * und die Fehlermeldung kommen vom Aufrufer. Zahlenfeld: Breite `touchTargets.primary + spacing.lg` (T2, kein neues Token),
 * Schrift `fontSizes.xxl` (≥ 16 px), Höhe `touchTargets.primary`. Die Meldung steht am Feld (Symbol, Wort und Rand, nie nur
 * Farbe) und ist per `aria-describedby` verbunden.
 */
import { useId, type CSSProperties, type ChangeEvent } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export interface ShootoutScoreSide {
  id: string;
  name: string;
}

export interface ShootoutScoreInputProps {
  legend: string;
  /** Kleine Zeile unter dem Namen („Treffer“). */
  hitsLabel: string;
  sides: readonly [ShootoutScoreSide, ShootoutScoreSide];
  values: readonly [string, string];
  onChange: (index: 0 | 1, value: string) => void;
  /** Meldung am Feld; gesetzt = beide Felder rot umrandet. */
  error?: string;
  /** Hinweis, solange kein Fehler da ist. */
  hint?: string;
}

const FIELD_WIDTH = `calc(${cssVars.touchTargets.primary} + ${cssVars.spacing.lg})`;

export const ShootoutScoreInput = ({ legend, hitsLabel, sides, values, onChange, error, hint }: ShootoutScoreInputProps) => {
  const uid = useId();
  const errorId = `${uid}-error`;
  const hintId = `${uid}-hint`;
  const row: CSSProperties = { display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${FIELD_WIDTH}`, gap: cssVars.spacing.md, alignItems: 'center' };
  const label: CSSProperties = { minWidth: 0, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.lg, lineHeight: cssVars.lineHeights.bodyLg, overflowWrap: 'break-word' };
  const small: CSSProperties = { display: 'block', color: cssVars.colors.textSecondary, fontWeight: cssVars.fontWeights.normal, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm };
  const field: CSSProperties = {
    width: FIELD_WIDTH,
    minHeight: cssVars.touchTargets.primary,
    boxSizing: 'border-box',
    textAlign: 'center',
    font: 'inherit',
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    fontVariantNumeric: 'tabular-nums',
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.background,
    border: error === undefined ? `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}` : `${cssVars.borderWidth.medium} solid ${cssVars.colors.error}`,
    borderRadius: cssVars.borderRadius.md,
  };
  const message: CSSProperties = { display: 'flex', gap: cssVars.spacing.sm, alignItems: 'flex-start', margin: `${cssVars.spacing.sm} 0 0`, color: cssVars.colors.textPrimary, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd };
  const handle = (index: 0 | 1) => (e: ChangeEvent<HTMLInputElement>) => onChange(index, e.target.value.replace(/\D/g, '').slice(0, 3));
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }} data-testid="tie-shootout-score">
      <legend style={{ padding: 0, marginBottom: cssVars.spacing.sm, fontWeight: cssVars.fontWeights.semibold, fontSize: cssVars.fontSizes.md }}>{legend}</legend>
      <div style={{ display: 'grid', gap: cssVars.spacing.sm }}>
        {sides.map((side, index) => {
          const inputId = `${uid}-${String(index)}`;
          return (
            <div key={side.id} style={row}>
              <label htmlFor={inputId} style={label}>
                <span data-teamname>{side.name}</span>
                <small style={small}>{hitsLabel}</small>
              </label>
              <input
                id={inputId}
                data-testid={`tie-shootout-score-${String(index)}`}
                style={field}
                inputMode="numeric"
                autoComplete="off"
                value={values[index]}
                onChange={handle(index as 0 | 1)}
                aria-invalid={error !== undefined}
                aria-describedby={error !== undefined ? errorId : hint !== undefined ? hintId : undefined}
              />
            </div>
          );
        })}
      </div>
      {error !== undefined ? (
        <p id={errorId} role="alert" style={message} data-testid="tie-shootout-error">
          <span style={{ display: 'flex', color: cssVars.colors.error, flex: 'none' }} aria-hidden="true"><Icons.AlertTriangle size={iconSizeValues.sm} /></span>
          <span>{error}</span>
        </p>
      ) : hint !== undefined ? (
        <p id={hintId} style={{ margin: `${cssVars.spacing.xs} 0 0`, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodySm }}>{hint}</p>
      ) : null}
    </fieldset>
  );
};
