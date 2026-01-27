import React, { CSSProperties, useId } from 'react';
import { cssVars } from '../../design-tokens'
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
  /** Fehlermeldung - wird unter dem Input angezeigt und setzt automatisch error=true */
  errorMessage?: string;
  /** Test ID for E2E testing */
  'data-testid'?: string;
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
  errorMessage,
  'data-testid': testId,
}) => {
  // Auto-set error state when errorMessage is provided
  const hasError = error || !!errorMessage;
  // Stable unique ID for aria-describedby (React 18+)
  const generatedId = useId();
  const errorId = errorMessage ? `error-${testId ?? generatedId}` : undefined;
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
    border: `1px solid ${hasError ? cssVars.colors.error : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    // Minimum 16px (fontSizes.lg) required to prevent iOS auto-zoom on focus
    fontSize: cssVars.fontSizes.lg,
    fontFamily: cssVars.fontFamilies.body,
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    width: '100%',
  };

  const errorMessageStyles: CSSProperties = {
    color: cssVars.colors.error,
    fontSize: cssVars.fontSizes.sm,
    marginTop: cssVars.spacing.xs,
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
        data-testid={testId}
        aria-invalid={hasError || undefined}
        aria-describedby={errorId}
        onFocus={(e) => {
          e.target.style.borderColor = hasError ? cssVars.colors.error : cssVars.colors.primary;
          e.target.style.boxShadow = `0 0 0 3px ${hasError ? cssVars.colors.errorGlow : cssVars.colors.focusRing}`;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = hasError ? cssVars.colors.error : cssVars.colors.border;
          e.target.style.boxShadow = 'none';
        }}
      />
      {errorMessage && (
        <span id={errorId} role="alert" style={errorMessageStyles}>
          {errorMessage}
        </span>
      )}
    </div>
  );
};
