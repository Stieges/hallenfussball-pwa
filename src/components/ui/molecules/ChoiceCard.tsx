/**
 * Wahlkarte (B-28 C8, Mockup PDF-Dialog): eine Karte aus einer Gruppe von Wahlmöglichkeiten, Titel, Beschreibung, Auswahlpunkt.
 * Fachfrei: kennt weder PDF noch Turnier. Ausgegraut (`disabled`) bleibt sie sichtbar und nennt den Grund (`reason`).
 * `role="radio"`; die umgebende Gruppe trägt `role="radiogroup"`. Mindesthöhe nach Touch-Token.
 */
import { useState, type CSSProperties, type FocusEvent, type ReactNode } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';

export interface ChoiceCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  selected: boolean;
  disabled?: boolean;
  /** Warum die Karte nicht wählbar ist; nur bei `disabled` sichtbar. */
  reason?: string;
  onSelect: () => void;
  'data-testid'?: string;
}

export const ChoiceCard = ({ title, description, icon, selected, disabled = false, reason, onSelect, 'data-testid': testId }: ChoiceCardProps) => {
  const [focusVisible, setFocusVisible] = useState(false);
  const active = selected && !disabled;
  const card: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `${cssVars.iconSizes.lg} minmax(0, 1fr) ${cssVars.spacing.lg}`,
    gap: cssVars.spacing.md,
    alignItems: 'start',
    width: '100%',
    minHeight: cssVars.touchTargets.primary,
    padding: cssVars.spacing.md,
    textAlign: 'left',
    border: `${cssVars.borderWidth.thin} ${disabled ? 'dashed' : 'solid'} ${active ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    background: active ? cssVars.colors.primaryLight : disabled ? cssVars.colors.surface : cssVars.colors.background,
    color: disabled ? cssVars.colors.textDisabled : cssVars.colors.textPrimary,
    font: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    // Auswahl: 1-px-Rahmen plus innerer Schatten in gleicher Stärke (kein eigenes Token), Fokus wie bei `Button`
    boxShadow: focusVisible ? `0 0 0 3px ${cssVars.colors.focusRing}` : active ? `inset 0 0 0 ${cssVars.borderWidth.thin} ${cssVars.colors.primary}` : 'none',
  };
  const iconBox: CSSProperties = {
    width: cssVars.iconSizes.lg,
    height: cssVars.iconSizes.lg,
    borderRadius: cssVars.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: active ? cssVars.colors.primary : cssVars.colors.surfaceVariant,
    color: active ? cssVars.colors.onPrimary : cssVars.colors.textSecondary,
  };
  const radio: CSSProperties = {
    width: cssVars.spacing.lg,
    height: cssVars.spacing.lg,
    borderRadius: cssVars.borderRadius.full,
    border: `${cssVars.borderWidth.thin} ${disabled ? 'dashed' : 'solid'} ${active ? cssVars.colors.primary : cssVars.colors.borderControl}`,
    background: active ? cssVars.colors.primary : 'transparent',
    color: cssVars.colors.onPrimary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const titleStyle: CSSProperties = { display: 'block', fontWeight: cssVars.fontWeights.bold, fontSize: cssVars.fontSizes.md, overflowWrap: 'break-word' };
  // gewählt: textSecondary auf primaryLight erreicht hell nur 4,08 : 1 (Messung nach B-43), daher textPrimary
  const descStyle: CSSProperties = { display: 'block', marginTop: cssVars.spacing.xs, fontSize: cssVars.fontSizes.sm, color: disabled ? cssVars.colors.textDisabled : active ? cssVars.colors.textPrimary : cssVars.colors.textSecondary };
  const reasonStyle: CSSProperties = { display: 'block', marginTop: cssVars.spacing.xs, fontSize: cssVars.fontSizes.sm, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textSecondary };

  return (
    <button
      type="button"
      role="radio" aria-checked={active} aria-disabled={disabled} data-testid={testId}
      style={card}
      onClick={() => !disabled && onSelect()}
      onFocus={(e: FocusEvent<HTMLButtonElement>) => setFocusVisible(e.target.matches(':focus-visible'))}
      onBlur={() => setFocusVisible(false)}
    >
      <span style={iconBox} aria-hidden="true">{icon}</span>
      <span>
        <span style={titleStyle}>{title}</span>
        <span style={descStyle}>{description}</span>
        {disabled && reason ? <span style={reasonStyle} data-testid={testId ? `${testId}-reason` : undefined}>{reason}</span> : null}
      </span>
      <span style={radio} aria-hidden="true">{active ? <Icons.Check size={iconSizeValues.xs} /> : null}</span>
    </button>
  );
};
