/**
 * FieldSelector - Field selection tabs for monitor view
 *
 * Features:
 * - Tab buttons for each field
 * - Active field highlighted in green
 * - Shows live indicator on fields with running matches
 * - Only shows if more than one field
 * - Theme support (dark/light/auto)
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';
import type { MonitorTheme } from '../../types/monitor';
import { useMonitorTheme } from '../../hooks';

export interface FieldSelectorProps {
  /** Total number of fields */
  numberOfFields: number;
  /** Currently selected field (1-based) */
  selectedField: number;
  /** Callback when field is selected */
  onSelectField: (field: number) => void;
  /** Set of field numbers with running matches */
  fieldsWithRunningMatches?: Set<number>;
  /** Hide the selector (e.g., in fullscreen mode when controls hidden) */
  hidden?: boolean;
  /** Theme (dark/light/auto) */
  theme?: MonitorTheme;
}

export const FieldSelector: React.FC<FieldSelectorProps> = ({
  numberOfFields,
  selectedField,
  onSelectField,
  fieldsWithRunningMatches = new Set(),
  hidden = false,
  theme = 'dark',
}) => {
  // Resolve auto theme based on system preference
  const { themeColors } = useMonitorTheme(theme);
  // Don't render if only one field
  if (numberOfFields <= 1) {
    return null;
  }

  const containerStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    justifyContent: 'center',
    padding: cssVars.spacing.md,
    opacity: hidden ? 0 : 1,
    transition: 'opacity 0.3s ease',
    pointerEvents: hidden ? 'none' : 'auto',
  };

  const getButtonStyle = (field: number): CSSProperties => {
    const isActive = field === selectedField;

    return {
      padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
      border: `2px solid ${isActive ? themeColors.liveBadgeText : themeColors.border}`,
      borderRadius: cssVars.borderRadius.md,
      backgroundColor: isActive
        ? themeColors.fieldSelected
        : themeColors.fieldDefault,
      color: isActive ? themeColors.liveBadgeText : themeColors.text,
      fontSize: cssVars.fontSizes.md,
      fontWeight: isActive ? cssVars.fontWeights.bold : cssVars.fontWeights.medium,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: cssVars.spacing.sm,
      position: 'relative' as const,
    };
  };

  const liveDotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: themeColors.liveDot,
    animation: 'liveDot 1s ease-in-out infinite',
  };

  return (
    <>
      <div style={containerStyle}>
        {Array.from({ length: numberOfFields }, (_, i) => i + 1).map(field => (
          <button
            key={field}
            style={getButtonStyle(field)}
            onClick={() => onSelectField(field)}
            onMouseEnter={(e) => {
              if (field !== selectedField) {
                e.currentTarget.style.borderColor = themeColors.liveBadgeText;
                e.currentTarget.style.backgroundColor = themeColors.fieldHover;
              }
            }}
            onMouseLeave={(e) => {
              if (field !== selectedField) {
                e.currentTarget.style.borderColor = themeColors.border;
                e.currentTarget.style.backgroundColor = themeColors.fieldDefault;
              }
            }}
            aria-pressed={field === selectedField}
            aria-label={`Feld ${field}${fieldsWithRunningMatches.has(field) ? ' (Spiel läuft)' : ''}`}
          >
            <span>Feld {field}</span>
            {fieldsWithRunningMatches.has(field) && (
              <span style={liveDotStyle} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes liveDot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.8; }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </>
  );
};
