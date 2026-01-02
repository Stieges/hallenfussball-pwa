/**
 * FilterDropdown - Dropdown for single-select filters
 *
 * Used for Phase, Group, and Field filters in the desktop filter bar.
 * Follows design token patterns from existing Select component.
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';

export interface FilterOption {
  value: string | number | null;
  label: string;
}

interface FilterDropdownProps {
  /** Label shown above the dropdown */
  label: string;
  /** Current selected value */
  value: string | number | null;
  /** Available options */
  options: FilterOption[];
  /** Called when selection changes */
  onChange: (value: string | number | null) => void;
  /** Whether dropdown is disabled */
  disabled?: boolean;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  value,
  options,
  onChange,
  disabled = false,
  'data-testid': testId,
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
    minWidth: '120px',
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
  };

  const selectStyle: CSSProperties = {
    height: cssVars.touchTargets.minimum,
    padding: `0 ${cssVars.spacing.xl} 0 ${cssVars.spacing.md}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${value !== null ? cssVars.colors.primary : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md, // 16px for iOS zoom prevention
    fontFamily: cssVars.fontFamilies.body,
    // outline handled by global.css focus-visible styles
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'border-color 0.2s ease',
    opacity: disabled ? 0.5 : 1,
    // Fix: Prevent all options from rendering at once
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: cssVars.touchTargets.minimum,
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    if (newValue === '') {
      onChange(null);
    } else if (!isNaN(Number(newValue)) && options.some((o) => o.value === Number(newValue))) {
      onChange(Number(newValue));
    } else {
      onChange(newValue);
    }
  };

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>{label}</label>
      <select
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled}
        style={selectStyle}
        data-testid={testId}
        onFocus={(e) => {
          e.target.style.borderColor = cssVars.colors.primary;
        }}
        onBlur={(e) => {
          e.target.style.borderColor = value !== null ? cssVars.colors.primary : cssVars.colors.border;
        }}
      >
        {options.map((option) => (
          <option key={option.value ?? 'all'} value={option.value ?? ''}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
