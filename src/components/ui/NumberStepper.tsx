/**
 * NumberStepper - Mobile-freundliche Zahleneingabe
 *
 * Bietet drei Eingabemodi:
 * - Stepper: +/- Buttons (Standard für Mobile)
 * - Slider: Range-Slider für schnelle Auswahl
 * - Input: Direkteingabe mit Tastatur
 */

import { CSSProperties } from 'react';
import { cssVars, shadowSemantics } from '../../design-tokens'
import { Button } from './Button';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string;
  mode?: 'stepper' | 'slider' | 'input';
  disabled?: boolean;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  suffix,
  mode = 'stepper',
  disabled = false,
}) => {
  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    if (!isNaN(newValue)) {
      onChange(Math.max(min, Math.min(max, newValue)));
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    onChange(newValue);
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  };

  const controlsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const displayStyle: CSSProperties = {
    flex: 1,
    textAlign: 'center',
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    minWidth: '80px',
  };

  const inputStyle: CSSProperties = {
    ...displayStyle,
    fontFamily: 'inherit',
    outline: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'textfield',
  };

  const sliderContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  };

  const sliderStyle: CSSProperties = {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    outline: 'none',
    background: `linear-gradient(to right, ${cssVars.colors.primary} 0%, ${cssVars.colors.primary} ${((value - min) / (max - min)) * 100}%, ${cssVars.colors.surfaceLight} ${((value - min) / (max - min)) * 100}%, ${cssVars.colors.surfaceLight} 100%)`,
    WebkitAppearance: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };

  const sliderThumbStyle = `
    input[type='range']::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${cssVars.colors.primary};
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
      border: 3px solid ${cssVars.colors.background};
      box-shadow: ${shadowSemantics.control};
    }
    input[type='range']::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${cssVars.colors.primary};
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
      border: 3px solid ${cssVars.colors.background};
      box-shadow: ${shadowSemantics.control};
    }
  `;

  const rangeInfoStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
  };

  return (
    <div style={containerStyle}>
      {label && <label style={labelStyle}>{label}</label>}

      {mode === 'stepper' && (
        <div style={controlsStyle}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDecrement}
            disabled={disabled || value <= min}
            style={{ minWidth: '44px', height: '44px' }}
          >
            −
          </Button>
          <div style={displayStyle}>
            {value}{suffix && ` ${suffix}`}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleIncrement}
            disabled={disabled || value >= max}
            style={{ minWidth: '44px', height: '44px' }}
          >
            +
          </Button>
        </div>
      )}

      {mode === 'slider' && (
        <div style={sliderContainerStyle}>
          <style>{sliderThumbStyle}</style>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleSliderChange}
            disabled={disabled}
            style={sliderStyle}
          />
          <div style={rangeInfoStyle}>
            <span>{min}{suffix && ` ${suffix}`}</span>
            <span style={{ fontSize: cssVars.fontSizes.md, fontWeight: cssVars.fontWeights.semibold, color: cssVars.colors.textPrimary }}>
              {value}{suffix && ` ${suffix}`}
            </span>
            <span>{max}{suffix && ` ${suffix}`}</span>
          </div>
        </div>
      )}

      {mode === 'input' && (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          style={inputStyle}
        />
      )}
    </div>
  );
};
