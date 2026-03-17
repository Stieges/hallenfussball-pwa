import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, mediaQueries } from '../../design-tokens'
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
  const { t } = useTranslation('tournament');
  const containerStyle: CSSProperties = {
    background: cssVars.colors.correctionBg,
    border: `2px solid ${cssVars.colors.correctionBorder}`,
    borderRadius: cssVars.borderRadius.md,
    padding: cssVars.spacing.lg,
    marginBottom: cssVars.spacing.lg,
    position: 'relative',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: cssVars.spacing.md,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.correctionText,
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const closeButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: cssVars.colors.correctionText,
    fontSize: cssVars.fontSizes.xxl,
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: cssVars.borderRadius.sm,
    transition: 'background 0.2s ease',
  };

  const contentStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.correctionText,
    lineHeight: '1.6',
  };

  const matchInfoStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.semibold,
    marginBottom: cssVars.spacing.sm,
  };

  const warningListStyle: CSSProperties = {
    marginTop: cssVars.spacing.md,
    marginBottom: cssVars.spacing.md,
    paddingLeft: cssVars.spacing.lg,
  };

  const listItemStyle: CSSProperties = {
    marginBottom: cssVars.spacing.xs,
  };

  const originalScoreStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.semibold,
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
            <span>{t('correction.modeActive')}</span>
          </div>
          <button
            style={closeButtonStyle}
            onClick={onCancel}
            title={t('correction.cancel')}
            aria-label={t('correction.cancel')}
            className="correction-banner-close"
          >
            ×
          </button>
        </div>

        <div style={contentStyle}>
          <div style={matchInfoStyle}>
            {t('correction.correcting', { matchLabel, teamA, teamB })}
          </div>

          <div style={warningListStyle}>
            <div style={listItemStyle}>
              <span aria-hidden="true">⚠️</span> <strong>{t('correction.warning')}</strong> {t('correction.warningText')}
            </div>
            <div style={listItemStyle}>
              {t('correction.recalcStandings')}
            </div>
            <div style={listItemStyle}>
              {t('correction.playoffChange')}
            </div>
            <div style={listItemStyle}>
              {t('correction.finalsUnchanged')}
            </div>
          </div>

          <div style={originalScoreStyle}>
            {t('correction.originalScore', { scoreA: originalScoreA, scoreB: originalScoreB })}
          </div>
        </div>
      </div>

      <style>{`
        ${mediaQueries.tabletDown} {
          .correction-banner {
            padding: ${cssVars.spacing.md} !important;
            font-size: ${cssVars.fontSizes.md} !important;
          }

          .correction-banner-close {
            width: 28px !important;
            height: 28px !important;
            font-size: 20px !important;
          }
        }

        .correction-banner-close:hover,
        .correction-banner-close:active {
          background: ${cssVars.colors.correctionBorder};
        }
      `}</style>
    </>
  );
};
