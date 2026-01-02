import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { Tournament } from '../../../types/tournament';

interface BambiniSettingsProps {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
}

export const BambiniSettings: React.FC<BambiniSettingsProps> = ({
  formData,
  onUpdate,
}) => {
  if (formData.tournamentType !== 'bambini') {
    return null;
  }

  const summaryStyle: CSSProperties = {
    padding: '16px',
    background: 'rgba(255,145,0,0.1)',
    borderRadius: cssVars.borderRadius.md,
    border: '1px solid rgba(255,145,0,0.3)',
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.warning,
  };

  const contentStyle: CSSProperties = {
    padding: '16px',
    marginTop: '12px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: cssVars.borderRadius.md,
  };

  const checkboxLabelStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
  };

  const checkboxStyle: CSSProperties = {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: cssVars.colors.warning,
  };

  return (
    <details style={{ marginTop: '24px' }}>
      <summary style={summaryStyle}>
        Erweiterte Bambini-Einstellungen
      </summary>
      <div style={contentStyle}>
        <label style={{ ...checkboxLabelStyle, marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={formData.hideScoresForPublic ?? false}
            onChange={(e) => onUpdate('hideScoresForPublic', e.target.checked)}
            style={checkboxStyle}
          />
          <span style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm }}>
            Ergebnisse für Zuschauer verbergen
          </span>
        </label>
        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={formData.hideRankingsForPublic ?? false}
            onChange={(e) => onUpdate('hideRankingsForPublic', e.target.checked)}
            style={checkboxStyle}
          />
          <span style={{ color: cssVars.colors.textPrimary, fontSize: cssVars.fontSizes.sm }}>
            Tabellen für Zuschauer verbergen
          </span>
        </label>
      </div>
    </details>
  );
};
