import React, { useState, useRef, useEffect, CSSProperties, useCallback } from 'react';
import { cssVars } from '../../design-tokens';

interface ComboboxOption {
  value: string | number;
  label: string;
}

interface ComboboxProps {
  label?: string;
  value: string | number;
  onChange?: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  style?: CSSProperties;
  /** Zeigt einen Fehlerzustand an (roter Rahmen) */
  error?: boolean;
  /** Test ID for E2E testing */
  'data-testid'?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Suchen...',
  disabled = false,
  required = false,
  style = {},
  error = false,
  'data-testid': testId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Get the label for the current value
  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayValue = selectedOption?.label || '';

  // Filter options based on search term
  const filteredOptions = searchTerm
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
      highlightedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = useCallback((option: ComboboxOption) => {
    onChange?.(String(option.value));
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  }, [onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  };

  const containerStyles: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
    width: '100%',
    position: 'relative',
    ...style,
  };

  const labelStyles: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textSecondary,
  };

  const inputStyles: CSSProperties = {
    height: cssVars.touchTargets.minimum,
    padding: `0 ${cssVars.spacing.xl} 0 ${cssVars.spacing.md}`,
    background: cssVars.colors.inputBg,
    border: `1px solid ${error ? cssVars.colors.error : isOpen ? cssVars.colors.primary : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
    fontFamily: cssVars.fontFamilies.body,
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    width: '100%',
    boxShadow: isOpen ? `0 0 0 3px ${error ? cssVars.colors.errorGlow : cssVars.colors.focusRing}` : 'none',
  };

  const dropdownStyles: CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: cssVars.spacing.xs,
    maxHeight: '240px',
    overflowY: 'auto',
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    boxShadow: `0 4px 12px ${cssVars.colors.shadowMedium}`,
    zIndex: 100,
    listStyle: 'none',
    padding: cssVars.spacing.xs,
    margin: 0,
  };

  const optionStyles = (isHighlighted: boolean, isSelected: boolean): CSSProperties => ({
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    cursor: 'pointer',
    borderRadius: cssVars.borderRadius.sm,
    background: isHighlighted
      ? cssVars.colors.primarySubtle
      : isSelected
      ? cssVars.colors.surfaceHover
      : 'transparent',
    color: isSelected ? cssVars.colors.primary : cssVars.colors.textPrimary,
    fontWeight: isSelected ? cssVars.fontWeights.semibold : cssVars.fontWeights.normal,
    transition: 'background 0.15s ease',
  });

  const chevronStyles: CSSProperties = {
    position: 'absolute',
    right: cssVars.spacing.md,
    top: '50%',
    transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
    transition: 'transform 0.2s ease',
    pointerEvents: 'none',
    color: cssVars.colors.textSecondary,
  };

  return (
    <div ref={containerRef} style={containerStyles}>
      {label && (
        <label style={labelStyles}>
          {label}
          {required && <span style={{ color: cssVars.colors.error }}> *</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : displayValue}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setHighlightedIndex(0);
            if (!isOpen) { setIsOpen(true); }
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm('');
            setHighlightedIndex(
              filteredOptions.findIndex((opt) => String(opt.value) === String(value))
            );
          }}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? placeholder : displayValue || placeholder}
          disabled={disabled}
          required={required}
          style={inputStyles}
          data-testid={testId}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-invalid={error || undefined}
          aria-autocomplete="list"
          autoComplete="off"
        />
        <span style={chevronStyles}>▼</span>
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          style={dropdownStyles}
          aria-label={label}
        >
          {filteredOptions.map((option, index) => (
            <li
              key={option.value}
              role="option"
              aria-selected={String(option.value) === String(value)}
              style={optionStyles(
                index === highlightedIndex,
                String(option.value) === String(value)
              )}
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}

      {isOpen && filteredOptions.length === 0 && searchTerm && (
        <div
          style={{
            ...dropdownStyles,
            padding: cssVars.spacing.md,
            color: cssVars.colors.textSecondary,
            textAlign: 'center',
          }}
        >
          Keine Ergebnisse für „{searchTerm}"
        </div>
      )}
    </div>
  );
};
