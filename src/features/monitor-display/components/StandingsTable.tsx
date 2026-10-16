import { useTranslation } from 'react-i18next';
import { cssVars, displayEffects, displayList, monitorThemes } from '../../../design-tokens';
import { calculateStandings } from '../../../utils/calculations';
import { monitorTeamName } from '../teamNameAbbrev';

export type MonitorColors = (typeof monitorThemes)[keyof typeof monitorThemes];
export type StandingRows = ReturnType<typeof calculateStandings>;

interface StandingsTableProps {
  rows: StandingRows;
  themeColors: MonitorColors;
}

/** Tabelle einer Gruppe (Kopf und Zeilen), wie sie am Monitor steht (B-16f3, Organismus). */
export function StandingsTable({ rows, themeColors }: StandingsTableProps) {
  const { t } = useTranslation('monitor');
  // B-44b (@ZM-125, @ZM-087): Schrift relativ zur Bildhöhe, Namen umbrechen statt zu kürzen, Inhalt nutzt die Breite
  const grid = {
    display: 'grid',
    gridTemplateColumns: displayList.standingsColumns,
    gap: displayList.cellGap,
    alignItems: 'center',
  } as const;
  const number = { textAlign: 'center' } as const;
  return (
    <div style={{
      width: '100%',
      boxSizing: 'border-box',
      background: themeColors.surface,
      borderRadius: cssVars.borderRadius.lg,
      padding: displayList.rowPaddingX,
      boxShadow: displayEffects.cardShadow,
      border: `${cssVars.borderWidth.thin} solid ${themeColors.border}`,
    }}>
      {/* Table Header */}
      <div style={{
        ...grid,
        padding: `${displayList.rowPaddingY} ${displayList.rowPaddingX}`,
        borderBottom: `${cssVars.borderWidth.thin} solid ${themeColors.border}`,
        fontSize: displayList.fontSizes.head,
        color: themeColors.textMuted,
        fontWeight: cssVars.fontWeights.medium,
      }}>
        <div>{t('standings.header.rank')}</div>
        <div>{t('standings.header.team')}</div>
        <div style={number}>{t('standings.header.won')}</div>
        <div style={number}>{t('standings.header.drawn')}</div>
        <div style={number}>{t('standings.header.lost')}</div>
        <div style={number}>{t('standings.header.goalDiff')}</div>
        <div style={number}>{t('standings.header.points')}</div>
      </div>

      {/* Table Rows: Farbe nur mit Bedeutung – Punkte und Tordifferenz; Siege, Unentschieden, Niederlagen neutral */}
      {rows.map((row, idx) => (
        <div
          key={row.team.id}
          data-testid="standings-row"
          style={{
            ...grid,
            padding: `${displayList.rowPaddingY} ${displayList.rowPaddingX}`,
            borderBottom: idx < rows.length - 1 ? `${cssVars.borderWidth.thin} solid ${themeColors.border}` : 'none',
            fontSize: displayList.fontSizes.team,
            color: themeColors.text,
          }}
        >
          <div style={{ fontWeight: cssVars.fontWeights.semibold }}>{idx + 1}</div>
          <div data-teamname style={{ fontSize: displayList.fontSizes.team, minWidth: 0, overflowWrap: 'break-word' }}>
            {monitorTeamName(row.team.name)}
          </div>
          <div data-testid="standings-won" style={{ ...number, color: themeColors.text }}>{row.won}</div>
          <div data-testid="standings-drawn" style={{ ...number, color: themeColors.text }}>{row.drawn}</div>
          <div data-testid="standings-lost" style={{ ...number, color: themeColors.text }}>{row.lost}</div>
          <div data-testid="standings-goalDiff" style={{
            ...number,
            color: row.goalDifference > 0
              ? themeColors.progressBar
              : row.goalDifference < 0
                ? themeColors.progressBarWarning
                : themeColors.text,
          }}>
            {row.goalDifference > 0 ? '+' : ''}{row.goalDifference}
          </div>
          <div style={{
            ...number,
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
