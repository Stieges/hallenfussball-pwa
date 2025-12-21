/**
 * SportSelector Component
 *
 * Displays available sports from the sport registry as selectable cards.
 * Applies sport-specific defaults when a sport is selected.
 */

import { CSSProperties } from 'react';
import { theme } from '../../../styles/theme';
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
    background: isSelected ? 'rgba(0,230,118,0.2)' : 'rgba(0,0,0,0.2)',
    border: isSelected ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
    borderRadius: theme.borderRadius.md,
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
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>
        {sport.icon}
      </div>
      <div style={{
        fontSize: '16px',
        fontWeight: '700',
        color: theme.colors.text.primary,
        textTransform: 'uppercase',
      }}>
        {sport.name}
      </div>
      <div style={{
        fontSize: '12px',
        color: theme.colors.text.secondary,
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
