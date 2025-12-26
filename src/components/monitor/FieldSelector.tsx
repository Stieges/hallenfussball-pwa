/**
 * FieldSelector - Field selection tabs for monitor view
 *
 * Features:
 * - Tab buttons for each field
 * - Active field highlighted in green
 * - Shows live indicator on fields with running matches
 * - Only shows if more than one field
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
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
}

export const FieldSelector: React.FC<FieldSelectorProps> = ({
  numberOfFields,
  selectedField,
  onSelectField,
  fieldsWithRunningMatches = new Set(),
  hidden = false,
}) => {
  // Don't render if only one field
  if (numberOfFields <= 1) {
    return null;
  }

  const containerStyle: CSSProperties = {
    display: 'flex',
    gap: spacing.sm,
    justifyContent: 'center',
    padding: spacing.md,
    opacity: hidden ? 0 : 1,
    transition: 'opacity 0.3s ease',
    pointerEvents: hidden ? 'none' : 'auto',
  };

  const getButtonStyle = (field: number): CSSProperties => {
    const isActive = field === selectedField;

    return {
      padding: `${spacing.sm} ${spacing.lg}`,
      border: `2px solid ${isActive ? colors.primary : colors.border}`,
      borderRadius: borderRadius.md,
      backgroundColor: isActive
        ? 'rgba(0,230,118,0.2)'
        : 'rgba(255,255,255,0.05)',
      color: isActive ? colors.primary : colors.textPrimary,
      fontSize: fontSizes.md,
      fontWeight: isActive ? fontWeights.bold : fontWeights.medium,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      position: 'relative' as const,
    };
  };

  const liveDotStyle: CSSProperties = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: colors.statusLive,
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
                e.currentTarget.style.borderColor = colors.primary;
                e.currentTarget.style.backgroundColor = 'rgba(0,230,118,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (field !== selectedField) {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
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
