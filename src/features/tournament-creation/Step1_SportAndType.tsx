/* eslint-disable react-refresh/only-export-components -- SPORT_OPTIONS constant co-located with component */
import { CSSProperties } from 'react';
import { Card } from '../../components/ui';
import { TournamentType, Tournament } from '../../types/tournament';
import { cssVars } from '../../design-tokens'
import { SportId, getSportConfig, sportIdToLegacySport } from '../../config/sports';
import { SportSelector } from './components';

interface Step1Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  onTournamentTypeChange: (newType: TournamentType) => void;
  onSportChange?: (sportId: SportId) => void;
}

// Reusable selection button component for tournament type
interface SelectionButtonProps {
  isSelected: boolean;
  onClick: () => void;
  icon?: string;
  title: string;
  subtitle: string;
  details?: string[];
  variant?: 'default' | 'warning';
  layout?: 'center' | 'left';
}

const SelectionButton: React.FC<SelectionButtonProps> = ({
  isSelected,
  onClick,
  title,
  subtitle,
  details,
  variant = 'default',
  layout = 'center',
}) => {
  const accentColor = variant === 'warning' ? cssVars.colors.warning : cssVars.colors.primary;
  const bgColor = variant === 'warning' ? cssVars.colors.warningSelected : cssVars.colors.primarySelected;

  const buttonStyle: CSSProperties = {
    padding: layout === 'center' ? '24px 20px' : '20px',
    background: isSelected ? bgColor : cssVars.colors.surfaceDarkMedium,
    border: isSelected ? `2px solid ${accentColor}` : '2px solid transparent',
    borderRadius: cssVars.borderRadius.md,
    textAlign: layout,
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={buttonStyle}
      onMouseEnter={(e) => {
        if (!isSelected) { e.currentTarget.style.borderColor = cssVars.colors.borderMedium; }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) { e.currentTarget.style.borderColor = 'transparent'; }
      }}
      role="radio"
      aria-checked={isSelected}
    >
      <div style={{ fontSize: layout === 'center' ? cssVars.fontSizes.md : cssVars.fontSizes.sm, fontWeight: '700', color: cssVars.colors.textPrimary }}>
        {title}
      </div>
      <div style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: layout === 'center' ? '4px' : '6px', lineHeight: details ? '1.4' : 'normal' }}>
        {details ? (
          details.map((detail, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {detail}
            </span>
          ))
        ) : (
          subtitle
        )}
      </div>
    </button>
  );
};

export const Step1_SportAndType: React.FC<Step1Props> = ({
  formData,
  onUpdate,
  onTournamentTypeChange,
  onSportChange,
}) => {
  // Determine current sportId (from new field or legacy conversion)
  const currentSportId: SportId = formData.sportId ??
    (formData.sport === 'football' ? 'football-indoor' : 'football-indoor');

  const handleSportChange = (newSportId: SportId) => {
    const config = getSportConfig(newSportId);

    // Update sportId
    onUpdate('sportId', newSportId);

    // Update legacy sport field for backwards compatibility
    onUpdate('sport', sportIdToLegacySport(newSportId));

    // Apply sport-specific defaults
    onUpdate('groupPhaseGameDuration', config.defaults.gameDuration);
    onUpdate('groupPhaseBreakDuration', config.defaults.breakDuration);
    onUpdate('numberOfFields', config.defaults.typicalFieldCount);
    onUpdate('pointSystem', config.defaults.pointSystem);
    onUpdate('gamePeriods', config.defaults.periods);
    onUpdate('halftimeBreak', config.defaults.periodBreak);

    // Call optional callback
    if (onSportChange) {
      onSportChange(newSportId);
    }
  };

  const labelStyle: CSSProperties = {
    display: 'block',
    marginBottom: '12px',
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    fontWeight: cssVars.fontWeights.medium,
  };

  // Get current sport config for info display
  const currentConfig = getSportConfig(currentSportId);

  return (
    <Card>
      <h2 style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.xl, margin: '0 0 24px 0' }}>
        Sportart & Turniertyp
      </h2>

      {/* Sportart wählen */}
      <div style={{ marginBottom: '32px' }}>
        <label style={labelStyle}>Sportart</label>
        <SportSelector
          selectedSportId={currentSportId}
          onSportChange={handleSportChange}
        />

        {/* Info-Box mit aktuellen Defaults */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: cssVars.colors.secondaryBadge,
            borderRadius: cssVars.borderRadius.md,
            border: `1px solid ${cssVars.colors.secondaryBorderActive}`,
          }}
        >
          <div style={{
            fontSize: cssVars.fontSizes.sm,
            color: cssVars.colors.textSecondary,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            <span>
              <strong style={{ color: cssVars.colors.textPrimary }}>Spieldauer:</strong>{' '}
              {currentConfig.defaults.gameDuration} Min.
            </span>
            <span>
              <strong style={{ color: cssVars.colors.textPrimary }}>Pause:</strong>{' '}
              {currentConfig.defaults.breakDuration} Min.
            </span>
            {currentConfig.defaults.periods > 1 && (
              <span>
                <strong style={{ color: cssVars.colors.textPrimary }}>{currentConfig.terminology.periodPlural}:</strong>{' '}
                {currentConfig.defaults.periods}
              </span>
            )}
            <span>
              <strong style={{ color: cssVars.colors.textPrimary }}>Punkte:</strong>{' '}
              {currentConfig.defaults.pointSystem.win}-{currentConfig.defaults.pointSystem.draw}-{currentConfig.defaults.pointSystem.loss}
            </span>
          </div>
        </div>
      </div>

      {/* Turniertyp wählen */}
      <div>
        <label style={labelStyle}>Turniertyp</label>
        <div className="sport-type-grid" style={{ display: 'grid', gap: '12px' }} role="radiogroup" aria-label="Turniertyp auswählen">
          <SelectionButton
            isSelected={formData.tournamentType === 'classic'}
            onClick={() => onTournamentTypeChange('classic')}
            title="Klassisches Turnier"
            subtitle=""
            details={[
              '• Tabellenplatzierung',
              '• Finalrunden möglich',
              `• Normale ${currentConfig.terminology.goal}zählung`,
            ]}
            layout="left"
          />
          <SelectionButton
            isSelected={formData.tournamentType === 'bambini'}
            onClick={() => onTournamentTypeChange('bambini')}
            title="Bambini-Turnier"
            subtitle=""
            details={['• Ergebnisneutral', '• Ohne Tabellen/Platzierungen', '• Nur Sieg/Unentsch./Nied.']}
            variant="warning"
            layout="left"
          />
        </div>
      </div>

      {/* Hinweis bei Bambini */}
      {formData.tournamentType === 'bambini' && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            background: cssVars.colors.warningLight,
            borderRadius: cssVars.borderRadius.md,
            border: `1px solid ${cssVars.colors.warningBorder}`,
          }}
        >
          <div
            style={{
              fontSize: cssVars.fontSizes.sm,
              color: cssVars.colors.warning,
              fontWeight: cssVars.fontWeights.semibold,
              marginBottom: '4px',
            }}
          >
            Bambini-Turnier
          </div>
          <div style={{ fontSize: cssVars.fontSizes.sm, color: cssVars.colors.textSecondary }}>
            Bei Bambini-Turnieren werden Ergebnisse und Tabellen für Zuschauer standardmäßig
            ausgeblendet. Du kannst dies im nächsten Schritt anpassen.
          </div>
        </div>
      )}

      {/* Responsive Styles */}
      <style>{`
        .sport-type-grid {
          grid-template-columns: 1fr 1fr;
        }

        @media (max-width: 600px) {
          .sport-type-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Card>
  );
};
