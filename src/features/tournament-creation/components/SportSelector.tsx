/**
 * SportSelector Component
 *
 * Displays available sports from the sport registry as selectable cards.
 * Applies sport-specific defaults when a sport is selected.
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { SportId, SportConfig, getAvailableSports } from '../../../config/sports';

interface SportSelectorProps {
  selectedSportId: SportId | undefined;
  onSportChange: (sportId: SportId) => void;
  disabled?: boolean;
}

interface SportCardProps {
  sport: SportConfig;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const SportCard: React.FC<SportCardProps> = ({
  sport,
  isSelected,
  onClick,
  disabled = false,
}) => {
  const cardStyle: CSSProperties = {
    padding: '24px 20px',
    background: isSelected ? cssVars.colors.primarySelected : cssVars.colors.surfaceDarkMedium,
    border: isSelected ? `2px solid ${cssVars.colors.primary}` : '2px solid transparent',
    borderRadius: cssVars.borderRadius.md,
    textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: disabled ? 0.5 : 1,
  };

  // Format subtitle with key info
  const getSubtitle = (): string => {
    const parts: string[] = [];

    // Game duration
    parts.push(`${sport.defaults.gameDuration} Min.`);

    // Periods if > 1
    if (sport.defaults.periods > 1) {
      parts.push(`${sport.defaults.periods} ${sport.terminology.periodPlural}`);
    }

    return parts.join(' • ');
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={cardStyle}
      onMouseEnter={(e) => {
        if (!isSelected && !disabled) {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected && !disabled) {
          e.currentTarget.style.borderColor = 'transparent';
        }
      }}
      role="radio"
      aria-checked={isSelected}
    >
      <div style={{ fontSize: cssVars.fontSizes.xxl, marginBottom: '12px' }}>
        {sport.icon}
      </div>
      <div style={{
        fontSize: cssVars.fontSizes.md,
        fontWeight: '700',
        color: cssVars.colors.textPrimary,
        textTransform: 'uppercase',
      }}>
        {sport.name}
      </div>
      <div style={{
        fontSize: cssVars.fontSizes.xs,
        color: cssVars.colors.textSecondary,
        marginTop: '4px',
      }}>
        {getSubtitle()}
      </div>
    </button>
  );
};

export const SportSelector: React.FC<SportSelectorProps> = ({
  selectedSportId,
  onSportChange,
  disabled = false,
}) => {
  const availableSports = getAvailableSports();

  return (
    <div
      className="sport-selector-grid"
      style={{ display: 'grid', gap: '12px' }}
      role="radiogroup"
      aria-label="Sportart auswählen"
    >
      {availableSports.map((sport) => (
        <SportCard
          key={sport.id}
          sport={sport}
          isSelected={selectedSportId === sport.id}
          onClick={() => onSportChange(sport.id)}
          disabled={disabled}
        />
      ))}

      {/* Responsive Styles */}
      <style>{`
        .sport-selector-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        @media (max-width: 480px) {
          .sport-selector-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
