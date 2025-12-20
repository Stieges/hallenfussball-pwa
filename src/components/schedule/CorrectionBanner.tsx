import { CSSProperties } from 'react';
import { theme } from '../../styles/theme';

export interface CorrectionBannerProps {
  matchId: string;
  matchLabel: string;
  teamA: string;
  teamB: string;
  originalScoreA: number;
  originalScoreB: number;
  onCancel: () => void;
}

export const CorrectionBanner: React.FC<CorrectionBannerProps> = ({
  matchLabel,
  teamA,
  teamB,
  originalScoreA,
  originalScoreB,
  onCancel,
}) => {
  const containerStyle: CSSProperties = {
    background: theme.colors.correction.bg,
    border: `2px solid ${theme.colors.correction.border}`,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    position: 'relative',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: theme.fontSizes.lg,
    fontWeight: theme.fontWeights.bold,
    color: theme.colors.correction.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  };

  const closeButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: theme.colors.correction.text,
    fontSize: theme.fontSizes.xxl,
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    transition: 'background 0.2s ease',
  };

  const contentStyle: CSSProperties = {
    fontSize: theme.fontSizes.md,
    color: theme.colors.correction.text,
    lineHeight: '1.6',
  };

  const matchInfoStyle: CSSProperties = {
    fontWeight: theme.fontWeights.semibold,
    marginBottom: theme.spacing.sm,
  };

  const warningListStyle: CSSProperties = {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingLeft: theme.spacing.lg,
  };

  const listItemStyle: CSSProperties = {
    marginBottom: theme.spacing.xs,
  };

  const originalScoreStyle: CSSProperties = {
    fontWeight: theme.fontWeights.semibold,
  };

  return (
    <>
      <div
        style={containerStyle}
        className="correction-banner"
        role="alert"
        aria-live="polite"
      >
        <div style={headerStyle}>
          <div style={titleStyle}>
            <span aria-hidden="true">⚠️</span>
            <span>KORREKTURMODUS AKTIV</span>
          </div>
          <button
            style={closeButtonStyle}
            onClick={onCancel}
            title="Korrektur abbrechen"
            aria-label="Korrektur abbrechen"
            className="correction-banner-close"
          >
            ×
          </button>
        </div>

        <div style={contentStyle}>
          <div style={matchInfoStyle}>
            Sie korrigieren: {matchLabel} – {teamA} vs {teamB}
          </div>

          <div style={warningListStyle}>
            <div style={listItemStyle}>
              <span aria-hidden="true">⚠️</span> <strong>ACHTUNG:</strong> Änderungen beeinflussen Tabelle und ggf. Playoff-Paarungen
            </div>
            <div style={listItemStyle}>
              • Gruppentabelle wird neu berechnet
            </div>
            <div style={listItemStyle}>
              • Playoff-Paarungen können sich ändern
            </div>
            <div style={listItemStyle}>
              • Bereits gespielte Finalrunden bleiben unverändert
            </div>
          </div>

          <div style={originalScoreStyle}>
            Ursprüngliches Ergebnis: {originalScoreA}:{originalScoreB}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .correction-banner {
            padding: ${theme.spacing.md} !important;
            font-size: ${theme.fontSizes.md} !important;
          }

          .correction-banner-close {
            width: 28px !important;
            height: 28px !important;
            font-size: 20px !important;
          }
        }

        .correction-banner-close:hover {
          background: ${theme.colors.correction.border};
        }
      `}</style>
    </>
  );
};
