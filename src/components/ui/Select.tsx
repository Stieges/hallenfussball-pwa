import React, { CSSProperties } from 'react';
import { cssVars, fontFamilies } from '../../design-tokens'
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
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  disabled = false,
  required = false,
  style = {},
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
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
    fontFamily: fontFamilies.body,
    outline: 'none',
    cursor: 'pointer',
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
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        required={required}
        style={selectStyles}
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
