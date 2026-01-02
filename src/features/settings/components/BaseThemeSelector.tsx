/**
 * BaseThemeSelector - Auswahl für Base-Theme (Leuchtdichte)
 *
 * Radio-Buttons für:
 * - System (automatisch)
 * - Hell
 * - Dunkel
 * - Hoher Kontrast
 *
 * @see docs/concepts/SETTINGS-KONZEPT.md
 */

import React, { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { BaseTheme, BASE_THEME_LABELS } from '../types/settings.types';

// =============================================================================
// Types
// =============================================================================

interface BaseThemeSelectorProps {
  /** Aktuell ausgewähltes Theme */
  value: BaseTheme;
  /** Callback bei Änderung */
  onChange: (theme: BaseTheme) => void;
  /** Optional: Zeigt das aufgelöste Theme (für 'system') */
  resolvedTheme?: 'light' | 'dark' | 'high-contrast';
}

// =============================================================================
// Component
// =============================================================================

export const BaseThemeSelector: React.FC<BaseThemeSelectorProps> = ({
  value,
  onChange,
  resolvedTheme,
}) => {
  const themes: BaseTheme[] = ['system', 'light', 'dark', 'high-contrast'];

  return (
    <div style={styles.container} role="radiogroup" aria-label="Theme auswählen">
      {themes.map((theme) => {
        const { label, description, icon } = BASE_THEME_LABELS[theme];
        const isSelected = value === theme;
        const isSystem = theme === 'system';

        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(theme)}
            style={{
              ...styles.option,
              ...(isSelected ? styles.optionSelected : {}),
            }}
          >
            <span style={styles.icon}>{icon}</span>
            <div style={styles.textContainer}>
              <span style={styles.label}>{label}</span>
              <span style={styles.description}>
                {description}
                {isSystem && resolvedTheme && (
                  <span style={styles.resolvedHint}>
                    {' '}
                    (aktuell: {resolvedTheme === 'dark' ? 'Dunkel' : 'Hell'})
                  </span>
                )}
              </span>
            </div>
            <span style={styles.radioOuter}>
              {isSelected && <span style={styles.radioInner} />}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    background: 'transparent',
    border: `1px solid transparent`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.2s ease, border-color 0.2s ease',
    minHeight: '56px',
    width: '100%',
  },
  optionSelected: {
    background: cssVars.colors.primaryLight,
    borderColor: cssVars.colors.primaryBorder,
  },
  icon: {
    fontSize: cssVars.fontSizes.xl,
    flexShrink: 0,
    width: '32px',
    textAlign: 'center',
  },
  textContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  },
  description: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  resolvedHint: {
    color: cssVars.colors.textTertiary,
    fontStyle: 'italic',
  },
  radioOuter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: cssVars.borderRadius.full,
    border: `2px solid ${cssVars.colors.border}`,
    flexShrink: 0,
  },
  radioInner: {
    width: '10px',
    height: '10px',
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.primary,
  },
};

export default BaseThemeSelector;
