/**
 * FontSizeSelector - Auswahl für Schriftgröße
 *
 * Radio-Buttons für:
 * - Klein (0.875x)
 * - Normal (1x)
 * - Groß (1.125x)
 * - Sehr groß (1.25x)
 *
 * @see docs/concepts/SETTINGS-KONZEPT.md
 */

import React, { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { FontSize, FONT_SIZE_LABELS } from '../types/settings.types';

// =============================================================================
// Types
// =============================================================================

interface FontSizeSelectorProps {
  /** Aktuell ausgewählte Größe */
  value: FontSize;
  /** Callback bei Änderung */
  onChange: (size: FontSize) => void;
}

// =============================================================================
// Component
// =============================================================================

export const FontSizeSelector: React.FC<FontSizeSelectorProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation('settings');
  const sizes: FontSize[] = ['small', 'normal', 'large', 'x-large'];

  // Preview text sizes match actual html font-size values
  const previewSizes: Record<FontSize, string> = {
    small: '14px',
    normal: '16px',
    large: '18px',
    'x-large': '20px',
  };

  return (
    <div style={styles.container} role="radiogroup" aria-label={t('fontSize.selectLabel')}>
      {sizes.map((size) => {
        const label = FONT_SIZE_LABELS[size];
        const isSelected = value === size;

        return (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(size)}
            style={{
              ...styles.option,
              ...(isSelected ? styles.optionSelected : {}),
            }}
          >
            <span
              style={{
                ...styles.preview,
                fontSize: previewSizes[size],
              }}
            >
              Aa
            </span>
            <span style={styles.label}>{label}</span>
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
    minHeight: '48px',
    width: '100%',
  },
  optionSelected: {
    background: cssVars.colors.primaryLight,
    borderColor: cssVars.colors.primaryBorder,
  },
  preview: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '32px',
    background: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
    flexShrink: 0,
  },
  label: {
    flex: 1,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
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

export default FontSizeSelector;
