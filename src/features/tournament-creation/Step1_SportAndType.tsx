import { CSSProperties } from 'react';
import { Card } from '../../components/ui';
import { TournamentType, Tournament } from '../../types/tournament';
import { theme } from '../../styles/theme';

interface Step1Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  onTournamentTypeChange: (newType: TournamentType) => void;
}

// Reusable selection button component
interface SelectionButtonProps {
  isSelected: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  subtitle: string;
  details?: string[];
  variant?: 'default' | 'warning';
  layout?: 'center' | 'left';
}

const SelectionButton: React.FC<SelectionButtonProps> = ({
  isSelected,
  onClick,
  icon,
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
      <div style={{ fontSize: layout === 'center' ? '32px' : '24px', marginBottom: layout === 'center' ? '12px' : '8px' }}>
        {icon}
      </div>
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
}) => {

  const labelStyle: CSSProperties = {
    display: 'block',
    marginBottom: '12px',
    fontSize: theme.fontSizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: theme.fontWeights.medium,
  };

  return (
    <Card>
      <h2 style={{ color: theme.colors.text.primary, fontSize: theme.fontSizes.xl, margin: '0 0 24px 0' }}>
        🏆 Sportart & Turniertyp
      </h2>

      {/* Sportart wählen */}
      <div style={{ marginBottom: '32px' }}>
        <label style={labelStyle}>Sportart</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} role="radiogroup" aria-label="Sportart auswählen">
          <SelectionButton
            isSelected={formData.sport === 'football'}
            onClick={() => onUpdate('sport', 'football')}
            icon="⚽"
            title="FUSSBALL"
            subtitle="Hallenturnier"
          />
          <SelectionButton
            isSelected={formData.sport === 'other'}
            onClick={() => onUpdate('sport', 'other')}
            icon="🎯"
            title="SONSTIGES"
            subtitle="Handball, Basketball, etc."
          />
        </div>
      </div>

      {/* Turniertyp wählen */}
      <div>
        <label style={labelStyle}>Turniertyp</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} role="radiogroup" aria-label="Turniertyp auswählen">
          <SelectionButton
            isSelected={formData.tournamentType === 'classic'}
            onClick={() => onTournamentTypeChange('classic')}
            icon="🏆"
            title="KLASSISCHES TURNIER"
            subtitle=""
            details={['• Tabellenplatzierung', '• Finalrunden möglich', '• Normale Torzählung']}
            layout="left"
          />
          <SelectionButton
            isSelected={formData.tournamentType === 'bambini'}
            onClick={() => onTournamentTypeChange('bambini')}
            icon="👶"
            title="BAMBINI-TURNIER"
            subtitle=""
            details={['• Spielfreude im Fokus', '• Ohne Tabellen/Ergebnisse', '• Nur Sieg/Unentsch./Nied.']}
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
            💡 Bambini-Turnier
          </div>
          <div style={{ fontSize: theme.fontSizes.sm, color: theme.colors.text.secondary }}>
            Bei Bambini-Turnieren werden Ergebnisse und Tabellen für Zuschauer standardmäßig
            ausgeblendet. Du kannst dies im nächsten Schritt anpassen.
          </div>
        </div>
      )}
    </Card>
  );
};
