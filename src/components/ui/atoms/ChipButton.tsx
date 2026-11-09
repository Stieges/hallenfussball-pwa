/**
 * ChipButton – ein einzelner wählbarer Chip (Baustein für `ChipChoice`, die Gruppen-Auswahl und das Filter-Blatt der Zuschauer-Seite).
 * Reine Anzeige mit `aria-pressed`; die Wahl steht nie nur in der Farbe: `look="tint"` trägt ein Häkchen vor dem Wort, `look="fill"`
 * Fettschrift und gefüllten Grund. Mindesthöhe und -breite aus `touchTargets` (@OB-022). Die Vorgaben entsprechen dem bisherigen Chip der
 * `ChipChoice`-Reihe; die Zuschauer-Seite stellt Rundung, Größe und Abstand über Eigenschaften ein, statt den Stil zu kopieren.
 */
import type { CSSProperties, ReactNode, Ref } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export interface ChipButtonProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  /** `tint`: gewählt getönt, Häkchen davor · `fill`: gewählt in der Hauptfarbe gefüllt, ohne Häkchen */
  look?: 'tint' | 'fill';
  radius?: 'md' | 'full';
  /** Mindesthöhe und -breite: `minimum` (44) oder `comfortable` (48) */
  size?: 'minimum' | 'comfortable';
  padX?: 'sm' | 'md';
  fontSize?: 'sm' | 'md';
  /** Rahmenbreite des gewählten Chips (ungewählt immer dünn) */
  borderSelected?: 'thin' | 'medium';
  /** Schriftstärke des ungewählten Chips (gewählt immer fett) */
  idleWeight?: 'normal' | 'medium';
  ref?: Ref<HTMLButtonElement>;
  'aria-label'?: string;
  'data-testid'?: string;
  /** Begründung für die visuelle Prüfung (Ausnahme „Überlappung“), nur wo ein Chip bewusst abgeschnitten wird */
  'data-overlap-ok'?: string;
}

function style(p: Required<Pick<ChipButtonProps, 'selected' | 'look' | 'radius' | 'size' | 'padX' | 'fontSize' | 'borderSelected' | 'idleWeight'>>): CSSProperties {
  const fill = p.look === 'fill';
  return {
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: cssVars.spacing.xs,
    minHeight: cssVars.touchTargets[p.size],
    minWidth: cssVars.touchTargets[p.size],
    padding: `0 ${cssVars.spacing[p.padX]}`,
    border: `${p.selected ? cssVars.borderWidth[p.borderSelected] : cssVars.borderWidth.thin} solid ${p.selected ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    borderRadius: p.radius === 'full' ? cssVars.borderRadius.full : cssVars.borderRadius.md,
    background: p.selected ? (fill ? cssVars.colors.primary : cssVars.colors.primaryLight) : cssVars.colors.background,
    color: p.selected && fill ? cssVars.colors.background : cssVars.colors.textPrimary,
    fontFamily: 'inherit',
    fontSize: cssVars.fontSizes[p.fontSize],
    fontWeight: p.selected ? cssVars.fontWeights.bold : cssVars.fontWeights[p.idleWeight],
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  };
}

export function ChipButton({
  selected, onClick, children, look = 'tint', radius = 'md', size = 'comfortable', padX = 'md', fontSize = 'md', borderSelected = 'thin', idleWeight = 'medium', ref, ...rest
}: ChipButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={selected}
      aria-label={rest['aria-label']}
      data-testid={rest['data-testid']}
      data-overlap-ok={rest['data-overlap-ok']}
      style={style({ selected, look, radius, size, padX, fontSize, borderSelected, idleWeight })}
      onClick={onClick}
    >
      {look === 'tint' && selected ? <Icons.Check size={iconSizeValues.sm} color={cssVars.colors.primary} /> : null}
      {children}
    </button>
  );
}
