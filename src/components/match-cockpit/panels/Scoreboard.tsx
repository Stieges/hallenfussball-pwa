/**
 * Scoreboard - Main layout container for team blocks and center controls
 *
 * MF-002: Passes timer props to CenterBlock for local calculation
 * MF-004: Adds live region for score announcements
 */

import React, { CSSProperties, useRef, useEffect } from 'react';
import { theme } from '../../../styles/theme';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { LiveMatch } from '../MatchCockpit';
import { TeamBlock } from './TeamBlock';
import { CenterBlock } from './CenterBlock';

export interface ScoreboardProps {
  match: LiveMatch;
  onGoal(matchId: string, teamId: string, delta: 1 | -1): void;
  onStart(matchId: string): void;
  onPause(matchId: string): void;
  onResume(matchId: string): void;
  onFinish(matchId: string): void;
  onOpenTimeDialog(): void;
  onOpenRestartConfirm(): void;
}

// MF-004: Screen-reader only style
const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const ScoreboardComponent: React.FC<ScoreboardProps> = ({
  match,
  onGoal,
  onStart,
  onPause,
  onResume,
  onFinish,
  onOpenTimeDialog,
  onOpenRestartConfirm,
}) => {
  const isMobile = useIsMobile();

  // MF-004: Track previous scores for announcements
  const prevScoreRef = useRef({ home: match.homeScore, away: match.awayScore });
  const announceRef = useRef<HTMLDivElement>(null);

  // MF-004: Announce score changes
  useEffect(() => {
    const prevHome = prevScoreRef.current.home;
    const prevAway = prevScoreRef.current.away;

    if (match.homeScore !== prevHome || match.awayScore !== prevAway) {
      // Score changed - update announcement
      if (announceRef.current) {
        announceRef.current.textContent =
          `Spielstand: ${match.homeTeam.name} ${match.homeScore} zu ${match.awayScore} ${match.awayTeam.name}`;
      }
      prevScoreRef.current = { home: match.homeScore, away: match.awayScore };
    }
  }, [match.homeScore, match.awayScore, match.homeTeam.name, match.awayTeam.name]);

  const scoreboardStyle: CSSProperties = {
    marginTop: theme.spacing.sm,
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '1.4fr auto 1.4fr',
    gap: isMobile ? theme.spacing.md : theme.spacing.sm,
    alignItems: 'center',
  };

  // MF-002: CenterBlock bekommt timer-spezifische Props
  const centerBlockProps = {
    matchId: match.id,
    timerStartTime: match.timerStartTime,
    timerElapsedSeconds: match.timerElapsedSeconds ?? match.elapsedSeconds,
    durationSeconds: match.durationSeconds,
    status: match.status,
    phaseLabel: match.phaseLabel,
    awaitingTiebreakerChoice: match.awaitingTiebreakerChoice,
    onStart: () => onStart(match.id),
    onPause: () => onPause(match.id),
    onResume: () => onResume(match.id),
    onFinish: () => onFinish(match.id),
    onOpenTimeDialog,
    onOpenRestartConfirm,
  };

  return (
    <div style={scoreboardStyle}>
      {/* MF-004: Live region for score announcements */}
      <div
        ref={announceRef}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        style={srOnlyStyle}
      />

      {isMobile ? (
        <>
          {/* MOBILE: CENTER FIRST */}
          <CenterBlock {...centerBlockProps} />

          {/* HOME TEAM */}
          <TeamBlock
            label="Heim"
            team={match.homeTeam}
            score={match.homeScore}
            status={match.status}
            awaitingTiebreakerChoice={match.awaitingTiebreakerChoice}
            onGoal={(delta) => onGoal(match.id, match.homeTeam.id, delta)}
          />

          {/* AWAY TEAM */}
          <TeamBlock
            label="Gast"
            team={match.awayTeam}
            score={match.awayScore}
            status={match.status}
            awaitingTiebreakerChoice={match.awaitingTiebreakerChoice}
            onGoal={(delta) => onGoal(match.id, match.awayTeam.id, delta)}
          />
        </>
      ) : (
        <>
          {/* DESKTOP: HOME - CENTER - AWAY */}
          <TeamBlock
            label="Heim"
            team={match.homeTeam}
            score={match.homeScore}
            status={match.status}
            awaitingTiebreakerChoice={match.awaitingTiebreakerChoice}
            onGoal={(delta) => onGoal(match.id, match.homeTeam.id, delta)}
          />

          <CenterBlock {...centerBlockProps} />

          <TeamBlock
            label="Gast"
            team={match.awayTeam}
            score={match.awayScore}
            status={match.status}
            awaitingTiebreakerChoice={match.awaitingTiebreakerChoice}
            onGoal={(delta) => onGoal(match.id, match.awayTeam.id, delta)}
            align="right"
          />
        </>
      )}
    </div>
  );
};

// MF-002: React.memo für Performance-Optimierung
export const Scoreboard = React.memo(ScoreboardComponent);
