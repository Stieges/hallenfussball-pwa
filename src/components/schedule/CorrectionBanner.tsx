import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../design-tokens';
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
    background: colors.correctionBg,
    border: `2px solid ${colors.correctionBorder}`,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    position: 'relative',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.correctionText,
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
  };

  const closeButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: colors.correctionText,
    fontSize: fontSizes.xxl,
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    transition: 'background 0.2s ease',
  };

  const contentStyle: CSSProperties = {
    fontSize: fontSizes.md,
    color: colors.correctionText,
    lineHeight: '1.6',
  };

  const matchInfoStyle: CSSProperties = {
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.sm,
  };

  const warningListStyle: CSSProperties = {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    paddingLeft: spacing.lg,
  };

  const listItemStyle: CSSProperties = {
    marginBottom: spacing.xs,
  };

  const originalScoreStyle: CSSProperties = {
    fontWeight: fontWeights.semibold,
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
            padding: ${spacing.md} !important;
            font-size: ${fontSizes.md} !important;
          }

          .correction-banner-close {
            width: 28px !important;
            height: 28px !important;
            font-size: 20px !important;
          }
        }

        .correction-banner-close:hover {
          background: ${colors.correctionBorder};
        }
      `}</style>
    </>
  );
};
