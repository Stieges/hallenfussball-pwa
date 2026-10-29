/**
 * Knopf „Farbe & Logo“ einer Team-Zeile (@W3-039): beschrifteter Auf-/Zuklapper statt eines nackten Pfeils, mit Farbpunkt
 * der gewählten Trikotfarbe. Fachfrei: kennt nur Beschriftung, Farbe und Zustand. Der Punkt ist ein reiner Zusatz (Farbe
 * trägt keine Bedeutung allein, die Beschriftung bleibt); ohne Farbe steht kein Punkt. Tippfläche mindestens `touchTargets.minimum`.
 */
import type { CSSProperties } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export interface TeamDetailsToggleProps {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  /** Gewählte Hauptfarbe des Teams (CSS-Farbwert); ohne Angabe kein Farbpunkt. */
  color?: string;
  /** Gesprochener Name der Farbe des Punktes, z. B. „Farbe gewählt“. */
  colorLabel?: string;
  'data-testid'?: string;
}

const button: CSSProperties = {
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  minHeight: cssVars.touchTargets.minimum,
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  background: cssVars.colors.surface,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
  color: cssVars.colors.textPrimary,
  fontSize: cssVars.fontSizes.md,
  fontWeight: cssVars.fontWeights.semibold,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const dotStyle = (color: string): CSSProperties => ({
  flex: 'none',
  width: cssVars.spacing.md,
  height: cssVars.spacing.md,
  borderRadius: cssVars.borderRadius.full,
  backgroundColor: color,
  border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.borderControl}`,
});

export const TeamDetailsToggle = ({ label, expanded, onToggle, color, colorLabel, 'data-testid': testId }: TeamDetailsToggleProps) => (
  <button type="button" onClick={onToggle} style={button} aria-expanded={expanded} data-testid={testId}>
    {color !== undefined && <span style={dotStyle(color)} role="img" aria-label={colorLabel} data-testid={testId === undefined ? undefined : `${testId}-dot`} />}
    <span>{label}</span>
    {expanded ? <Icons.ChevronUp size={iconSizeValues.sm} /> : <Icons.ChevronDown size={iconSizeValues.sm} />}
  </button>
);
