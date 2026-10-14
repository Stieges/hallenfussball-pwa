import { useTranslation } from 'react-i18next';
import { cssVars, displayEffects, displayFontSizes, displaySpacing, monitorThemes, displayMonitor } from '../../../design-tokens';
import { calculateStandings } from '../../../utils/calculations';

export type MonitorColors = (typeof monitorThemes)[keyof typeof monitorThemes];
export type StandingRows = ReturnType<typeof calculateStandings>;

interface StandingsTableProps {
  rows: StandingRows;
  themeColors: MonitorColors;
}

/** Tabelle einer Gruppe (Kopf und Zeilen), wie sie am Monitor steht (B-16f3, Organismus). */
export function StandingsTable({ rows, themeColors }: StandingsTableProps) {
  const { t } = useTranslation('monitor');
  return (
    <div style={{
      width: '100%',
      maxWidth: displayMonitor.size.standingsMaxWidth,
      background: themeColors.surface,
      borderRadius: cssVars.borderRadius.lg,
      padding: displaySpacing.contentLG,
      boxShadow: displayEffects.cardShadow,
      border: `${cssVars.borderWidth.thin} solid ${themeColors.border}`,
    }}>
      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: displayMonitor.size.standingsColumns,
        gap: displaySpacing.inlineMD,
        padding: `${displaySpacing.contentSM} ${displaySpacing.contentMD}`,
        borderBottom: `${cssVars.borderWidth.thin} solid ${themeColors.border}`,
        fontSize: displayFontSizes.bodySM,
        color: themeColors.textMuted,
        fontWeight: cssVars.fontWeights.medium,
      }}>
        <div>{t('standings.header.rank')}</div>
        <div>{t('standings.header.team')}</div>
        <div style={{ textAlign: 'center' }}>{t('standings.header.won')}</div>
        <div style={{ textAlign: 'center' }}>{t('standings.header.drawn')}</div>
        <div style={{ textAlign: 'center' }}>{t('standings.header.lost')}</div>
        <div style={{ textAlign: 'center' }}>{t('standings.header.goalDiff')}</div>
        <div style={{ textAlign: 'center' }}>{t('standings.header.points')}</div>
      </div>

      {/* Table Rows */}
      {rows.map((row, idx) => (
        <div
          key={row.team.id}
          style={{
            display: 'grid',
            gridTemplateColumns: displayMonitor.size.standingsColumns,
            gap: displaySpacing.inlineMD,
            padding: `${displaySpacing.contentMD} ${displaySpacing.contentMD}`,
            borderBottom: idx < rows.length - 1 ? `${cssVars.borderWidth.thin} solid ${themeColors.border}` : 'none',
            fontSize: displayFontSizes.bodyLG,
            color: themeColors.text,
          }}
        >
          <div style={{ fontWeight: cssVars.fontWeights.semibold }}>{idx + 1}</div>
          <div style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {row.team.name}
          </div>
          <div style={{ textAlign: 'center', color: themeColors.progressBar }}>{row.won}</div>
          <div style={{ textAlign: 'center', color: themeColors.textSecondary }}>{row.drawn}</div>
          <div style={{ textAlign: 'center', color: themeColors.progressBarWarning }}>{row.lost}</div>
          <div style={{
            textAlign: 'center',
            color: row.goalDifference > 0
              ? themeColors.progressBar
              : row.goalDifference < 0
                ? themeColors.progressBarWarning
                : themeColors.textSecondary,
          }}>
            {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
          </div>
          <div style={{
            textAlign: 'center',
            fontWeight: cssVars.fontWeights.bold,
            color: themeColors.score,
          }}>
            {row.points}
          </div>
        </div>
      ))}
    </div>
  );
}
