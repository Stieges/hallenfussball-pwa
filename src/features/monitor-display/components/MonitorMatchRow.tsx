import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, displayList, displayMonitor, monitorThemes } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import type { MatchView } from '../../../core/view';
import type { MonitorTheme } from '../../../types/monitor';
import { getFieldDisplayName } from '../../../utils/displayNames';
import { resultFigures, tableResultExtra } from '../../../components/schedule/matchResult';
import { resolveTheme } from '../monitorDisplayHelpers';
import { monitorSideLabel } from '../matchSides';

type MonitorColors = (typeof monitorThemes)[keyof typeof monitorThemes];

interface MonitorMatchRowProps {
  /** Das Spiel der Ansicht: Status, Seitentexte, Anstoß und Endstand kommen von dort (A-36c). */
  match: MatchView;
  tournament: Tournament;
  theme: MonitorTheme;
  /** Ergebnis anzeigen (Spielplan, f3); die Folie „Nächste Spiele“ zeigt nie ein Ergebnis. */
  showScore?: boolean;
  /** Statuspunkt vorn und Rahmen für ein laufendes Spiel (Spielplan, B-16f3); Standard aus. */
  showStatus?: boolean;
}

/** Eine Zeile einer Spielliste: Uhrzeit, Feld, Paarung (optional Ergebnis und Bezeichnung). */
function statusColor(match: MatchView, colors: MonitorColors): string {
  if (match.isLive) { return colors.liveDot; }
  return match.status === 'finished' || match.status === 'awarded' ? colors.progressBar : colors.textMuted;
}

export function MonitorMatchRow({ match, tournament, theme, showScore = false, showStatus = false }: MonitorMatchRowProps) {
  const { t } = useTranslation('tournament');
  const colors = monitorThemes[resolveTheme(theme)];
  // Läuft ODER unterbrochen = live (@ZM-039): Rahmen und Punkt
  const running = showStatus && match.isLive;
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
  // „ausgefallen“ ohne Ergebnis, „gewertet“ neben dem Ergebnis (@ZM-104)
  const note = match.status === 'cancelled' || match.status === 'awarded' ? t(`view.status.${match.status}`) : undefined;

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
        background: running ? colors.surfaceHover : colors.surface,
        borderRadius: displayMonitor.radius.card,
        border: running
          ? `${displayMonitor.marker.liveBorderWidth} solid ${colors.liveDot}`
          : `${cssVars.borderWidth.thin} solid ${colors.border}`,
      }}
    >
      {showStatus && (
        <div data-testid="monitor-match-status" style={{
          width: displayList.markerSize,
          height: displayList.markerSize,
          borderRadius: cssVars.borderRadius.full,
          background: statusColor(match, colors),
          flexShrink: 0,
        }} />
      )}
      <div style={{ ...cell, fontWeight: cssVars.fontWeights.semibold, flex: `0 0 ${displayList.timeWidth}` }}>
        {match.kickoff?.time ?? '–'}
      </div>
      <div style={{ ...cell, color: colors.textMuted, flex: `0 0 ${displayList.fieldWidth}` }}>
        {getFieldDisplayName(match.field, tournament)}
      </div>
      <div data-teamname style={{ ...cell, flex: '1 1 0', textAlign: 'right' }}>{monitorSideLabel(match.home)}</div>
      <div
        data-testid="monitor-match-separator"
        style={{
          ...cell,
          flex: '0 0 auto',
          minWidth: displayList.separatorWidth,
          textAlign: 'center',
          fontWeight: showScore ? cssVars.fontWeights.bold : cssVars.fontWeights.normal,
          color: showScore ? colors.text : colors.textMuted,
        }}
      >
        {showScore ? score : '–'}
        {showScore && scoreExtra && (
          <div data-testid="monitor-match-extra" style={{ fontSize: displayList.fontSizes.head, fontWeight: cssVars.fontWeights.normal, color: colors.textMuted, whiteSpace: 'nowrap' }}>
            {scoreExtra}
          </div>
        )}
      </div>
      <div data-teamname style={{ ...cell, flex: '1 1 0' }}>{monitorSideLabel(match.away)}</div>
      {match.labelText && (
        <div style={{ ...cell, color: colors.textMuted, flex: '0 1 auto', maxWidth: displayList.labelMaxWidth }}>{match.labelText}</div>
      )}
      {note && (
        <div data-testid="monitor-match-note" style={{ ...cell, color: colors.textMuted, flex: '0 1 auto', maxWidth: displayList.labelMaxWidth }}>{note}</div>
      )}
    </div>
  );
}
