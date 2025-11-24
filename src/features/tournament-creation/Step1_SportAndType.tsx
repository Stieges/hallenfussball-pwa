import React, { CSSProperties } from 'react';
import { Card } from '../../components/ui';
import { Sport, TournamentType, Tournament } from '../../types/tournament';
import { theme } from '../../styles/theme';

interface Step1Props {
  formData: Partial<Tournament>;
  onUpdate: <K extends keyof Tournament>(field: K, value: Tournament[K]) => void;
  onTournamentTypeChange: (newType: TournamentType) => void;
}

export const Step1_SportAndType: React.FC<Step1Props> = ({
  formData,
  onUpdate,
  onTournamentTypeChange,
}) => {
  const sportButtonStyle = (isSelected: boolean): CSSProperties => ({
    padding: '24px 20px',
    background: isSelected ? 'rgba(0,230,118,0.2)' : 'rgba(0,0,0,0.2)',
    border: isSelected ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
    borderRadius: theme.borderRadius.md,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  const typeButtonStyle = (isSelected: boolean, isBambini: boolean = false): CSSProperties => ({
    padding: '20px',
    background: isSelected
      ? isBambini
        ? 'rgba(255,145,0,0.2)'
        : 'rgba(0,230,118,0.2)'
      : 'rgba(0,0,0,0.2)',
    border: isSelected
      ? isBambini
        ? `2px solid ${theme.colors.warning}`
        : `2px solid ${theme.colors.primary}`
      : '2px solid transparent',
    borderRadius: theme.borderRadius.md,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  return (
    <Card>
      <h2 style={{ color: theme.colors.text.primary, fontSize: theme.fontSizes.xl, margin: '0 0 24px 0' }}>
        🏆 Sportart & Turniertyp
      </h2>

      {/* Sportart wählen */}
      <div style={{ marginBottom: '32px' }}>
        <label
          style={{
            display: 'block',
            marginBottom: '12px',
            fontSize: theme.fontSizes.sm,
            color: theme.colors.text.secondary,
            fontWeight: theme.fontWeights.medium,
          }}
        >
          Sportart
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={() => onUpdate('sport', 'football')}
            style={sportButtonStyle(formData.sport === 'football')}
            onMouseEnter={(e) => {
              if (formData.sport !== 'football')
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              if (formData.sport !== 'football') e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚽</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>
              FUSSBALL
            </div>
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginTop: '4px' }}>
              Hallenturnier
            </div>
          </button>

          <button
            onClick={() => onUpdate('sport', 'other')}
            style={sportButtonStyle(formData.sport === 'other')}
            onMouseEnter={(e) => {
              if (formData.sport !== 'other')
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              if (formData.sport !== 'other') e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏀</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: theme.colors.text.primary }}>
              SONSTIGES
            </div>
            <div style={{ fontSize: '12px', color: theme.colors.text.secondary, marginTop: '4px' }}>
              eSports, Tennis, etc.
            </div>
          </button>
        </div>
      </div>

      {/* Turniertyp wählen */}
      <div>
        <label
          style={{
            display: 'block',
            marginBottom: '12px',
            fontSize: theme.fontSizes.sm,
            color: theme.colors.text.secondary,
            fontWeight: theme.fontWeights.medium,
          }}
        >
          Turniertyp
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button
            onClick={() => onTournamentTypeChange('classic')}
            style={typeButtonStyle(formData.tournamentType === 'classic')}
            onMouseEnter={(e) => {
              if (formData.tournamentType !== 'classic')
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              if (formData.tournamentType !== 'classic')
                e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚽</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: theme.colors.text.primary }}>
              KLASSISCHES TURNIER
            </div>
            <div
              style={{
                fontSize: '12px',
                color: theme.colors.text.secondary,
                marginTop: '6px',
                lineHeight: '1.4',
              }}
            >
              • Tabellenplatzierung
              <br />
              • Finalrunden möglich
              <br />• Normale Torzählung
            </div>
          </button>

          <button
            onClick={() => onTournamentTypeChange('bambini')}
            style={typeButtonStyle(formData.tournamentType === 'bambini', true)}
            onMouseEnter={(e) => {
              if (formData.tournamentType !== 'bambini')
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              if (formData.tournamentType !== 'bambini')
                e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>👶</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: theme.colors.text.primary }}>
              BAMBINI-TURNIER
            </div>
            <div
              style={{
                fontSize: '12px',
                color: theme.colors.text.secondary,
                marginTop: '6px',
                lineHeight: '1.4',
              }}
            >
              • Spielfreude im Fokus
              <br />
              • Ohne Tabellen/Ergebnisse
              <br />• Nur Sieg/Unentsch./Nied.
            </div>
          </button>
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
