/**
 * LiveCockpitMockup - Live Match Control based on HTML Mockups
 *
 * Based on: docs/mockups/live-cockpit-mockups/
 * - scoreboard-desktop.html (≥768px)
 * - scoreboard-mobile.html (<768px)
 *
 * Layout:
 * - Desktop: Main grid (scoreboard + sidebar)
 * - Mobile: Stacked layout with bottom footer
 */

import { useState, useCallback, useMemo, useEffect, type CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../design-tokens';
import { useBreakpoint, useMatchTimer } from '../../hooks';
import type { LiveCockpitProps } from './types';
import type { ActivePenalty } from '../../types/tournament';

// Sub-components
import {
  TeamBlock,
  FoulBar,
  Sidebar,
  GameControls,
  TimeAdjustDialog,
  ToastContainer,
  CardDialog,
  TimePenaltyDialog,
  SubstitutionDialog,
  GoalScorerDialog,
  EventEditDialog,
} from './components';


// Hooks
import { useToast } from './hooks';

/**
 * BUG-010: Event interface compatible with both match-cockpit and tournament.ts formats.
 * Used for the event editing functionality.
 */
interface EditableMatchEvent {
  id: string;
  type: string;
  timestampSeconds?: number;
  matchMinute?: number;
  teamId?: string;
  playerNumber?: number;
  incomplete?: boolean;
  payload?: {
    teamId?: string;
    teamName?: string;
    playerNumber?: number;
  };
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const LiveCockpitMockup: React.FC<LiveCockpitProps> = ({
  fieldName,
  tournamentName: _tournamentName,
  currentMatch,
  lastFinishedMatch: _lastFinishedMatch,
  upcomingMatches,
  highlightNextMatchMinutesBefore: _highlightNextMatchMinutesBefore = 5,
  onStart,
  onPause,
  onResume,
  onFinish,
  onGoal,
  onUndoLastEvent,
  onManualEditResult: _onManualEditResult,
  onAdjustTime,
  onLoadNextMatch: _onLoadNextMatch,
  onReopenLastMatch: _onReopenLastMatch,
  onStartOvertime: _onStartOvertime,
  onStartGoldenGoal: _onStartGoldenGoal,
  onStartPenaltyShootout: _onStartPenaltyShootout,
  onRecordPenaltyResult: _onRecordPenaltyResult,
  onForceFinish: _onForceFinish,
  onCancelTiebreaker: _onCancelTiebreaker,
}) => {
  // Responsive breakpoint detection
  const { breakpoint, isMobile, isTablet } = useBreakpoint();

  // State
  const [showTimeAdjustDialog, setShowTimeAdjustDialog] = useState(false);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showTimePenaltyDialog, setShowTimePenaltyDialog] = useState(false);
  const [showSubstitutionDialog, setShowSubstitutionDialog] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [pendingGoalSide, setPendingGoalSide] = useState<'home' | 'away' | null>(null);
  // BUG-006: Track which team side triggered the penalty dialog
  const [pendingPenaltySide, setPendingPenaltySide] = useState<'home' | 'away' | null>(null);
  // BUG-007: Track which card type and team side triggered the card dialog
  const [pendingCardType, setPendingCardType] = useState<'YELLOW' | 'RED' | null>(null);
  const [pendingCardTeamSide, setPendingCardTeamSide] = useState<'home' | 'away' | null>(null);
  // BUG-009: Track which team side triggered the substitution dialog
  const [pendingSubstitutionSide, setPendingSubstitutionSide] = useState<'home' | 'away' | null>(null);
  // BUG-010: Event editing state
  const [showEventEditDialog, setShowEventEditDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EditableMatchEvent | null>(null);
  const [activePenalties, setActivePenalties] = useState<ActivePenalty[]>([]);
  const [homeFouls, setHomeFouls] = useState(0);
  const [awayFouls, setAwayFouls] = useState(0);

  // Toast notifications
  const { toasts, showSuccess, showInfo, dismissToast } = useToast();

  // Next match info
  const nextMatch = useMemo(() => {
    return upcomingMatches.length > 0 ? upcomingMatches[0] : null;
  }, [upcomingMatches]);

  // BUG-004 FIX: Real-time timer display using useMatchTimer
  // This calculates elapsed time locally from timerStartTime for smooth 1-second updates
  // instead of waiting for the 5-second persistence interval
  const displayElapsedSeconds = useMatchTimer(
    currentMatch?.timerStartTime ?? null,
    currentMatch?.timerElapsedSeconds ?? 0,
    currentMatch?.status ?? 'NOT_STARTED'
  );

  // BUG-008 FIX: Update penalty countdowns every second when match is RUNNING
  // Also removes expired penalties and pauses countdown when match is paused
  useEffect(() => {
    if (!currentMatch || activePenalties.length === 0) {
      return;
    }

    // Only countdown when match is running
    if (currentMatch.status !== 'RUNNING') {
      return;
    }

    const interval = setInterval(() => {
      setActivePenalties((prev) => {
        // Decrement remaining seconds and filter out expired penalties
        return prev
          .map((penalty) => ({
            ...penalty,
            remainingSeconds: Math.max(0, penalty.remainingSeconds - 1),
          }))
          .filter((penalty) => penalty.remainingSeconds > 0);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentMatch?.status, activePenalties.length, currentMatch]);

  // ---------------------------------------------------------------------------
  // Handler Adapters
  // ---------------------------------------------------------------------------

  // Open GoalScorerDialog instead of direct goal
  const handleGoalHome = useCallback(() => {
    if (!currentMatch) {return;}
    setPendingGoalSide('home');
    setShowGoalDialog(true);
  }, [currentMatch]);

  const handleGoalAway = useCallback(() => {
    if (!currentMatch) {return;}
    setPendingGoalSide('away');
    setShowGoalDialog(true);
  }, [currentMatch]);

  // Callback when GoalScorerDialog confirms
  const handleGoalConfirm = useCallback(
    (jerseyNumber: number | null, assists?: (number | null)[], incomplete?: boolean) => {
      if (!currentMatch || !pendingGoalSide) {return;}

      const teamId = pendingGoalSide === 'home' ? currentMatch.homeTeam.id : currentMatch.awayTeam.id;
      const teamName = pendingGoalSide === 'home' ? currentMatch.homeTeam.name : currentMatch.awayTeam.name;

      // Call the parent handler with delta +1
      onGoal(currentMatch.id, teamId, 1);

      // Build toast message with jersey number and assists
      if (incomplete) {
        showInfo(`⚽ Tor für ${teamName} (ohne Nr.)`);
      } else if (jerseyNumber !== null) {
        const assistText = assists && assists.length > 0
          ? ` (Assist: ${assists.map(a => `#${a}`).join(', ')})`
          : '';
        showSuccess(`⚽ Tor für ${teamName} (#${jerseyNumber})${assistText}`);
      } else {
        showSuccess(`⚽ Tor für ${teamName}!`);
      }

      // Reset state
      setPendingGoalSide(null);
      setShowGoalDialog(false);
    },
    [currentMatch, pendingGoalSide, onGoal, showSuccess, showInfo]
  );

  const handleMinusHome = useCallback(() => {
    if (!currentMatch || currentMatch.homeScore <= 0) {return;}
    onGoal(currentMatch.id, currentMatch.homeTeam.id, -1);
    showInfo(`Tor für ${currentMatch.homeTeam.name} entfernt`);
  }, [currentMatch, onGoal, showInfo]);

  const handleMinusAway = useCallback(() => {
    if (!currentMatch || currentMatch.awayScore <= 0) {return;}
    onGoal(currentMatch.id, currentMatch.awayTeam.id, -1);
    showInfo(`Tor für ${currentMatch.awayTeam.name} entfernt`);
  }, [currentMatch, onGoal, showInfo]);

  const handleStart = useCallback(() => {
    if (!currentMatch) {return;}
    onStart(currentMatch.id);
    showSuccess('Spiel gestartet!');
  }, [currentMatch, onStart, showSuccess]);

  const handleFinish = useCallback(() => {
    if (!currentMatch) {return;}
    onFinish(currentMatch.id);
    // BUG-008: Clear all active penalties when match ends
    setActivePenalties([]);
    showInfo('Spiel beendet');
  }, [currentMatch, onFinish, showInfo]);

  const handleUndo = useCallback(() => {
    if (!currentMatch) {return;}
    onUndoLastEvent(currentMatch.id);
    showInfo('Letzte Aktion rückgängig gemacht');
  }, [currentMatch, onUndoLastEvent, showInfo]);

  const handlePauseResume = useCallback(() => {
    if (!currentMatch) {return;}
    if (currentMatch.status === 'RUNNING') {
      onPause(currentMatch.id);
      showInfo('Spiel pausiert');
    } else if (currentMatch.status === 'PAUSED') {
      onResume(currentMatch.id);
      showSuccess('Spiel fortgesetzt');
    }
  }, [currentMatch, onPause, onResume, showInfo, showSuccess]);

  const handleTimeAdjust = useCallback(
    (newTimeSeconds: number) => {
      if (!currentMatch) {return;}
      onAdjustTime(currentMatch.id, newTimeSeconds);
      const mins = Math.floor(newTimeSeconds / 60);
      const secs = newTimeSeconds % 60;
      showInfo(`Zeit auf ${mins}:${secs.toString().padStart(2, '0')} gesetzt`);
    },
    [currentMatch, onAdjustTime, showInfo]
  );

  const handleSwitchSides = useCallback(() => {
    // TODO: Implement switch sides
    showInfo('Seiten getauscht');
  }, [showInfo]);

  const handleHalfTime = useCallback(() => {
    // Reset fouls
    setHomeFouls(0);
    setAwayFouls(0);
    showInfo('Halbzeit - Fouls zurückgesetzt');
  }, [showInfo]);

  const handleFoulHome = useCallback(() => {
    if (!currentMatch) {return;}
    const newFouls = homeFouls + 1;
    setHomeFouls(newFouls);
    showInfo(`Foul für ${currentMatch.homeTeam.name} (${newFouls})`);
    if (newFouls === 5) {
      showInfo(`⚠ ACHTUNG: ${currentMatch.homeTeam.name} hat 5 Fouls!`);
    }
  }, [currentMatch, homeFouls, showInfo]);

  const handleFoulAway = useCallback(() => {
    if (!currentMatch) {return;}
    const newFouls = awayFouls + 1;
    setAwayFouls(newFouls);
    showInfo(`Foul für ${currentMatch.awayTeam.name} (${newFouls})`);
    if (newFouls === 5) {
      showInfo(`⚠ ACHTUNG: ${currentMatch.awayTeam.name} hat 5 Fouls!`);
    }
  }, [currentMatch, awayFouls, showInfo]);

  // Card/Penalty/Substitution handlers
  const handleCardConfirm = useCallback(
    (cardType: 'YELLOW' | 'RED', teamId: string, playerNumber?: number) => {
      const teamName = currentMatch?.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch?.awayTeam.name;
      const playerInfo = playerNumber ? ` (#${playerNumber})` : '';
      const cardName = cardType === 'YELLOW' ? 'Gelbe' : 'Rote';
      showInfo(`${cardName} Karte für ${teamName}${playerInfo}`);
      setShowCardDialog(false);
      // BUG-007: Reset pending card state
      setPendingCardType(null);
      setPendingCardTeamSide(null);
    },
    [currentMatch, showInfo]
  );

  const handleTimePenaltyConfirm = useCallback(
    (durationSeconds: number, teamId: string, playerNumber?: number) => {
      if (!currentMatch) {return;}
      const teamName = currentMatch.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch.awayTeam.name;
      const mins = Math.floor(durationSeconds / 60);
      const playerInfo = playerNumber ? ` (#${playerNumber})` : '';
      showInfo(`${mins} Min Zeitstrafe für ${teamName}${playerInfo}`);

      // Add to active penalties
      const now = new Date();
      const endsAt = new Date(now.getTime() + durationSeconds * 1000);
      const newPenalty: ActivePenalty = {
        eventId: `penalty-${Date.now()}`,
        teamId,
        playerNumber,
        remainingSeconds: durationSeconds,
        startedAt: now,
        endsAt,
      };
      setActivePenalties((prev) => [...prev, newPenalty]);
      setShowTimePenaltyDialog(false);
      setPendingPenaltySide(null);
    },
    [currentMatch, showInfo]
  );

  // BUG-009: Updated to handle multi-player substitutions
  const handleSubstitutionConfirm = useCallback(
    (teamId: string, playersOut: number[], playersIn: number[]) => {
      if (!currentMatch) {return;}
      const teamName = currentMatch.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch.awayTeam.name;

      // Format player numbers for display
      const outInfo = playersOut.length > 0 ? playersOut.map(n => `#${n}`).join(',') : '?';
      const inInfo = playersIn.length > 0 ? playersIn.map(n => `#${n}`).join(',') : '?';
      showInfo(`🔄 Wechsel ${teamName}: ${outInfo} → ${inInfo}`);
      setShowSubstitutionDialog(false);
      setPendingSubstitutionSide(null);
    },
    [currentMatch, showInfo]
  );

  // BUG-010: Handler for editing events from the sidebar
  const handleEventEdit = useCallback(
    (event: { id: string; type: string; timestampSeconds: number; payload?: Record<string, unknown>; incomplete?: boolean }) => {
      if (!currentMatch) {return;}
      // Find the full event from match.events to get all properties
      const fullEvent = currentMatch.events.find(e => e.id === event.id);
      if (fullEvent) {
        // Cast to our compatible interface
        const editableEvent: EditableMatchEvent = {
          id: fullEvent.id,
          type: fullEvent.type,
          timestampSeconds: fullEvent.timestampSeconds,
          payload: fullEvent.payload as EditableMatchEvent['payload'],
        };
        setEditingEvent(editableEvent);
        setShowEventEditDialog(true);
      }
    },
    [currentMatch]
  );

  // BUG-010: Handler for updating event details
  const handleEventUpdate = useCallback(
    (eventId: string, updates: { playerNumber?: number; incomplete?: boolean }) => {
      if (!currentMatch) {return;}
      const event = currentMatch.events.find(e => e.id === eventId);
      if (!event) {return;}

      // Show success toast with event type
      const eventTypeLabels: Record<string, string> = {
        GOAL: 'Tor',
        YELLOW_CARD: 'Gelbe Karte',
        RED_CARD: 'Rote Karte',
        TIME_PENALTY: 'Zeitstrafe',
        SUBSTITUTION: 'Wechsel',
        FOUL: 'Foul',
      };
      const label = eventTypeLabels[event.type] ?? event.type;
      const playerInfo = updates.playerNumber ? ` (#${updates.playerNumber})` : '';
      showSuccess(`✅ ${label}${playerInfo} aktualisiert`);

      // Note: Full persistence would require parent callback - for now just showing toast
      // TODO: Add onUpdateEvent prop to LiveCockpitProps when backend is ready
    },
    [currentMatch, showSuccess]
  );

  // BUG-010: Handler for deleting events (with score adjustment for GOALs)
  const handleEventDelete = useCallback(
    (eventId: string) => {
      if (!currentMatch) {return;}
      const event = currentMatch.events.find(e => e.id === eventId);
      if (!event) {return;}

      const eventTypeLabels: Record<string, string> = {
        GOAL: 'Tor',
        YELLOW_CARD: 'Gelbe Karte',
        RED_CARD: 'Rote Karte',
        TIME_PENALTY: 'Zeitstrafe',
        SUBSTITUTION: 'Wechsel',
        FOUL: 'Foul',
      };
      const label = eventTypeLabels[event.type] ?? event.type;

      // If it's a GOAL event, also decrement the score
      // match-cockpit format: payload.teamId
      const eventTeamId = event.payload.teamId;
      if (event.type === 'GOAL' && eventTeamId) {
        onGoal(currentMatch.id, eventTeamId, -1);
        const teamName = eventTeamId === currentMatch.homeTeam.id
          ? currentMatch.homeTeam.name
          : currentMatch.awayTeam.name;
        showInfo(`🗑️ ${label} für ${teamName} gelöscht (Spielstand angepasst)`);
      } else {
        showInfo(`🗑️ ${label} gelöscht`);
      }

      // Note: Full persistence would require parent callback
      // TODO: Add onDeleteEvent prop to LiveCockpitProps when backend is ready
    },
    [currentMatch, onGoal, showInfo]
  );

  // ---------------------------------------------------------------------------
  // Early return AFTER all hooks
  // ---------------------------------------------------------------------------

  if (!currentMatch) {
    return (
      <div style={noMatchStyle}>
        <p style={noMatchTextStyle}>Kein Spiel ausgewählt</p>
      </div>
    );
  }

  const match = currentMatch;
  const isFinished = match.status === 'FINISHED';
  const isNotStarted = match.status === 'NOT_STARTED';
  const canUndo = match.events.length > 0 && !isFinished;
  const canDecrementHome = match.homeScore > 0 && !isFinished;
  const canDecrementAway = match.awayScore > 0 && !isFinished;
  const isDesktop = !isMobile && !isTablet;

  // ---------------------------------------------------------------------------
  // Styles based on mockup
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    background: colors.background,
    color: colors.textPrimary,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  };

  const contentStyle: CSSProperties = {
    padding: isMobile ? spacing.md : spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.lg,
    flex: 1,
  };

  // Match Header
  const matchHeaderStyle: CSSProperties = {
    background: colors.surfaceSolid,
    borderRadius: borderRadius.lg,
    padding: `${spacing.md} ${spacing.lg}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  };

  const matchInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
  };

  const matchNumberStyle: CSSProperties = {
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.md,
  };

  const matchFieldStyle: CSSProperties = {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  };

  const statusBadgeStyle: CSSProperties = {
    background: match.status === 'RUNNING'
      ? colors.primaryLight
      : colors.surfaceElevated,
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: borderRadius.sm,
    fontSize: '11px',
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    color: match.status === 'RUNNING' ? colors.primary : colors.textPrimary,
  };

  // Next Banner
  const nextBannerStyle: CSSProperties = {
    background: `linear-gradient(90deg, ${colors.dangerGradientStart} 0%, ${colors.dangerGradientEnd} 100%)`,
    border: `1px solid ${colors.dangerBorder}`,
    borderRadius: borderRadius.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: fontSizes.sm,
    display: 'flex',
    gap: spacing.sm,
  };

  // Main Grid
  const mainGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isDesktop ? '1fr 300px' : '1fr',
    gap: spacing.lg,
  };

  // Scoreboard
  const scoreboardStyle: CSSProperties = {
    background: colors.surfaceSolid,
    borderRadius: borderRadius.lg,
    padding: isMobile ? spacing.md : spacing.xl,
  };

  // Timer Row
  const timerRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  };

  const timerLabelStyle: CSSProperties = {
    fontSize: '12px',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '1px',
  };

  const timerStyle: CSSProperties = {
    fontSize: isMobile ? '48px' : '64px',
    fontWeight: fontWeights.bold,
    fontVariantNumeric: 'tabular-nums',
    cursor: !isFinished ? 'pointer' : 'default',
  };

  const timerTotalStyle: CSSProperties = {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
  };

  // Score Row
  const scoreRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: isMobile ? spacing.sm : spacing.lg,
    alignItems: 'start',
  };

  const scoreDividerStyle: CSSProperties = {
    fontSize: '48px',
    fontWeight: fontWeights.bold,
    color: colors.textMuted,
    alignSelf: 'center',
    paddingTop: '60px',
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusLabel = (): string => {
    switch (match.status) {
      case 'RUNNING': return 'LÄUFT';
      case 'PAUSED': return 'PAUSIERT';
      case 'FINISHED': return 'BEENDET';
      default: return 'NICHT GESTARTET';
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Content */}
      <main style={contentStyle}>
        {/* Match Header */}
        <div style={matchHeaderStyle}>
          <div style={matchInfoStyle}>
            <span style={matchNumberStyle}>Spiel {match.number}</span>
            <span style={matchFieldStyle}>{fieldName}</span>
          </div>

          {/* Foul Counter - Desktop inline, Mobile separate */}
          {!isMobile && (
            <FoulBar
              homeTeamName={match.homeTeam.name}
              awayTeamName={match.awayTeam.name}
              homeFouls={homeFouls}
              awayFouls={awayFouls}
              variant="inline"
            />
          )}

          <span style={statusBadgeStyle}>{getStatusLabel()}</span>
        </div>

        {/* Foul Bar - Mobile only */}
        {isMobile && (
          <FoulBar
            homeTeamName={match.homeTeam.name}
            awayTeamName={match.awayTeam.name}
            homeFouls={homeFouls}
            awayFouls={awayFouls}
            variant="bar"
          />
        )}

        {/* Next Banner */}
        {nextMatch && (
          <div style={nextBannerStyle}>
            <span style={{ color: colors.error, fontWeight: fontWeights.semibold }}>
              Nächstes →
            </span>
            <span>
              {nextMatch.homeTeam.name} vs {nextMatch.awayTeam.name}
              {nextMatch.scheduledKickoff && ` (${nextMatch.scheduledKickoff})`}
            </span>
          </div>
        )}

        {/* Main Grid */}
        <div style={mainGridStyle}>
          {/* Scoreboard */}
          <div style={scoreboardStyle}>
            {/* Timer Row */}
            <div style={timerRowStyle}>
              <span style={timerLabelStyle}>Spielzeit</span>
              <span
                style={timerStyle}
                onClick={() => !isFinished && setShowTimeAdjustDialog(true)}
                role="button"
                tabIndex={0}
              >
                {formatTime(displayElapsedSeconds)}
              </span>
              <span style={timerTotalStyle}>
                / {formatTime(match.durationSeconds)}
              </span>
            </div>

            {/* Score Row */}
            <div style={scoreRowStyle}>
              {/* Team A */}
              <TeamBlock
                teamName={match.homeTeam.name}
                teamLabel="Heim"
                score={match.homeScore}
                fouls={homeFouls}
                disabled={isFinished || isNotStarted}
                breakpoint={breakpoint}
                onGoal={handleGoalHome}
                onMinus={handleMinusHome}
                onPenalty={() => {
                  setPendingPenaltySide('home');
                  setShowTimePenaltyDialog(true);
                }}
                onYellowCard={() => {
                  // BUG-007: Set card type and team side before opening dialog
                  setPendingCardType('YELLOW');
                  setPendingCardTeamSide('home');
                  setShowCardDialog(true);
                }}
                onRedCard={() => {
                  // BUG-007: Set card type and team side before opening dialog
                  setPendingCardType('RED');
                  setPendingCardTeamSide('home');
                  setShowCardDialog(true);
                }}
                onSubstitution={() => {
                  // BUG-009: Set team side before opening dialog
                  setPendingSubstitutionSide('home');
                  setShowSubstitutionDialog(true);
                }}
                onFoul={handleFoulHome}
                canDecrement={canDecrementHome}
              />

              {/* Divider */}
              <span style={scoreDividerStyle}>:</span>

              {/* Team B */}
              <TeamBlock
                teamName={match.awayTeam.name}
                teamLabel="Gast"
                score={match.awayScore}
                fouls={awayFouls}
                disabled={isFinished || isNotStarted}
                breakpoint={breakpoint}
                onGoal={handleGoalAway}
                onMinus={handleMinusAway}
                onPenalty={() => {
                  setPendingPenaltySide('away');
                  setShowTimePenaltyDialog(true);
                }}
                onYellowCard={() => {
                  // BUG-007: Set card type and team side before opening dialog
                  setPendingCardType('YELLOW');
                  setPendingCardTeamSide('away');
                  setShowCardDialog(true);
                }}
                onRedCard={() => {
                  // BUG-007: Set card type and team side before opening dialog
                  setPendingCardType('RED');
                  setPendingCardTeamSide('away');
                  setShowCardDialog(true);
                }}
                onSubstitution={() => {
                  // BUG-009: Set team side before opening dialog
                  setPendingSubstitutionSide('away');
                  setShowSubstitutionDialog(true);
                }}
                onFoul={handleFoulAway}
                canDecrement={canDecrementAway}
              />
            </div>

            {/* Game Controls */}
            <GameControls
              status={match.status}
              onUndo={canUndo ? handleUndo : undefined}
              onStart={handleStart}
              onPauseResume={handlePauseResume}
              onEditTime={() => setShowTimeAdjustDialog(true)}
              onSwitchSides={handleSwitchSides}
              onHalfTime={handleHalfTime}
              onFinish={handleFinish}
              canUndo={canUndo}
              breakpoint={breakpoint}
            />
          </div>

          {/* Sidebar - Desktop only */}
          {isDesktop && (
            <Sidebar
              activePenalties={activePenalties}
              events={match.events}
              homeTeamName={match.homeTeam.name}
              awayTeamName={match.awayTeam.name}
              homeTeamId={match.homeTeam.id}
              awayTeamId={match.awayTeam.id}
              // BUG-010: Enable event editing
              onEventEdit={handleEventEdit}
            />
          )}
        </div>
      </main>

      {/* Dialogs */}
      <TimeAdjustDialog
        isOpen={showTimeAdjustDialog}
        onClose={() => setShowTimeAdjustDialog(false)}
        onConfirm={handleTimeAdjust}
        currentTimeSeconds={displayElapsedSeconds}
        matchDurationMinutes={Math.floor(match.durationSeconds / 60)}
      />

      <CardDialog
        isOpen={showCardDialog}
        onClose={() => {
          setShowCardDialog(false);
          // BUG-007: Reset pending card state
          setPendingCardType(null);
          setPendingCardTeamSide(null);
        }}
        onConfirm={handleCardConfirm}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        // BUG-007: Pre-select card type and team based on button clicked
        initialCardType={pendingCardType ?? undefined}
        preselectedTeamSide={pendingCardTeamSide ?? undefined}
        autoDismissSeconds={10}
      />

      <TimePenaltyDialog
        isOpen={showTimePenaltyDialog}
        onClose={() => {
          setShowTimePenaltyDialog(false);
          setPendingPenaltySide(null);
        }}
        onConfirm={handleTimePenaltyConfirm}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        // BUG-006: Pre-select 2 minutes and team based on button clicked
        preselectedDurationSeconds={120}
        preselectedTeamSide={pendingPenaltySide ?? undefined}
        autoDismissSeconds={10}
      />

      <SubstitutionDialog
        isOpen={showSubstitutionDialog}
        onClose={() => {
          setShowSubstitutionDialog(false);
          setPendingSubstitutionSide(null);
        }}
        onConfirm={handleSubstitutionConfirm}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        // BUG-009: Pre-select team based on button clicked
        preselectedTeamSide={pendingSubstitutionSide ?? undefined}
        autoDismissSeconds={10}
      />

      {/* GoalScorerDialog - BUG-002: Torschütze + Assist erfassen */}
      <GoalScorerDialog
        isOpen={showGoalDialog}
        onClose={() => {
          setShowGoalDialog(false);
          setPendingGoalSide(null);
        }}
        onConfirm={handleGoalConfirm}
        teamName={
          pendingGoalSide === 'home'
            ? match.homeTeam.name
            : pendingGoalSide === 'away'
              ? match.awayTeam.name
              : ''
        }
        teamColor={colors.primary}
        autoDismissSeconds={10}
      />

      {/* BUG-010: EventEditDialog for editing/deleting events */}
      <EventEditDialog
        isOpen={showEventEditDialog}
        onClose={() => {
          setShowEventEditDialog(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        onUpdate={handleEventUpdate}
        onDelete={handleEventDelete}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Fallback Styles
// ---------------------------------------------------------------------------

const noMatchStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '300px',
  background: colors.background,
};

const noMatchTextStyle: CSSProperties = {
  color: colors.textSecondary,
  fontSize: '1.125rem',
};

export default LiveCockpitMockup;
