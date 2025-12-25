import { CSSProperties } from 'react';
import { Card } from '../../components/ui';
import { TournamentType, Tournament } from '../../types/tournament';
import { theme } from '../../styles/theme';
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
  const accentColor = variant === 'warning' ? theme.colors.warning : theme.colors.primary;
  const bgColor = variant === 'warning' ? 'rgba(255,145,0,0.2)' : 'rgba(0,230,118,0.2)';

  const buttonStyle: CSSProperties = {
    padding: layout === 'center' ? '24px 20px' : '20px',
    background: isSelected ? bgColor : 'rgba(0,0,0,0.2)',
    border: isSelected ? `2px solid ${accentColor}` : '2px solid transparent',
    borderRadius: theme.borderRadius.md,
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
        if (!isSelected) {e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';}
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {e.currentTarget.style.borderColor = 'transparent';}
      }}
      role="radio"
      aria-checked={isSelected}
    >
      <div style={{ fontSize: layout === 'center' ? '16px' : '15px', fontWeight: '700', color: theme.colors.text.primary }}>
        {title}
      </div>
      <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginTop: layout === 'center' ? '4px' : '6px', lineHeight: details ? '1.4' : 'normal' }}>
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
  const currentSportId: SportId = formData.sportId ||
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
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: theme.fontWeights.medium,
  };

  // Get current sport config for info display
  const currentConfig = getSportConfig(currentSportId);

  return (
    <Card>
      <h2 style={{ color: theme.colors.text.primary, fontSize: theme.fontSizes.xl, margin: '0 0 24px 0' }}>
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
            background: 'rgba(0,176,255,0.08)',
            borderRadius: theme.borderRadius.md,
            border: '1px solid rgba(0,176,255,0.2)',
          }}
        >
          <div style={{
            fontSize: theme.fontSizes.sm,
            color: theme.colors.text.secondary,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
          }}>
            <span>
              <strong style={{ color: theme.colors.text.primary }}>Spieldauer:</strong>{' '}
              {currentConfig.defaults.gameDuration} Min.
            </span>
            <span>
              <strong style={{ color: theme.colors.text.primary }}>Pause:</strong>{' '}
              {currentConfig.defaults.breakDuration} Min.
            </span>
            {currentConfig.defaults.periods > 1 && (
              <span>
                <strong style={{ color: theme.colors.text.primary }}>{currentConfig.terminology.periodPlural}:</strong>{' '}
                {currentConfig.defaults.periods}
              </span>
            )}
            <span>
              <strong style={{ color: theme.colors.text.primary }}>Punkte:</strong>{' '}
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
            background: 'rgba(255,145,0,0.1)',
            borderRadius: theme.borderRadius.md,
            border: '1px solid rgba(255,145,0,0.3)',
          }}
        >
          <div
            style={{
              fontSize: theme.fontSizes.sm,
              color: theme.colors.warning,
              fontWeight: theme.fontWeights.semibold,
              marginBottom: '4px',
            }}
          >
            Bambini-Turnier
          </div>
          <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary }}>
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

        @media (max-width: 480px) {
          .sport-type-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Card>
  );
};
