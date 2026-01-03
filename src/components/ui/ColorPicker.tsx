import React, { useState, useRef, useEffect, CSSProperties } from 'react';
import { HexColorPicker } from 'react-colorful';
import { cssVars } from '../../design-tokens';

/**
 * Default jersey color presets (common team colors)
 */
const JERSEY_COLOR_PRESETS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#DC0000', // Red
  '#0033CC', // Blue
  '#009933', // Green
  '#FFCC00', // Yellow
  '#FF6600', // Orange
  '#660099', // Purple
  '#FF66B2', // Pink
  '#009999', // Teal
  '#666666', // Gray
  '#663300', // Brown
];

interface ColorPickerProps {
  /** Label text */
  label?: string;
  /** Current color value (hex) */
  value: string;
  /** Called when color changes */
  onChange: (color: string) => void;
  /** Preset colors to show */
  presets?: string[];
  /** Disable the picker */
  disabled?: boolean;
  /** Show custom color picker */
  showCustomPicker?: boolean;
  /** Additional styles */
  style?: CSSProperties;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value,
  onChange,
  presets = JERSEY_COLOR_PRESETS,
  disabled = false,
  showCustomPicker = true,
  style = {},
  'data-testid': testId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handlePresetClick = (color: string) => {
    onChange(color);
    setIsOpen(false);
  };

  const containerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    position: 'relative',
    ...style,
  };

  const labelStyles: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
  };

  const triggerStyles: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.sm,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'border-color 0.2s ease',
  };

  const swatchStyles: CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: cssVars.borderRadius.sm,
    backgroundColor: value,
    border: `1px solid ${cssVars.colors.border}`,
    flexShrink: 0,
  };

  const valueTextStyles: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    fontFamily: cssVars.fontFamilies.mono,
    textTransform: 'uppercase',
  };

  const dropdownStyles: CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: cssVars.spacing.xs,
    padding: cssVars.spacing.md,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    boxShadow: `0 4px 12px ${cssVars.colors.shadowMedium}`,
    zIndex: 100,
    minWidth: 200,
  };

  const presetsGridStyles: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: cssVars.spacing.xs,
    marginBottom: showCustomPicker ? cssVars.spacing.md : 0,
  };

  const presetSwatchStyles = (color: string, isSelected: boolean): CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: cssVars.borderRadius.sm,
    backgroundColor: color,
    border: isSelected
      ? `2px solid ${cssVars.colors.primary}`
      : `1px solid ${cssVars.colors.border}`,
    cursor: 'pointer',
    transition: 'transform 0.1s ease, border-color 0.1s ease',
    boxShadow: color === '#FFFFFF' ? `inset 0 0 0 1px ${cssVars.colors.border}` : 'none',
  });

  const dividerStyles: CSSProperties = {
    height: 1,
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.sm} 0`,
  };

  const customPickerLabelStyles: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.sm,
  };

  return (
    <div ref={containerRef} style={containerStyles} data-testid={testId}>
      {label && <span style={labelStyles}>{label}</span>}

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={triggerStyles}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div style={swatchStyles} aria-hidden="true" />
        <span style={valueTextStyles}>{value}</span>
        <span style={{ marginLeft: 'auto', color: cssVars.colors.textSecondary }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div style={dropdownStyles} role="dialog" aria-label="Farbauswahl">
          {/* Preset colors */}
          <div style={presetsGridStyles} role="listbox" aria-label="Voreingestellte Farben">
            {presets.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handlePresetClick(color)}
                style={presetSwatchStyles(color, color.toUpperCase() === value.toUpperCase())}
                aria-label={`Farbe ${color}`}
                aria-selected={color.toUpperCase() === value.toUpperCase()}
                role="option"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              />
            ))}
          </div>

          {/* Custom color picker */}
          {showCustomPicker && (
            <>
              <div style={dividerStyles} />
              <div style={customPickerLabelStyles}>Eigene Farbe</div>
              <HexColorPicker
                color={value}
                onChange={onChange}
                style={{ width: '100%' }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
