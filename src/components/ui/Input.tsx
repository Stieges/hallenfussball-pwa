import React, { CSSProperties } from 'react';
import { theme } from '../../styles/theme';

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
}) => {
  const containerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    width: '100%',
  };

  const labelStyles: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.text.secondary,
  };

  const inputStyles: CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    background: 'rgba(0,0,0,0.3)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.text.primary,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.body,
    outline: 'none',
    transition: 'border-color 0.2s ease',
    width: '100%',
    ...style,
  };

  return (
    <div style={containerStyles}>
      {label && (
        <label style={labelStyles}>
          {label}
          {required && <span style={{ color: theme.colors.error }}> *</span>}
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
          e.target.style.borderColor = theme.colors.primary;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = theme.colors.border;
        }}
      />
    </div>
  );
};
