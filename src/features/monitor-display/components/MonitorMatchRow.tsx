import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayList, displayMonitor, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MatchView } from '../../../core/view';
import type { MonitorTheme } from '../../../types/monitor';
import { getFieldDisplayName } from '../../../utils/displayNames';
import { resultFigures, tableResultExtra, tableResultExtraTerms } from '../../../components/schedule/matchResult';
import { resolveTheme } from '../monitorDisplayHelpers';
import { monitorSideLabel } from '../matchSides';
import { monitorBadgeTone } from '../../../components/ui/molecules/matchStatusBadgeStyle';
import type { ListColumns } from '../listRows';
import { MonitorTimeCell } from './MonitorTimeCell';

interface MonitorMatchRowProps {
  /** Das Spiel der Ansicht: Status, Seitentexte, Anstoß und Endstand kommen von dort (A-36c). */
  match: MatchView;
  tournament: Tournament;
  theme: MonitorTheme;
  /** Ergebnis anzeigen (Spielplan, f3); die Folie „Nächste Spiele“ zeigt nie ein Ergebnis. */
  showScore?: boolean;
  /**
   * Zusatzzeilen der ganzen Folie (@ZM-187, @ZM-189): Zustand (Spielplan) und Feld (Nächste Spiele bei mehreren Feldern) stehen unter der
   * Uhrzeit, in jeder Zeile der Folie oder in keiner; es gibt keine eigenen Spalten dafür.
   */
  columns: ListColumns;
}

/** Eine Zeile einer Spielliste: Uhrzeit, Feld, Paarung, Stand und Zusätze an festen Stellen (@ZM-187). */
export function MonitorMatchRow({ match, tournament, theme, showScore = false, columns }: MonitorMatchRowProps) {
  const { t } = useTranslation(['tournament', 'sport']);
  const colors = monitorThemes[resolveTheme(theme)];
  // B-44b (@ZM-125, @ZM-087): Schrift relativ zur Bildhöhe, Namen umbrechen statt zu kürzen
  const cell: CSSProperties = {
    fontSize: displayList.fontSizes.team,
    color: colors.text,
    minWidth: 0,
    overflowWrap: 'break-word',
  };
  // Endstand inkl. Strafstoß aus der Ansicht (@ZM-147): „2:2 (4:3 i. E.)“; ohne Stand „-:-“
  const figures = resultFigures(match.score, match.isLive ? 'running' : 'finished');
  const score = figures === null ? '-:-' : `${figures.goalsA}:${figures.goalsB}`;
  const scoreExtra = figures === null ? undefined : tableResultExtra(figures, t);
  // Kurzform („i. E.“, „n. V.“) immer mit ausgeschriebenem Begriff für Darüberfahren und Screenreader (@OB-075)
  const extraTerms = figures === null ? undefined : tableResultExtraTerms(figures, t);

  return (
    <div
      data-testid="monitor-match-row"
      data-match-id={match.id}
      data-status={match.status}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: displayList.cellGap,
        width: '100%',
        padding: `${displayList.rowPaddingY} ${displayList.rowPaddingX}`,
        boxSizing: 'border-box',
        background: colors.surface,
        borderRadius: displayMonitor.radius.card,
        border: `${cssVars.borderWidth.thin} solid ${colors.border}`,
      }}
    >
      <MonitorTimeCell
        match={match}
        fieldName={columns.field ? getFieldDisplayName(match.field, tournament) : undefined}
        reserveState={columns.state}
        color={colors.text}
        tone={monitorBadgeTone(colors)}
        style={{ ...cell, fontWeight: cssVars.fontWeights.semibold }}
      />
      <div data-teamname style={{ ...cell, flex: '1 1 0', textAlign: 'right' }}>{monitorSideLabel(match.home)}</div>
      <div
        data-testid="monitor-match-separator"
        style={{
          ...cell,
          flex: `0 0 ${displayList.separatorWidth}`,
          textAlign: 'center',
          fontWeight: showScore ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
          color: showScore ? colors.text : colors.textMuted,
        }}
      >
        {showScore ? score : '–'}
        {showScore && scoreExtra && (
          <div data-testid="monitor-match-extra" title={extraTerms?.long} aria-label={extraTerms?.spoken} role="note" style={{ fontSize: displayList.fontSizes.note, fontWeight: cssVars.fontWeights.normal, color: colors.textMuted, whiteSpace: 'nowrap' }}>
            {scoreExtra}
          </div>
        )}
      </div>
      <div data-teamname style={{ ...cell, flex: '1 1 0' }}>{monitorSideLabel(match.away)}</div>
    </div>
  );
}
