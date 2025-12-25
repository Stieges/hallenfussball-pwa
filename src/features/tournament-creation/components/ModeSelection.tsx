import { CSSProperties } from 'react';
import { theme } from '../../../styles/theme';
import { TournamentMode } from '../../../types/tournament';

interface ModeSelectionProps {
  selectedMode: TournamentMode;
  onModeChange: (mode: TournamentMode) => void;
}

interface ModeButtonProps {
  isSelected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  disabled?: boolean;
  badge?: string;
}

const ModeButton: React.FC<ModeButtonProps> = ({
  isSelected,
  onClick,
  title,
  subtitle,
  disabled = false,
  badge,
}) => {
  const buttonStyle: CSSProperties = {
    padding: '20px',
    background: disabled
      ? 'rgba(0,0,0,0.15)'
      : isSelected
        ? 'rgba(0,230,118,0.2)'
        : 'rgba(0,0,0,0.2)',
    border: isSelected ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
    borderRadius: theme.borderRadius.md,
    textAlign: 'left',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: disabled ? 0.6 : 1,
    position: 'relative',
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={buttonStyle}
      disabled={disabled}
      title={disabled ? 'Dieses Feature wird in einer zukünftigen Version verfügbar sein' : undefined}
    >
      {badge && (
        <span style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '2px 8px',
          background: 'rgba(0,176,255,0.2)',
          border: '1px solid rgba(0,176,255,0.4)',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: theme.fontWeights.semibold,
          color: theme.colors.secondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {badge}
        </span>
      )}
      <div style={{ fontSize: '15px', fontWeight: '700', color: disabled ? theme.colors.text.secondary : theme.colors.text.primary }}>
        {title}
      </div>
      <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginTop: '4px' }}>
        {subtitle}
      </div>
    </button>
  );
};

export const ModeSelection: React.FC<ModeSelectionProps> = ({
  selectedMode,
  onModeChange,
}) => {
  return (
    <div style={{ marginBottom: '32px' }}>
      <label style={{
        display: 'block',
        marginBottom: '12px',
        fontSize: theme.fontSizes.sm,
        color: theme.colors.text.secondary,
        fontWeight: theme.fontWeights.medium
      }}>
        Turniermodus
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <ModeButton
          isSelected={selectedMode === 'classic'}
          onClick={() => onModeChange('classic')}
          title="Klassisches Hallenturnier"
          subtitle="Gruppen + Finalrunde"
        />
        <ModeButton
          isSelected={selectedMode === 'miniFussball'}
          onClick={() => onModeChange('miniFussball')}
          title="Mini-Fußball / Funino"
          subtitle="Feldrotation, mehrere Felder"
          disabled={true}
          badge="Coming Soon"
        />
      </div>
    </div>
  );
};
