/**
 * Info-Tab der Zuschauer-Seite (B-13d1, aus LiveViewScreen ausgelagert):
 * Turnier-Details, Darstellung (Theme) und Bambini-Hinweis. Texte wörtlich übernommen.
 */
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import { Card } from '../../../components/ui/Card';
import { BaseThemeSelector } from '../../settings/components/BaseThemeSelector';
import { formatDateGerman } from '../../../utils/locationHelpers';
import type { ThemeContextValue } from '../../../hooks/useTheme';
import type { Tournament } from '../../../types/tournament';

export interface PublicInfoTabProps {
  tournament: Tournament;
  shareCode: string;
  theme: ThemeContextValue['theme'];
  setTheme: ThemeContextValue['setTheme'];
  resolvedTheme: ThemeContextValue['resolvedTheme'];
}

export const PublicInfoTab: React.FC<PublicInfoTabProps> = ({
  tournament,
  shareCode,
  theme,
  setTheme,
  resolvedTheme,
}) => {
  const { t } = useTranslation('publicView');
  return (
  <>
    <Card>
      <div style={{ padding: cssVars.spacing.lg }}>
        <h2 style={{ fontSize: cssVars.fontSizes.xl, marginBottom: cssVars.spacing.lg, color: cssVars.colors.textPrimary }}>
          {t('info.title')}
        </h2>

        {/* Tournament Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md }}>
          <div>
            <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>{t('info.name')}</span>
            <p style={{ fontSize: cssVars.fontSizes.lg, color: cssVars.colors.textPrimary }}>{tournament.title}</p>
          </div>

          {tournament.date && (
            <div>
              <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>{t('info.date')}</span>
              <p style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary }}>
                {formatDateGerman(tournament.date)}
              </p>
            </div>
          )}

          {tournament.location.name && (
            <div>
              <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>{t('info.location')}</span>
              <p style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary }}>
                {tournament.location.name}
                {tournament.location.city && `, ${tournament.location.city}`}
              </p>
            </div>
          )}

          <div>
            <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>{t('info.teams')}</span>
            <p style={{ fontSize: cssVars.fontSizes.md, color: cssVars.colors.textPrimary }}>
              {t('info.teamCount', { n: tournament.teams.length })}
            </p>
          </div>

          <div>
            <span style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>{t('info.shareCode')}</span>
            <p style={{
              fontSize: cssVars.fontSizes.xl,
              fontWeight: cssVars.fontWeights.bold,
              color: cssVars.colors.primary,
              letterSpacing: '0.1em',
            }}>
              {shareCode.toUpperCase()}
            </p>
          </div>
        </div>
      </div>
    </Card>

    {/* Theme Selection */}
    <Card>
      <div style={{ padding: cssVars.spacing.lg }}>
        <h3 style={{
          fontSize: cssVars.fontSizes.lg,
          marginBottom: cssVars.spacing.md,
          color: cssVars.colors.textPrimary,
        }}>
          {t('info.theme')}
        </h3>
        <BaseThemeSelector
          value={theme}
          onChange={setTheme}
          resolvedTheme={resolvedTheme}
        />
      </div>
    </Card>

    {/* Privacy Notice */}
    {(tournament.hideScoresForPublic || tournament.hideRankingsForPublic) && (
      <Card>
        <div
          style={{
            padding: cssVars.spacing.lg,
            background: cssVars.colors.warningLight,
            borderRadius: cssVars.borderRadius.md,
          }}
        >
          <p style={{ color: cssVars.colors.warning, fontWeight: cssVars.fontWeights.medium }}>
            {t('info.bambiTitle')}
          </p>
          <p style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm, marginTop: cssVars.spacing.xs }}>
            {tournament.hideScoresForPublic && t('info.hiddenScores')}
            {tournament.hideRankingsForPublic && t('info.hiddenRankings')}
          </p>
        </div>
      </Card>
    )}
  </>
  );
};
