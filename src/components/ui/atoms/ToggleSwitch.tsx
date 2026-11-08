/**
 * ToggleSwitch: der Ein/Aus-Schalter der Spielregel-Einstellungen (Match Cockpit). Tippfläche mindestens 44 hoch (@OB-022),
 * die sichtbare Spur bleibt 52 x 28. Aus dem Einstellungs-Panel herausgezogen, damit Panel und Regelabschnitte
 * (z. B. Foul-Grenze, @SL-101) denselben Baustein nutzen.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';

const TOGGLE_WIDTH = 52;
const TOGGLE_HEIGHT = 28;
const TOGGLE_THUMB_SIZE = 24;
const TOGGLE_THUMB_SPACING = 2;
const TOGGLE_THUMB_ON_POSITION = TOGGLE_WIDTH - TOGGLE_THUMB_SIZE - TOGGLE_THUMB_SPACING;

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** Name für Hilfsmittel (Schalter ohne sichtbaren Text) */
  label?: string;
  'data-testid'?: string;
}

export function ToggleSwitch({ checked, onChange, disabled, label, 'data-testid': testId }: ToggleSwitchProps): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={() => !disabled && onChange(!checked)}
      style={{ ...styles.toggle, ...(disabled ? styles.toggleDisabled : {}) }}
      disabled={disabled}
    >
      <span style={{ ...styles.toggleTrack, ...(checked ? styles.toggleOn : styles.toggleOff) }}>
        <span style={{ ...styles.toggleThumb, ...(checked ? styles.toggleThumbOn : styles.toggleThumbOff) }} />
      </span>
    </button>
  );
}

const styles: Record<string, CSSProperties> = {
  toggle: {
    display: 'flex',
    alignItems: 'center',
    width: `${TOGGLE_WIDTH}px`,
    height: cssVars.touchTargets.minimum,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  toggleTrack: {
    position: 'relative',
    width: `${TOGGLE_WIDTH}px`,
    height: `${TOGGLE_HEIGHT}px`,
    borderRadius: cssVars.borderRadius.full,
    transition: 'background-color 0.2s ease',
  },
  toggleOff: { background: cssVars.colors.surfaceLight },
  toggleOn: { background: cssVars.colors.primary },
  toggleDisabled: { cursor: 'not-allowed', opacity: 0.5 },
  toggleThumb: {
    position: 'absolute',
    top: `${TOGGLE_THUMB_SPACING}px`,
    width: `${TOGGLE_THUMB_SIZE}px`,
    height: `${TOGGLE_THUMB_SIZE}px`,
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.textPrimary,
    transition: 'left 0.2s ease',
    boxShadow: cssVars.shadows.sm,
  },
  toggleThumbOff: { left: `${TOGGLE_THUMB_SPACING}px` },
  toggleThumbOn: { left: `${TOGGLE_THUMB_ON_POSITION}px` },
};
