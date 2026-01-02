import React, { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens'
interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string | number;
  onChange?: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  required?: boolean;
  style?: CSSProperties;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  style = {},
  'data-testid': testId,
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

  const selectStyles: CSSProperties = {
    height: cssVars.touchTargets.minimum,
    padding: `0 ${cssVars.spacing.xl} 0 ${cssVars.spacing.md}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
    fontFamily: cssVars.fontFamilies.body,
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color 0.2s ease',
    width: '100%',
    // Fix: Prevent all options from rendering at once
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: cssVars.touchTargets.minimum,
  };

  return (
    <div style={containerStyles}>
      {label && (
        <label style={labelStyles}>
          {label}
          {required && <span style={{ color: cssVars.colors.error }}> *</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        required={required}
        style={selectStyles}
        data-testid={testId}
        onFocus={(e) => {
          e.target.style.borderColor = cssVars.colors.primary;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = cssVars.colors.border;
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
