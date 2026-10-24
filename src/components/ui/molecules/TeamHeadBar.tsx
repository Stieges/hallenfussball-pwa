/**
 * TeamHeadBar – Kopf einer Team-Spalte im Cockpit in der Farbe des Ergebniskastens (@SL-176): Name und „Heim“/„Gast“ auf der
 * getragenen Farbe (Weste bei Leibchen, Leibchen-Zeichen davor). Schriftfarbe Schwarz oder Weiß mit mehr Kontrast (≥ 4,5 : 1).
 * Reine Anzeige: Fläche und Farben kommen aus derselben Rechnung wie die Kästen und der Hallenmonitor (`resolveBoxColors`).
 * Der Name wird nie gekürzt und nie getrennt (VISUAL-DESIGN § 1/§ 2): er bricht um.
 */
import type { CSSProperties, ReactElement } from 'react';
import type { BoxFill } from '../../../core/models/scoreBoxColors';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { MatchIcons } from '../IconsMatch';
import { fillSurface, fillTextColor } from './scoreBoxStyle';

export interface TeamHeadBarProps {
  name: string;
  /** „Heim“ oder „Gast“ */
  label: string;
  fill: BoxFill;
  /** Leibchen-Zeichen vor dem Namen, mit zugänglichem Namen */
  bib?: { ariaLabel: string } | null;
  /** Größere Schrift ab 1024 px */
  breit?: boolean;
  testId: string;
  nameTestId: string;
  stripeTestId?: string;
}

export function TeamHeadBar({ name, label, fill, bib = null, breit = false, testId, nameTestId }: TeamHeadBarProps): ReactElement {
  const text = fillTextColor(fill);
  const kopf: CSSProperties = {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: cssVars.spacing.sm, boxSizing: 'border-box', minWidth: 0,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`, borderRadius: cssVars.borderRadius.md,
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderSolid}`, color: text, hyphens: 'manual',
    ...fillSurface(fill),
  };
  const nameStil: CSSProperties = {
    margin: 0, flex: '1 1 0', minWidth: 0, hyphens: 'manual', overflowWrap: 'anywhere', lineHeight: cssVars.lineHeights.bodyMd,
    fontSize: breit ? cssVars.fontSizes.titleMd : `clamp(${cssVars.fontSizes.md}, 4vw, ${cssVars.fontSizes.lg})`, fontWeight: cssVars.fontWeights.bold,
    display: 'flex', alignItems: 'flex-start', gap: cssVars.spacing.xs,
  };
  const seite: CSSProperties = { flex: 'none', fontSize: cssVars.fontSizes.labelSm, fontWeight: cssVars.fontWeights.bold, textTransform: 'uppercase', lineHeight: cssVars.lineHeights.bodyMd };
  return (
    <div style={kopf} data-testid={testId} data-fill={fill.kind} data-color={fill.kind === 'vest' ? fill.center : fill.color}>
      <p data-teamname="" data-testid={nameTestId} style={nameStil}>
        {bib && (
          <span role="img" aria-label={bib.ariaLabel} data-testid={`${testId}-leibchen`} style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', minHeight: cssVars.lineHeights.bodyMd }}>
            <MatchIcons.Shirt size={iconSizeValues.xs} />
          </span>
        )}
        <span style={{ minWidth: 0 }}>{name}</span>
      </p>
      <span style={seite}>{label}</span>
    </div>
  );
}
