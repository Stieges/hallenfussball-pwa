import type { CSSProperties } from 'react';
import { cssVars, displayList, displayMonitor, monitorThemes } from '../../../design-tokens';
import type { Match, Team, Tournament } from '../../../types/tournament';
import type { MonitorTheme } from '../../../types/monitor';
import { formatTime } from '../../../core/generators/scheduleHelpers';
import { getFieldDisplayName } from '../../../utils/displayNames';
import { resolveTheme } from '../monitorDisplayHelpers';

type MonitorColors = (typeof monitorThemes)[keyof typeof monitorThemes];
import { sideLabel } from '../matchSides';

interface MonitorMatchRowProps {
  match: Match;
  teams: Team[];
  tournament: Tournament;
  theme: MonitorTheme;
  /** Kindermodus (@W2A-031): true = offener Platz zeigt „noch offen“. */
  hidePendingOrigin: boolean;
  /** Ergebnis anzeigen (Spielplan, f3); die Folie „Nächste Spiele“ zeigt nie ein Ergebnis. */
  showScore?: boolean;
  /** Statuspunkt vorn und Rahmen für ein laufendes Spiel (Spielplan, B-16f3); Standard aus. */
  showStatus?: boolean;
}

/** Uhrzeit des Spiels als HH:MM; fehlt sie oder ist sie unlesbar, ein Strich. */
function kickoffText(match: Match): string {
  if (match.scheduledTime === undefined || match.scheduledTime === null) { return '–'; }
  const date = new Date(match.scheduledTime);
  return Number.isNaN(date.getTime()) ? '–' : formatTime(date);
}

/** Eine Zeile einer Spielliste: Uhrzeit, Feld, Paarung (optional Ergebnis und Bezeichnung). */
function statusColor(match: Match, colors: MonitorColors): string {
  switch (match.matchStatus) {
    case 'running': return colors.liveDot;
    case 'finished': return colors.progressBar;
    default: return colors.textMuted;
  }
}

export function MonitorMatchRow({ match, teams, tournament, theme, hidePendingOrigin, showScore = false, showStatus = false }: MonitorMatchRowProps) {
  const colors = monitorThemes[resolveTheme(theme)];
  const running = showStatus && match.matchStatus === 'running';
  const ctx = { teams, hidePendingOrigin };
  // B-44b (@ZM-125, @ZM-087): Schrift relativ zur Bildhöhe, Namen umbrechen statt zu kürzen
  const cell: CSSProperties = {
    fontSize: displayList.fontSizes.team,
    color: colors.text,
    minWidth: 0,
    overflowWrap: 'break-word',
  };
  const score = match.scoreA !== undefined && match.scoreB !== undefined ? `${match.scoreA}:${match.scoreB}` : '-:-';

  return (
    <div
      data-testid="monitor-match-row"
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
        {kickoffText(match)}
      </div>
      <div style={{ ...cell, color: colors.textMuted, flex: `0 0 ${displayList.fieldWidth}` }}>
        {getFieldDisplayName(match.field, tournament)}
      </div>
      <div style={{ ...cell, flex: '1 1 0', textAlign: 'right' }}>{sideLabel(match, 'A', ctx)}</div>
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
      </div>
      <div style={{ ...cell, flex: '1 1 0' }}>{sideLabel(match, 'B', ctx)}</div>
      {match.label && (
        <div style={{ ...cell, color: colors.textMuted, flex: '0 1 auto', maxWidth: '25%' }}>{match.label}</div>
      )}
    </div>
  );
}
