import { useTranslation } from 'react-i18next';
import { cssVars, displayEffects, displayList, monitorThemes } from '../../../design-tokens';
import { calculateStandings } from '../../../utils/calculations';
import { monitorTeamName } from '../../../core/models/teamNameAbbrev';
import { publicTieMarkOf, type GroupTieView } from '../../../core/standings/tieViews';
import { MonitorTieMark } from './MonitorTieMark';
import { ShortLabel } from '../../../components/ui/atoms';

export type MonitorColors = (typeof monitorThemes)[keyof typeof monitorThemes];
export type StandingRows = ReturnType<typeof calculateStandings>;

interface StandingsTableProps {
  rows: StandingRows;
  themeColors: MonitorColors;
  /** Gleichstände der Gruppe (@W2A-059): offene Blöcke bekommen eine kurze Markierung hinter dem Namen. */
  tie?: GroupTieView;
}

/** Tabelle einer Gruppe (Kopf und Zeilen), wie sie am Monitor steht (B-16f3, Organismus). */
export function StandingsTable({ rows, themeColors, tie }: StandingsTableProps) {
  const { t } = useTranslation('monitor');
  // B-44b (@ZM-125, @ZM-087): Schrift relativ zur Bildhöhe, Namen umbrechen statt zu kürzen, Inhalt nutzt die Breite
  const grid = {
    display: 'grid',
    gridTemplateColumns: displayList.standingsColumns,
    gap: displayList.cellGap,
    alignItems: 'center',
  } as const;
  const number = { textAlign: 'center' } as const;
  // @ZM-198: Vor dem ersten gespielten Spiel der Tabelle steht bei allen Teams „–“ statt „1“ (die Reihenfolge bleibt die der Teilnehmerliste)
  const ohnePlatz = rows.every((row) => row.played === 0);
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
        <div><ShortLabel term="rank" /></div>
        <div>{t('standings.header.team')}</div>
        <div style={number}><ShortLabel term="won" /></div>
        <div style={number}><ShortLabel term="drawn" /></div>
        <div style={number}><ShortLabel term="lost" /></div>
        <div style={number}><ShortLabel term="goalDifference" /></div>
        <div style={number}><ShortLabel term="points" /></div>
      </div>

      {/* Table Rows: Farbe nur mit Bedeutung – Punkte und Tordifferenz; Siege, Unentschieden, Niederlagen neutral */}
      {rows.map((row, idx) => {
        const mark = tie === undefined ? undefined : publicTieMarkOf(tie, row.team.id);
        return (
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
            <div style={{ fontWeight: cssVars.fontWeights.semibold }}>{ohnePlatz ? '–' : row.place ?? idx + 1}</div>
            <div data-teamname style={{ fontSize: displayList.fontSizes.team, minWidth: 0, overflowWrap: 'break-word' }}>
              {monitorTeamName(row.team.name)}
              {mark !== undefined && <MonitorTieMark mark={mark} themeColors={themeColors} />}
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
        );
      })}
    </div>
  );
}
