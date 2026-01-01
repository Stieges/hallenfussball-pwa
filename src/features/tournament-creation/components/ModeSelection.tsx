import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
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
      ? cssVars.colors.surfaceDarkLight
      : isSelected
        ? cssVars.colors.primarySelected
        : cssVars.colors.surfaceDarkMedium,
    border: isSelected ? `2px solid ${cssVars.colors.primary}` : '2px solid transparent',
    borderRadius: cssVars.borderRadius.md,
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
          background: cssVars.colors.secondarySelected,
          border: `1px solid ${cssVars.colors.secondaryBorderActive}`,
          borderRadius: '12px',
          fontSize: '10px', // Smaller than cssVars.fontSizes.xs for badges
          fontWeight: cssVars.fontWeights.semibold,
          color: cssVars.colors.secondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          {badge}
        </span>
      )}
      <div style={{ fontSize: cssVars.fontSizes.sm, fontWeight: '700', color: disabled ? cssVars.colors.textSecondary : cssVars.colors.textPrimary }}>
        {title}
      </div>
      <div style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textSecondary, marginTop: '4px' }}>
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
        fontSize: cssVars.fontSizes.sm,
        color: cssVars.colors.textSecondary,
        fontWeight: cssVars.fontWeights.medium
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
