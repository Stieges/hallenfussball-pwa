import { useTranslation } from 'react-i18next';
import { cssVars, displayEffects, displayList, displayMonitor, monitorThemes } from '../../../design-tokens';
import { calculateStandings } from '../../../utils/calculations';
import { monitorTeamName } from '../../../core/models/teamNameAbbrev';
import { publicTieMarkOf, type GroupTieView } from '../../../core/standings/tieViews';
import { MonitorTieMark } from './MonitorTieMark';
import { useFitFont } from '../useFitFont';
import { ShortLabel } from '../../../components/ui/atoms';
import { SlashBreaks } from '../../../components/ui/atoms/TeamName';
import { hyphenWordStaysTogether } from '../listRows';
import { standingsCharsPerLine } from '../standingsFit';
import { placeLabel } from '../../../core/standings/placeLabel';
import { goalDiffLabel } from '../../../core/standings/goalDiffLabel';

export type MonitorColors = (typeof monitorThemes)[keyof typeof monitorThemes];
export type StandingRows = ReturnType<typeof calculateStandings>;

interface StandingsTableProps {
  rows: StandingRows;
  themeColors: MonitorColors;
  /** Gleichstände der Gruppe (@W2A-059): offene Blöcke bekommen eine kurze Markierung hinter dem Namen. */
  tie?: GroupTieView;
  /** Zeilenschrift als CSS-Wert in vh (`standingsFontSize`, @ZM-125): wächst bei wenigen Zeilen, bleibt bei vielen mindestens 3 % der Bildhöhe. */
  fontSize?: string;
  /** Wirksamer Bildrand in Prozent (@ME-067): Die gezeichnete Tabelle bleibt über dem unteren Rand (`useFitFont`). */
  overscanPercent?: number;
}

/** Tabelle einer Gruppe (Kopf und Zeilen), wie sie am Monitor steht (B-16f3, Organismus). */
export function StandingsTable({ rows, themeColors, tie, fontSize: modelSize = displayList.fontSizes.team, overscanPercent = displayMonitor.overscan.defaultPercent }: StandingsTableProps) {
  const { t } = useTranslation('monitor');
  // Startwert aus dem Höhenmodell; die gezeichnete Tabelle darf ihn nur verkleinern, bis sie ins Bild passt (@ZM-129)
  const { ref, fontSize } = useFitFont(parseFloat(modelSize), parseFloat(displayList.standings.fontMin), overscanPercent);
  // @ZM-188: ein Wort mit Bindestrich („Nordheim-Süd“) bleibt zusammen, solange es in die Namensspalte passt (dieselbe Rechnung wie das Höhenmodell)
  const perLine = standingsCharsPerLine(parseFloat(fontSize), overscanPercent);
  // B-44b (@ZM-125, @ZM-087): Schrift relativ zur Bildhöhe, Namen umbrechen statt zu kürzen, Inhalt nutzt die Breite
  const grid = {
    display: 'grid',
    gridTemplateColumns: displayList.standingsColumns,
    gap: displayList.standings.cellGap,
    alignItems: 'center',
    lineHeight: displayList.standings.lineHeight,
  } as const;
  // overflowWrap: Zahlen und Kürzel stehen in schmalen Spalten; sehr lange Inhalte brechen um, statt in die Nachbarspalte zu ragen
  const number = { textAlign: 'center', minWidth: 0, overflowWrap: 'anywhere' } as const;
  // @ZM-198: Vor dem ersten gespielten Spiel steht bei allen Teams „–“ statt „1“ (`placeLabel`, dieselbe Logik wie auf der Zuschauer-Seite)
  return (
    <div ref={ref} style={{
      width: '100%',
      boxSizing: 'border-box',
      background: themeColors.surface,
      borderRadius: cssVars.borderRadius.lg,
      padding: displayList.standings.cardPadding,
      fontSize,
      boxShadow: displayEffects.cardShadow,
      border: `${cssVars.borderWidth.thin} solid ${themeColors.border}`,
    }}>
      {/* Table Header */}
      <div style={{
        ...grid,
        padding: `${displayList.standings.rowPaddingY} ${displayList.standings.rowPaddingX}`,
        borderBottom: `${cssVars.borderWidth.thin} solid ${themeColors.border}`,
        // nie unter 3 % der Bildhöhe (HART), sonst im Verhältnis zur Zeilenschrift
        fontSize: `max(${displayList.fontSizes.head}, ${String(displayList.standings.headRatio)}em)`,
        // textSecondary statt textMuted: Kontrast zum Verlauf mindestens 4,5 : 1 (textMuted 3,07 : 1, Messung kontrast.text)
        color: themeColors.textSecondary,
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
              padding: `${displayList.standings.rowPaddingY} ${displayList.standings.rowPaddingX}`,
              borderBottom: idx < rows.length - 1 ? `${cssVars.borderWidth.thin} solid ${themeColors.border}` : 'none',
              fontSize,
              color: themeColors.text,
            }}
          >
            <div style={{ fontWeight: cssVars.fontWeights.semibold }}>{placeLabel(rows, idx)}</div>
            <div data-teamname style={{ fontSize, minWidth: 0, overflowWrap: 'break-word' }}>
              <SlashBreaks text={monitorTeamName(row.team.name)} keep={(teil) => hyphenWordStaysTogether(teil, perLine)} />
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
              {goalDiffLabel(row.goalDifference)}
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
