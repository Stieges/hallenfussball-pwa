/**
 * PasswordInput - Input with visibility toggle
 *
 * Wraps a standard input element with a button to toggle
 * between showing and hiding the password text.
 *
 * Features:
 * - Toggle button with 44px touch target
 * - Accessible labels for toggle state
 * - Uses design tokens for consistent styling
 */

import React, { useState } from 'react';
import { cssVars } from '../../design-tokens';

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

interface PasswordInputProps extends InputProps {
  /** Container style (applied to the wrapper div) */
  containerStyle?: React.CSSProperties;
}

const styles = {
  container: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  toggleButton: {
    position: 'absolute' as const,
    right: '4px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    minWidth: '44px',
    minHeight: '44px',
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.md,
    cursor: 'pointer',
    padding: 0,
  },
};

export const PasswordInput: React.FC<PasswordInputProps> = ({
  containerStyle,
  style,
  ...inputProps
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={{ ...styles.container, ...containerStyle }}>
      <input
        {...inputProps}
        type={showPassword ? 'text' : 'password'}
        style={{
          ...style,
          paddingRight: '52px', // Space for toggle button
        }}
      />
      <button
        type="button"
        onClick={() => setShowPassword((prev) => !prev)}
        style={styles.toggleButton}
        aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
        tabIndex={-1}
      >
        {showPassword ? '◉' : '○'}
      </button>
    </div>
  );
};
