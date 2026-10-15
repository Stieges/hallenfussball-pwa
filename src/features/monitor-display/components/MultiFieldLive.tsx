import { useCallback, useState } from 'react';
import type { CSSProperties } from 'react';
import { cssVars, displayEffects, displayList, monitorThemes } from '../../../design-tokens';
import type { Match, Team, Tournament } from '../../../types/tournament';
import type { MonitorTheme } from '../../../types/monitor';
import { MatchTimer } from '../../../components/monitor/MatchTimer';
import { TeamNameDisplay } from '../../../components/monitor/TeamNameDisplay';
import { TEAM_NAME_ZEILENHOEHE, gemeinsameNamenGroesse } from '../../../components/monitor/teamNameFit';
import { getFieldDisplayName } from '../../../utils/displayNames';
import { resolveTheme } from '../monitorDisplayHelpers';
import { toLiveMatch } from '../monitorMatch';

interface MultiFieldLiveProps {
  matches: readonly Match[];
  teams: Team[];
  tournament: Tournament;
  theme: MonitorTheme;
  /** Kindermodus: ohne Stand */
  hideScore: boolean;
}

const M = displayList.multiField;

function FieldCard({ match, teams, tournament, theme, hideScore }: Omit<MultiFieldLiveProps, 'matches'> & { match: Match }) {
  const colors = monitorThemes[resolveTheme(theme)];
  const live = toLiveMatch(match, teams, tournament);
  // gleiche Namensgröße beider Teams (@ZM-087, B3)
  const [px, setPx] = useState<{ home?: number; away?: number }>({});
  const onHome = useCallback((v: number) => setPx(p => (p.home === v ? p : { ...p, home: v })), []);
  const onAway = useCallback((v: number) => setPx(p => (p.away === v ? p : { ...p, away: v })), []);
  const shared = gemeinsameNamenGroesse(px.home, px.away);
  const nameBox: CSSProperties = { width: '100%', minHeight: `calc(${M.name} * ${TEAM_NAME_ZEILENHOEHE * M.nameLines})`, display: 'flex', alignItems: 'center' };

  return (
    <div
      data-testid="monitor-multi-field-card"
      style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: M.gap,
        padding: M.padding,
        boxSizing: 'border-box',
        background: colors.surface,
        borderRadius: cssVars.borderRadius.lg,
        border: `${cssVars.borderWidth.thin} solid ${colors.border}`,
        boxShadow: displayEffects.cardShadow,
      }}
    >
      <div style={{ fontSize: M.info, color: colors.textSecondary, fontWeight: cssVars.fontWeights.semibold }}>
        {getFieldDisplayName(match.field, tournament)}
      </div>
      <div style={nameBox}>
        <TeamNameDisplay name={live.homeTeam.name} size="xl" theme={theme} fontSize={M.name} sizePx={shared} onFitPx={onHome} />
      </div>
      {!hideScore && (
        <div data-testid="multi-field-score" style={{
          fontSize: M.score,
          lineHeight: 1,
          fontWeight: cssVars.fontWeights.bold,
          fontVariantNumeric: 'tabular-nums',
          color: colors.text,
        }}>
          {live.homeScore} : {live.awayScore}
        </div>
      )}
      <div style={nameBox}>
        <TeamNameDisplay name={live.awayTeam.name} size="xl" theme={theme} fontSize={M.name} sizePx={shared} onFitPx={onAway} />
      </div>
      <MatchTimer
          elapsedSeconds={live.elapsedSeconds}
          durationSeconds={live.durationSeconds}
          status={live.status}
          size="xl"
          showProgress={false}
          timerStartTime={live.timerStartTime}
          timerElapsedSeconds={live.timerElapsedSeconds}
          theme={theme}
        />
    </div>
  );
}

/** Live-Folie ohne eigenes Feld: alle laufenden Spiele nebeneinander, bis zu vier (B-44b, F2). */
export function MultiFieldLive({ matches, teams, tournament, theme, hideScore }: MultiFieldLiveProps) {
  const shown = matches.slice(0, M.maxCards);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
      gap: M.gap,
      width: '100%',
      alignItems: 'stretch',
    }}>
      {shown.map(match => (
        <FieldCard key={match.id} match={match} teams={teams} tournament={tournament} theme={theme} hideScore={hideScore} />
      ))}
    </div>
  );
}
