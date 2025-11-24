import React, { CSSProperties } from 'react';
import { theme } from '../../styles/theme';

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
    gap: theme.spacing.sm,
    width: '100%',
  };

  const labelStyles: CSSProperties = {
    fontSize: theme.fontSizes.sm,
    fontWeight: theme.fontWeights.medium,
    color: theme.colors.text.secondary,
  };

  const selectStyles: CSSProperties = {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    background: 'rgba(0,0,0,0.3)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.text.primary,
    fontSize: theme.fontSizes.md,
    fontFamily: theme.fonts.body,
    outline: 'none',
    cursor: 'pointer',
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
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        required={required}
        style={selectStyles}
        onFocus={(e) => {
          e.target.style.borderColor = theme.colors.primary;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = theme.colors.border;
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
