/**
 * MatchCockpit - Admin Cockpit für Live-Spielverwaltung
 *
 * WICHTIG: Reine Präsentationskomponente!
 * - Alle Daten kommen über Props
 * - Keine API-Calls, kein fetch, kein axios
 * - Nur Callbacks nach oben
 * - Keine Geschäftslogik (außer Formatierung)
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, shadows, spacing } from '../../design-tokens';
import { useIsMobile } from '../../hooks/useIsMobile';
import { CurrentMatchPanel } from './CurrentMatchPanel';
import { UpcomingMatchesSidebar } from './UpcomingMatchesSidebar';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export interface Team {
  id: string;
  name: string;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  timestampSeconds: number;
  type: 'GOAL' | 'RESULT_EDIT' | 'STATUS_CHANGE' | 'YELLOW_CARD' | 'RED_CARD' | 'TIME_PENALTY' | 'SUBSTITUTION' | 'FOUL';
  payload: {
    teamId?: string;
    teamName?: string; // DEF-004: Add team name for display
    direction?: 'INC' | 'DEC';
    newHomeScore?: number;
    newAwayScore?: number;
    toStatus?: MatchStatus;
    /** Spieler-Rückennummer (Torschütze, Karte, Strafe) */
    playerNumber?: number;
    /** @deprecated Use assists array instead */
    assistPlayerNumber?: number;
    /** Rückennummern der Vorlagengeber (max 2) */
    assists?: number[];
    /** Dauer der Zeitstrafe in Sekunden (default: 120) */
    penaltyDuration?: number;
    /** @deprecated Use playersOut array instead */
    playerOutNumber?: number;
    /** @deprecated Use playersIn array instead */
    playerInNumber?: number;
    /** Rückennummern der ausgewechselten Spieler */
    playersOut?: number[];
    /** Rückennummern der eingewechselten Spieler */
    playersIn?: number[];
    /** Kartentyp für Karten-Events */
    cardType?: 'YELLOW' | 'RED';
  };
  scoreAfter: {
    home: number;
    away: number;
  };
  /** Event wurde ohne Details erfasst - muss nachgetragen werden */
  incomplete?: boolean;
}

/** Current phase of play within a match */
export type MatchPlayPhase = 'regular' | 'overtime' | 'goldenGoal' | 'penalty';

export interface LiveMatch {
  id: string;
  number: number;
  phaseLabel: string;
  fieldId: string;
  scheduledKickoff: string;
  durationSeconds: number;
  refereeName?: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  elapsedSeconds: number;
  events: MatchEvent[];

  // DEF-005: Timer persistence fields
  timerStartTime?: string;
  timerPausedAt?: string;
  timerElapsedSeconds?: number;

  // Tournament phase (groupStage, semifinal, final, etc.)
  tournamentPhase?: 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final';

  // Tiebreaker fields for finals matches
  playPhase?: MatchPlayPhase;           // Current phase: regular, overtime, goldenGoal, penalty
  overtimeScoreA?: number;              // Goals in overtime (home)
  overtimeScoreB?: number;              // Goals in overtime (away)
  overtimeDurationSeconds?: number;     // Duration of overtime in seconds
  overtimeElapsedSeconds?: number;      // Elapsed time in overtime
  penaltyScoreA?: number;               // Penalty score (home)
  penaltyScoreB?: number;               // Penalty score (away)
  tiebreakerMode?: 'shootout' | 'overtime-then-shootout' | 'goldenGoal'; // From tournament config
  awaitingTiebreakerChoice?: boolean;   // True when match ended in draw, waiting for tiebreaker
}

export interface MatchSummary {
  id: string;
  number: number;
  phaseLabel: string;
  scheduledKickoff: string;
  fieldId: string;
  homeTeam: Team;
  awayTeam: Team;
  /** Tournament phase for detecting phase changes (group → finals) */
  tournamentPhase?: 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final';
}

export interface MatchCockpitProps {
  fieldName: string;
  tournamentName: string;

  currentMatch: LiveMatch | null;
  lastFinishedMatch?: {
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  } | null;
  upcomingMatches: MatchSummary[];
  highlightNextMatchMinutesBefore?: number;

  onStart(matchId: string): void;
  onPause(matchId: string): void;
  onResume(matchId: string): void;
  onFinish(matchId: string): void;
  onGoal(matchId: string, teamId: string, delta: 1 | -1): void;
  onUndoLastEvent(matchId: string): void;
  onManualEditResult(matchId: string, newHomeScore: number, newAwayScore: number): void;
  onAdjustTime(matchId: string, newElapsedSeconds: number): void;

  onLoadNextMatch(fieldId: string): void;
  onReopenLastMatch(fieldId: string): void;

  // Tiebreaker callbacks
  onStartOvertime?(matchId: string): void;
  onStartGoldenGoal?(matchId: string): void;
  onStartPenaltyShootout?(matchId: string): void;
  onRecordPenaltyResult?(matchId: string, homeScore: number, awayScore: number): void;
  onForceFinish?(matchId: string): void;
  onCancelTiebreaker?(matchId: string): void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MatchCockpit: React.FC<MatchCockpitProps> = ({
  fieldName,
  tournamentName,
  currentMatch,
  lastFinishedMatch,
  upcomingMatches,
  highlightNextMatchMinutesBefore = 5,
  onStart,
  onPause,
  onResume,
  onFinish,
  onGoal,
  onUndoLastEvent,
  onManualEditResult,
  onAdjustTime,
  onLoadNextMatch,
  onReopenLastMatch,
  // Tiebreaker callbacks
  onStartOvertime,
  onStartGoldenGoal,
  onStartPenaltyShootout,
  onRecordPenaltyResult,
  onForceFinish,
  onCancelTiebreaker,
}) => {
  const isMobile = useIsMobile();

  const containerStyle: CSSProperties = {
    width: '100%',
    maxWidth: '1080px',
    margin: '0 auto',
    padding: isMobile ? spacing.md : spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? spacing.md : spacing.lg,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: isMobile ? spacing.sm : spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: isMobile ? spacing.md : `${spacing.md} ${spacing.lg}`,
    background: 'rgba(15, 23, 42, 0.96)',
    borderRadius: isMobile ? borderRadius.lg : '999px',
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.lg,
    backdropFilter: 'blur(18px)',
  };

  const headerLeftStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: isMobile ? '1 1 100%' : '0 1 auto',
  };

  const tournamentNameStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.sm : fontSizes.md,
    fontWeight: fontWeights.semibold,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: colors.textSecondary,
  };

  const fieldNameStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.lg : fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.textPrimary,
  };

  const mainLayoutStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2.1fr) minmax(0, 1.4fr)',
    gap: isMobile ? spacing.md : spacing.lg,
  };

  const nextMatch = upcomingMatches[0];

  // Calculate remaining time in current match (for "prepare next match" warning)
  const remainingMinutes = currentMatch?.status === 'RUNNING'
    ? Math.max(0, Math.floor((currentMatch.durationSeconds - currentMatch.elapsedSeconds) / 60))
    : null;

  // Check if there's a phase change between current and next match
  // (e.g., group stage → finals = don't show warning, teams have a longer break)
  const isPhaseChange = currentMatch?.tournamentPhase && nextMatch.tournamentPhase
    ? currentMatch.tournamentPhase !== nextMatch.tournamentPhase
    : false;

  // Show warning if:
  // 1. Match is running AND remaining time <= threshold
  // 2. AND no phase change (group → finals has a longer break)
  const showRemainingTimeWarning =
    remainingMinutes !== null &&
    remainingMinutes <= highlightNextMatchMinutesBefore &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check: upcomingMatches[0] can be undefined
    nextMatch &&
    !isPhaseChange;

  return (
    <div style={containerStyle}>
      {/* HEADER */}
      <header style={headerStyle}>
        <div style={headerLeftStyle}>
          <div style={tournamentNameStyle}>{tournamentName}</div>
          <div style={fieldNameStyle}>{fieldName} – Kampfgericht Cockpit</div>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusChip
            status={currentMatch?.status ?? 'NOT_STARTED'}
            phaseLabel={currentMatch?.phaseLabel ?? ''}
          />
          {/* Show warning based on remaining time in current match (not scheduled time) */}
          {showRemainingTimeWarning && (
            <WarningChip message={`Noch ${remainingMinutes} Min – Nächstes Spiel vorbereiten!`} />
          )}
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main style={mainLayoutStyle}>
        {/* CURRENT MATCH PANEL */}
        <CurrentMatchPanel
          currentMatch={currentMatch}
          lastFinishedMatch={lastFinishedMatch}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onFinish={onFinish}
          onGoal={onGoal}
          onUndoLastEvent={onUndoLastEvent}
          onManualEditResult={onManualEditResult}
          onAdjustTime={onAdjustTime}
          onLoadNextMatch={onLoadNextMatch}
          onReopenLastMatch={onReopenLastMatch}
          // Tiebreaker callbacks
          onStartOvertime={onStartOvertime}
          onStartGoldenGoal={onStartGoldenGoal}
          onStartPenaltyShootout={onStartPenaltyShootout}
          onRecordPenaltyResult={onRecordPenaltyResult}
          onForceFinish={onForceFinish}
          onCancelTiebreaker={onCancelTiebreaker}
        />

        {/* UPCOMING MATCHES SIDEBAR */}
        <UpcomingMatchesSidebar
          upcomingMatches={upcomingMatches}
          highlightMinutesBefore={highlightNextMatchMinutesBefore}
          fieldName={fieldName}
          highlightFirstMatch={showRemainingTimeWarning}
        />
      </main>
    </div>
  );
};

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatusChipProps {
  status: MatchStatus;
  phaseLabel: string;
}

const StatusChip: React.FC<StatusChipProps> = ({ status, phaseLabel }) => {
  const isMobile = useIsMobile();

  const chipStyle: CSSProperties = {
    padding: isMobile ? `8px ${spacing.md}` : `6px ${spacing.md}`,
    borderRadius: '999px',
    border: `1px solid ${colors.border}`,
    fontSize: isMobile ? fontSizes.xs : fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(15, 23, 42, 0.85)',
  };

  const dotStyle: CSSProperties = {
    width: isMobile ? '6px' : '8px',
    height: isMobile ? '6px' : '8px',
    borderRadius: '999px',
    background: colors.primary,
    boxShadow: `0 0 8px ${colors.primary}`,
  };

  const getStatusText = () => {
    switch (status) {
      case 'RUNNING':
        return 'Läuft';
      case 'PAUSED':
        return 'Pausiert';
      case 'FINISHED':
        return 'Beendet';
      default:
        return 'Bereit';
    }
  };

  return (
    <div style={chipStyle}>
      <div style={dotStyle} />
      <span>
        {getStatusText()} – {phaseLabel}
      </span>
    </div>
  );
};

interface WarningChipProps {
  message: string;
}

const WarningChip: React.FC<WarningChipProps> = ({ message }) => {
  const isMobile = useIsMobile();

  const chipStyle: CSSProperties = {
    padding: isMobile ? `8px ${spacing.md}` : `6px ${spacing.md}`,
    borderRadius: '999px',
    border: `1px solid ${colors.warning}`,
    fontSize: isMobile ? fontSizes.xs : fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    background: `rgba(255, 145, 0, 0.1)`,
    color: colors.warning,
  };

  return <div style={chipStyle}>{message}</div>;
};

// Note: calculateMinutesUntil is now imported from utils/timeHelpers.ts
