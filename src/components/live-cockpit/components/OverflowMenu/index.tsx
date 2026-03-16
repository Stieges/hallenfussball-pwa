/**
 * OverflowMenu - Live Cockpit Overflow Menu
 *
 * Shows when the ⋮ button is clicked in the header.
 * Provides quick access to:
 * - Card (Karte)
 * - Time Penalty (Zeitstrafe)
 * - Substitution (Wechsel)
 * - Edit Result (Ergebnis bearbeiten)
 * - Adjust Time (Zeit anpassen)
 * - Link to Admin Center Settings
 *
 * @see docs/concepts/LIVE-COCKPIT-KONZEPT.md Section 4.4
 */

import { useEffect, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';

// =============================================================================
// Types
// =============================================================================

export interface OverflowMenuProps {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Close the menu */
  onClose: () => void;
  /** Tournament ID for navigation */
  tournamentId: string;

  // Quick actions
  onCardClick?: () => void;
  onTimePenaltyClick?: () => void;
  onSubstitutionClick?: () => void;
  onEditResultClick?: () => void;
  onAdjustTimeClick?: () => void;

  /** Open Settings Dialog directly */
  onSettingsClick?: () => void;

  /** Navigate to Admin Center Settings (fallback) */
  onNavigateToSettings?: () => void;
}

// =============================================================================
// Menu Item Component
// =============================================================================

interface MenuItemProps {
  icon: string;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'link';
}

function MenuItem({ icon, label, onClick, variant = 'default' }: MenuItemProps) {
  const itemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    width: '100%',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: variant === 'link' ? cssVars.colors.primary : cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  };

  return (
    <button
      type="button"
      style={itemStyle}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = cssVars.colors.surfaceHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ fontSize: '1.25rem', width: 28, textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// =============================================================================
// Divider Component
// =============================================================================

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: cssVars.colors.border,
        margin: `${cssVars.spacing.xs} 0`,
      }}
    />
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function OverflowMenu({
  isOpen,
  onClose,
  onCardClick,
  onTimePenaltyClick,
  onSubstitutionClick,
  onEditResultClick,
  onAdjustTimeClick,

}: OverflowMenuProps) {
  const { t } = useTranslation('cockpit');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) { return; }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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
  }, [isOpen, onClose]);

  if (!isOpen) { return null; }

  // Handler that closes menu after action
  const handleAction = (action?: () => void) => {
    if (action) {
      action();
    }
    onClose();
  };



  // Styles
  // z-index must be higher than BottomNavigation (1000)
  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1050,
  };

  const menuStyle: CSSProperties = {
    position: 'fixed',
    top: 56, // Below header
    right: cssVars.spacing.md,
    minWidth: 220,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    boxShadow: cssVars.shadows.lg,
    padding: cssVars.spacing.xs,
    zIndex: 1100,
  };

  const sectionLabelStyle: CSSProperties = {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <>
      {/* Backdrop */}
      <div style={overlayStyle} onClick={onClose} aria-hidden="true" />

      {/* Menu */}
      <div
        ref={menuRef}
        style={menuStyle}
        role="menu"
        aria-label={t('menu.moreActionsAria')}
      >
        {/* Event Tracking Section */}
        <div style={sectionLabelStyle}>{t('menu.eventsSection')}</div>

        {onCardClick && (
          <MenuItem
            icon="🟨"
            label={t('menu.card')}
            onClick={() => handleAction(onCardClick)}
          />
        )}

        {onTimePenaltyClick && (
          <MenuItem
            icon="⏱️"
            label={t('menu.timePenalty')}
            onClick={() => handleAction(onTimePenaltyClick)}
          />
        )}

        {onSubstitutionClick && (
          <MenuItem
            icon="🔄"
            label={t('menu.substitution')}
            onClick={() => handleAction(onSubstitutionClick)}
          />
        )}

        <Divider />

        {/* Match Control Section */}
        <div style={sectionLabelStyle}>{t('menu.matchSection')}</div>

        {onEditResultClick && (
          <MenuItem
            icon="✏️"
            label={t('menu.editResult')}
            onClick={() => handleAction(onEditResultClick)}
          />
        )}

        {onAdjustTimeClick && (
          <MenuItem
            icon="⏰"
            label={t('menu.adjustTime')}
            onClick={() => handleAction(onAdjustTimeClick)}
          />
        )}


      </div>
    </>
  );
}
