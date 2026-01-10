/**
 * ActionMenu Component
 *
 * Desktop dropdown menu for contextual actions.
 * Opens on click of trigger button (usually "..." icon).
 *
 * Features:
 * - Positioned relative to trigger
 * - Closes on click outside
 * - Keyboard navigation (Escape to close)
 * - Animated appearance
 */

import { CSSProperties, useEffect, useRef, useState, useCallback } from 'react';
import { cssVars } from '../../design-tokens'
import { Icons } from './Icons';

export interface ActionMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Test ID for E2E tests */
  testId?: string;
  /** Whether the menu trigger is visible (default: true) */
  visible?: boolean;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  items,
  testId,
  visible = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleItemClick = (item: ActionMenuItem) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.disabled) {
      item.onClick();
      setIsOpen(false);
    }
  };

  const containerStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-block',
  };

  const triggerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    border: 'none',
    background: 'transparent',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    color: cssVars.colors.textSecondary,
    transition: 'all 0.2s ease',
  };

  const menuStyle: CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    minWidth: '180px',
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    boxShadow: cssVars.shadows.lg,
    zIndex: 1100, // Higher than BottomNavigation (1000) to appear above it
    overflow: 'hidden',
    animation: 'menuFadeIn 0.15s ease-out',
  };

  const getItemStyle = (item: ActionMenuItem, isHovered: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    width: '100%',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    border: 'none',
    background: isHovered ? cssVars.colors.surfaceHover : 'transparent',
    cursor: item.disabled ? 'not-allowed' : 'pointer',
    color: item.disabled
      ? cssVars.colors.textMuted
      : item.variant === 'danger'
        ? cssVars.colors.error
        : cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    textAlign: 'left',
    opacity: item.disabled ? 0.5 : 1,
    transition: 'background 0.15s ease',
  });

  // Return null when not visible (after hooks to satisfy React rules)
  if (!visible) {
    return null;
  }

  return (
    <div style={containerStyle}>
      <button
        ref={triggerRef}
        style={triggerStyle}
        onClick={handleTriggerClick}
        aria-label="Aktionen"
        aria-haspopup="true"
        aria-expanded={isOpen}
        data-testid={testId ? `${testId}-trigger` : undefined}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = cssVars.colors.surfaceHover;
          e.currentTarget.style.color = cssVars.colors.textPrimary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = cssVars.colors.textSecondary;
        }}
      >
        <Icons.MoreVertical size={20} />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          style={menuStyle}
          role="menu"
          aria-label="Aktionen"
          data-testid={testId ? `${testId}-menu` : undefined}
        >
          {items.map((item) => (
            <ActionMenuItemButton
              key={item.id}
              item={item}
              onClick={handleItemClick(item)}
              getItemStyle={getItemStyle}
            />
          ))}
        </div>
      )}

      {/* Animation keyframes */}
      {isOpen && (
        <style>{`
          @keyframes menuFadeIn {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      )}
    </div>
  );
};

// Separate component for menu items to handle hover state
const ActionMenuItemButton: React.FC<{
  item: ActionMenuItem;
  onClick: (e: React.MouseEvent) => void;
  getItemStyle: (item: ActionMenuItem, isHovered: boolean) => CSSProperties;
}> = ({ item, onClick, getItemStyle }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      style={getItemStyle(item, isHovered)}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="menuitem"
      disabled={item.disabled}
      data-testid={`action-menu-item-${item.id}`}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  );
};
