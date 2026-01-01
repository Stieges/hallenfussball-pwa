import React, { CSSProperties } from 'react';
import { cssVars, fontFamilies } from '../../design-tokens'
interface InputProps {
  label?: string;
  type?: 'text' | 'number' | 'email' | 'tel' | 'date' | 'time';
  value: string | number;
  onChange?: (value: string) => void;
  placeholder?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  disabled?: boolean;
  required?: boolean;
  list?: string;
  style?: CSSProperties;
  /** Zeigt einen Fehlerzustand an (roter Rahmen) */
  error?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  disabled = false,
  required = false,
  list,
  style = {},
  error = false,
}) => {
  const containerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    width: '100%',
    ...style,
  };

  const labelStyles: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
  };

  const inputStyles: CSSProperties = {
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${error ? cssVars.colors.error : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
    fontFamily: fontFamilies.body,
    outline: 'none',
    transition: 'border-color 0.2s ease',
    width: '100%',
  };

  return (
    <div style={containerStyles}>
      {label && (
        <label style={labelStyles}>
          {label}
          {required && <span style={{ color: cssVars.colors.error }}> *</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        required={required}
        list={list}
        style={inputStyles}
        onFocus={(e) => {
          if (!error) {
            e.target.style.borderColor = cssVars.colors.primary;
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = error ? cssVars.colors.error : cssVars.colors.border;
        }}
      />
    </div>
  );
};
