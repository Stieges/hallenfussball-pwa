/**
 * TeamSearchInput - Text search for filtering by team name
 *
 * Features:
 * - Search icon prefix
 * - Clear button when text present
 * - Minimum 2 characters for search to activate
 */

import { CSSProperties, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { Icons } from '../../../../components/ui/Icons';

interface TeamSearchInputProps {
  /** Current search value */
  value: string;
  /** Called when search value changes */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Optional label */
  label?: string;
  /** Debounce delay in ms (0 = no debounce) */
  debounceMs?: number;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export const TeamSearchInput: React.FC<TeamSearchInputProps> = ({
  value,
  onChange,
  placeholder,
  label,
  debounceMs = 300,
  'data-testid': testId,
}) => {
  const { t } = useTranslation('tournament');
  const resolvedPlaceholder = placeholder ?? t('filter.teamSearchPlaceholder');
  const resolvedLabel = label ?? t('filter.teamSearch');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    if (debounceMs > 0) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    } else {
      onChange(newValue);
    }

    // Update local display immediately (for responsive feel)
    if (inputRef.current) {
      inputRef.current.value = newValue;
    }
  };

  const handleClear = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onChange('');
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
    minWidth: '180px',
    flex: 1,
    maxWidth: '280px',
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
  };

  const inputContainerStyle: CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const iconStyle: CSSProperties = {
    position: 'absolute',
    left: cssVars.spacing.sm,
    color: cssVars.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  };

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    paddingLeft: '36px',
    paddingRight: value ? '44px' : cssVars.spacing.md,
    background: cssVars.colors.inputBg,
    border: `1px solid ${value.length >= 2 ? cssVars.colors.primary : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md, // 16px for iOS zoom prevention
    fontFamily: cssVars.fontFamilies.body,
    outline: 'none',
    transition: 'border-color 0.2s ease',
    minHeight: '44px',
  };

  const clearButtonStyle: CSSProperties = {
    position: 'absolute',
    right: 0,
    background: 'none',
    border: 'none',
    minWidth: '44px',
    minHeight: '44px',
    padding: cssVars.spacing.sm,
    cursor: 'pointer',
    color: cssVars.colors.textSecondary,
    display: value ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: cssVars.borderRadius.sm,
    transition: 'color 0.2s',
  };

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>{resolvedLabel}</label>
      <div style={inputContainerStyle}>
        <span style={iconStyle}>
          <Icons.Search size={16} />
        </span>
        <input
          ref={inputRef}
          type="text"
          defaultValue={value}
          onChange={handleChange}
          placeholder={resolvedPlaceholder}
          style={inputStyle}
          data-testid={testId}
          onFocus={(e) => {
            e.target.style.borderColor = cssVars.colors.primary;
          }}
          onBlur={(e) => {
            e.target.style.borderColor = value.length >= 2 ? cssVars.colors.primary : cssVars.colors.border;
          }}
        />
        <button
          style={clearButtonStyle}
          onClick={handleClear}
          aria-label={t('filter.clearSearch')}
          type="button"
          data-testid={testId ? `${testId}-clear` : undefined}
        >
          <Icons.X size={16} />
        </button>
      </div>
    </div>
  );
};
