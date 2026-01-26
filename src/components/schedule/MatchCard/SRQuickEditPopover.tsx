/**
 * SRQuickEditPopover - Quick referee assignment popover
 *
 * Appears when tapping the SR badge on a match card in edit mode.
 * Allows quick selection of a referee without opening a full editor.
 *
 * Features:
 * - Compact popover design
 * - Shows available referees
 * - Filters out currently playing teams (for teams mode)
 * - Immediate assignment on selection
 */

import { type CSSProperties, useState, useRef, useEffect, useCallback } from 'react';
import { cssVars } from '../../../design-tokens'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RefereeOption {
  /** Referee number or team ID */
  value: number | string | null;
  /** Display label */
  label: string;
  /** Whether this option is disabled (e.g., team is playing) */
  disabled?: boolean;
  /** Reason for being disabled */
  disabledReason?: string;
}

export interface SRQuickEditPopoverProps {
  /** Currently selected referee */
  currentReferee?: number | string | null;
  /** Available referee options */
  options: RefereeOption[];
  /** Called when referee is selected */
  onSelect: (value: number | string | null) => void;
  /** Called when popover should close */
  onClose: () => void;
  /** Anchor element for positioning */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SRQuickEditPopover: React.FC<SRQuickEditPopoverProps> = ({
  currentReferee,
  options,
  onSelect,
  onClose,
  anchorRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // ---------------------------------------------------------------------------
  // Position Calculation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!anchorRef?.current || !popoverRef.current) {
      return;
    }

    const anchor = anchorRef.current;
    const popover = popoverRef.current;
    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    // Position below the anchor, centered horizontally
    let left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
    let top = anchorRect.bottom + 8;

    // Clamp to viewport
    const margin = 16;
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - popoverRect.height - margin));

    // If not enough space below, position above
    if (top + popoverRect.height > window.innerHeight - margin) {
      top = anchorRect.top - popoverRect.height - 8;
    }

    setPosition({ top, left });
  }, [anchorRef]);

  // ---------------------------------------------------------------------------
  // Click Outside Handler
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        // Also check if click is on anchor
        if (anchorRef?.current?.contains(event.target as Node)) {
          return;
        }
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose, anchorRef]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleOptionClick = useCallback(
    (option: RefereeOption) => {
      if (option.disabled) {
        return;
      }
      onSelect(option.value);
      onClose();
    },
    [onSelect, onClose]
  );

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  };

  const popoverStyle: CSSProperties = {
    position: 'fixed',
    top: position.top,
    left: position.left,
    zIndex: 1000,
    backgroundColor: cssVars.colors.surfaceSolid,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    boxShadow: `0 8px 24px ${cssVars.colors.shadowMedium}`,
    minWidth: '180px',
    maxWidth: '280px',
    maxHeight: '300px',
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    backgroundColor: cssVars.colors.surfaceDark,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  };

  const listStyle: CSSProperties = {
    listStyle: 'none',
    padding: cssVars.spacing.xs,
    margin: 0,
    maxHeight: '240px',
    overflowY: 'auto',
  };

  const optionStyle = (isSelected: boolean, isDisabled: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    backgroundColor: isSelected ? cssVars.colors.primaryLight : 'transparent',
    color: isDisabled ? cssVars.colors.textDisabled : cssVars.colors.textPrimary,
    opacity: isDisabled ? 0.6 : 1,
    fontSize: cssVars.fontSizes.sm,
    transition: 'background-color 0.15s ease',
  });

  const checkmarkStyle: CSSProperties = {
    color: cssVars.colors.primary,
    fontWeight: cssVars.fontWeights.bold,
  };

  const disabledHintStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textMuted,
    marginLeft: cssVars.spacing.sm,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Invisible overlay to catch clicks */}
      <div style={overlayStyle} />

      {/* Popover */}
      <div ref={popoverRef} style={popoverStyle} role="listbox" aria-label="Schiedsrichter auswählen">
        <div style={headerStyle}>Schiedsrichter wählen</div>

        <ul style={listStyle}>
          {options.map((option) => {
            const isSelected = currentReferee === option.value;
            const isDisabled = option.disabled ?? false;

            return (
              <li
                key={option.value ?? 'none'}
                style={optionStyle(isSelected, isDisabled)}
                onClick={() => handleOptionClick(option)}
                onMouseEnter={(e) => {
                  if (!isDisabled) {
                    (e.currentTarget as HTMLElement).style.backgroundColor = isSelected
                      ? cssVars.colors.primaryLight
                      : cssVars.colors.surfaceHover;
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isSelected
                    ? cssVars.colors.primaryLight
                    : 'transparent';
                }}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isDisabled}
              >
                <span>
                  {option.label}
                  {isDisabled && option.disabledReason && (
                    <span style={disabledHintStyle}>({option.disabledReason})</span>
                  )}
                </span>
                {isSelected && <span style={checkmarkStyle}>✓</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export default SRQuickEditPopover;
