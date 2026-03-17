/**
 * SettingItem - Einzelne Einstellung in der Settings-Liste
 *
 * Varianten:
 * - toggle: Switch für An/Aus
 * - select: Dropdown für Auswahl
 * - action: Button für Aktionen
 * - link: Navigation/externer Link
 * - info: Nur-Anzeige Information
 *
 * @see docs/concepts/SETTINGS-KONZEPT.md
 */

import React, { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';

// =============================================================================
// Types
// =============================================================================

interface BaseProps {
  /** Label der Einstellung */
  label: string;
  /** Optional: Beschreibung unter dem Label */
  description?: string;
  /** Optional: Icon links */
  icon?: string;
  /** Optional: Disabled-Status */
  disabled?: boolean;
  /** Optional: Pro-Badge anzeigen */
  isPro?: boolean;
  /** Optional: zusätzliche Styles */
  style?: CSSProperties;
}

interface ToggleProps extends BaseProps {
  variant: 'toggle';
  value: boolean;
  onChange: (value: boolean) => void;
}

interface SelectProps extends BaseProps {
  variant: 'select';
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface ActionProps extends BaseProps {
  variant: 'action';
  onClick: () => void;
  actionLabel?: string;
}

interface LinkProps extends BaseProps {
  variant: 'link';
  onClick: () => void;
}

interface InfoProps extends BaseProps {
  variant: 'info';
  value: string;
}

export type SettingItemProps =
  | ToggleProps
  | SelectProps
  | ActionProps
  | LinkProps
  | InfoProps;

// =============================================================================
// Component
// =============================================================================

export const SettingItem: React.FC<SettingItemProps> = (props) => {
  const { t } = useTranslation('settings');
  const { label, description, icon, disabled, isPro, style, variant } = props;

  const renderControl = () => {
    switch (variant) {
      case 'toggle': {
        const toggleProps = props;
        const { value, onChange } = toggleProps;
        return (
          <button
            type="button"
            role="switch"
            aria-checked={value}
            onClick={() => !disabled && onChange(!value)}
            style={{
              ...styles.toggle,
              ...(value ? styles.toggleOn : styles.toggleOff),
              ...(disabled ? styles.toggleDisabled : {}),
            }}
            disabled={disabled}
          >
            <span
              style={{
                ...styles.toggleThumb,
                ...(value ? styles.toggleThumbOn : styles.toggleThumbOff),
              }}
            />
          </button>
        );
      }

      case 'select': {
        const selectProps = props;
        const { value, options, onChange } = selectProps;
        return (
          <select
            value={value}
            onChange={(e) => !disabled && onChange(e.target.value)}
            style={{
              ...styles.select,
              ...(disabled ? styles.selectDisabled : {}),
            }}
            disabled={disabled}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      }

      case 'action': {
        const actionProps = props;
        const { onClick, actionLabel } = actionProps;
        return (
          <button
            type="button"
            onClick={() => !disabled && onClick()}
            style={{
              ...styles.actionButton,
              ...(disabled ? styles.actionButtonDisabled : {}),
            }}
            disabled={disabled}
          >
            {actionLabel ?? '→'}
          </button>
        );
      }

      case 'link': {
        const linkProps = props;
        const { onClick } = linkProps;
        return (
          <button
            type="button"
            onClick={() => !disabled && onClick()}
            style={styles.linkButton}
            disabled={disabled}
            aria-label={t('settingItem.openAriaLabel', { label })}
          >
            →
          </button>
        );
      }

      case 'info': {
        const infoProps = props;
        const { value } = infoProps;
        return <span style={styles.infoValue}>{value}</span>;
      }

      default:
        return null;
    }
  };

  return (
    <div
      style={{
        ...styles.container,
        ...(disabled ? styles.containerDisabled : {}),
        ...style,
      }}
    >
      <div style={styles.content}>
        {icon && <span style={styles.icon}>{icon}</span>}
        <div style={styles.textContainer}>
          <div style={styles.labelRow}>
            <span style={styles.label}>{label}</span>
            {isPro && (
              <span style={styles.proBadge} aria-label={t('settingItem.proBadge')}>
                Pro
              </span>
            )}
          </div>
          {description && <span style={styles.description}>{description}</span>}
        </div>
      </div>
      <div style={styles.control}>{renderControl()}</div>
    </div>
  );
};

// =============================================================================
// Styles
// =============================================================================

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cssVars.spacing.md,
    padding: `${cssVars.spacing.md} 0`,
    minHeight: '48px',
    borderBottom: `1px solid ${cssVars.colors.border}`,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    flex: 1,
    minWidth: 0,
  },
  icon: {
    fontSize: cssVars.fontSizes.lg,
    flexShrink: 0,
  },
  textContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },
  label: {
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
  },
  description: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
  proBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `2px ${cssVars.spacing.xs}`,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.accent,
    background: cssVars.colors.accentLight,
    borderRadius: cssVars.borderRadius.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  control: {
    flexShrink: 0,
  },

  // Toggle
  toggle: {
    position: 'relative',
    width: '52px',
    height: '28px',
    borderRadius: cssVars.borderRadius.full,
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    padding: 0,
  },
  toggleOff: {
    background: cssVars.colors.surfaceLight,
  },
  toggleOn: {
    background: cssVars.colors.primary,
  },
  toggleDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  toggleThumb: {
    position: 'absolute',
    top: '2px',
    width: '24px',
    height: '24px',
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.textPrimary,
    transition: 'left 0.2s ease',
    boxShadow: cssVars.shadows.sm,
  },
  toggleThumbOff: {
    left: '2px',
  },
  toggleThumbOn: {
    left: '26px',
  },

  // Select
  // Note: font-size must be >= 16px to prevent iOS auto-zoom on focus
  select: {
    minWidth: '140px',
    height: '36px',
    padding: `0 ${cssVars.spacing.lg} 0 ${cssVars.spacing.sm}`,
    fontSize: cssVars.fontSizes.lg, // 16px - iOS zoom prevention
    color: cssVars.colors.textPrimary,
    background: cssVars.colors.surfaceSolid,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A3B8D4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    backgroundSize: '16px',
  },
  selectDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },

  // Action Button
  actionButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '44px',
    height: '36px',
    padding: `0 ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.primary,
    background: cssVars.colors.primaryLight,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  actionButtonDisabled: {
    cursor: 'not-allowed',
    opacity: 0.5,
  },

  // Link Button
  linkButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    background: 'transparent',
    border: 'none',
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.lg,
    cursor: 'pointer',
  },

  // Info Value
  infoValue: {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },
};

export default SettingItem;
