/**
 * @deprecated ARCHIVED - Use LiveCockpitMockup instead!
 *
 * This component is NOT used in production. The ManagementTab uses LiveCockpitMockup.
 * Keeping for reference only - do not modify.
 *
 * ============================================================================
 *
 * LiveCockpit - Redesigned Live Match Control Interface
 *
 * A touch-optimized interface for tournament directors to manage live matches.
 * Features:
 * - Touch Zone Layout (Actions in thumb-reachable area)
 * - Progressive Disclosure (Focus → Standard → Extended modes)
 * - Score Correction (Minus buttons, Undo)
 * - Tiebreaker Support (Overtime, Golden Goal, Penalty Shootout)
 * - Proactive Hints (Next match warnings)
 *
 * Props interface matches MatchCockpit for drop-in replacement.
 *
 * @see docs/concepts/LIVE-SCREEN-REDESIGN.md
 * @see docs/user-stories/US-LIVE-REDESIGN.md
 */

import { useState, useCallback, useMemo, type CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../design-tokens';
import { useBreakpoint, useIsMobile, useMatchTimer } from '../../hooks';
import type { LiveCockpitProps, LiveCockpitMode, TeamSide } from './types';
import type { MatchEvent } from '../../types/tournament';

// Sub-components
import {
  Header,
  ScoreDisplay,
  ActionZone,
  FooterBar,
  TiebreakerBanner,
  TimeAdjustDialog,
  ToastContainer,
  ExtendedActionsPanel,
  ScoreEditDialog,
  CardDialog,
  TimePenaltyDialog,
  SubstitutionDialog,
  PenaltyIndicators,
} from './components';
import { GoalScorerDialog } from './components/Dialogs/GoalScorerDialog';
import { EventEditDialog } from './components/Dialogs/EventEditDialog';
import { FoulWarningBanner, useFoulWarning } from './components/FoulWarning';
import { OpenEntriesBottomSheet } from './components/OpenEntries';

// Hooks
import { useToast } from './hooks';
import { useSyncedPenalties } from '../../hooks/useSyncedPenalties';

// CSS Module for focus states and animations
import styles from './LiveCockpit.module.css';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const LiveCockpit: React.FC<LiveCockpitProps> = ({
  fieldName,
  tournamentName: _tournamentName, // TODO: Display in header
  currentMatch,
  lastFinishedMatch,
  upcomingMatches,
  highlightNextMatchMinutesBefore: _highlightNextMatchMinutesBefore = 5, // TODO: Implement warning toasts
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
  onStartOvertime,
  onStartGoldenGoal,
  onStartPenaltyShootout,
  onRecordPenaltyResult: _onRecordPenaltyResult, // TODO: Implement penalty dialog
  onForceFinish: _onForceFinish, // TODO: Implement force finish
  onCancelTiebreaker,
}) => {
  // Responsive breakpoint detection
  const { breakpoint, isMobile, isTablet } = useBreakpoint();

  // State - all hooks MUST be called before any early returns
  const [mode, setMode] = useState<LiveCockpitMode>('standard');
  const [_showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showTimeAdjustDialog, setShowTimeAdjustDialog] = useState(false);
  const [showScoreEditDialog, setShowScoreEditDialog] = useState(false);
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showTimePenaltyDialog, setShowTimePenaltyDialog] = useState(false);
  const [showSubstitutionDialog, setShowSubstitutionDialog] = useState(false);

  // GoalScorerDialog State
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [pendingGoalTeam, setPendingGoalTeam] = useState<TeamSide | null>(null);

  // EventEditDialog State
  const [showEventEditDialog, setShowEventEditDialog] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // OpenEntriesBottomSheet State (Mobile)
  const isMobileDevice = useIsMobile();

  // Toast notifications
  const { toasts, showSuccess, showInfo, dismissToast } = useToast();

  // Synced Penalties - pauses with game timer
  const isGameRunning = currentMatch?.status === 'RUNNING';
  const {
    activePenalties,
    addPenalty,
    removePenalty: _removePenalty,
  } = useSyncedPenalties({
    isGameRunning,
    onPenaltyExpired: (penaltyId) => {
      showSuccess(`Zeitstrafe ${penaltyId.slice(-4)} abgelaufen`);
    },
  });

  // Foul Warning - shows banner when team reaches 5 fouls
  const { warningTeam, dismissWarning, checkFouls, isWarningVisible } = useFoulWarning();

  // Field ID extracted from fieldName for navigation callbacks
  const fieldId = useMemo(() => fieldName.replace(/\D/g, '') || '1', [fieldName]);

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

  // Mode change handler
  const handleModeChange = useCallback((newMode: LiveCockpitMode) => {
    setMode(newMode);
    try {
      localStorage.setItem('liveCockpit-mode', newMode);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Handler Adapters - all useCallback hooks BEFORE early return
  // Handlers check for currentMatch validity inside
  // ---------------------------------------------------------------------------

  // Open GoalScorerDialog for +Tor, direct call for -Tor
  const handleGoal = useCallback(
    (side: TeamSide, direction: 'INC' | 'DEC') => {
      if (!currentMatch) {
        return;
      }

      if (direction === 'INC') {
        // Open GoalScorerDialog for +Tor
        setPendingGoalTeam(side);
        setShowGoalDialog(true);
      } else {
        // Direct call for -Tor (score correction)
        const teamId = side === 'home' ? currentMatch.homeTeam.id : currentMatch.awayTeam.id;
        const teamName = side === 'home' ? currentMatch.homeTeam.name : currentMatch.awayTeam.name;
        onGoal(currentMatch.id, teamId, -1);
        showInfo(`Tor für ${teamName} entfernt`);
      }
    },
    [currentMatch, onGoal, showInfo]
  );

  // Callback when GoalScorerDialog confirms
  const handleGoalConfirm = useCallback(
    (jerseyNumber: number | null, assists?: (number | null)[], incomplete?: boolean) => {
      if (!currentMatch || !pendingGoalTeam) {
        return;
      }

      const teamId = pendingGoalTeam === 'home' ? currentMatch.homeTeam.id : currentMatch.awayTeam.id;
      const teamName = pendingGoalTeam === 'home' ? currentMatch.homeTeam.name : currentMatch.awayTeam.name;

      // Call the parent handler with delta +1
      // Note: Jersey number is tracked locally for now, full support requires event system update
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
      setPendingGoalTeam(null);
      setShowGoalDialog(false);
    },
    [currentMatch, pendingGoalTeam, onGoal, showSuccess, showInfo]
  );

  const handleStart = useCallback(() => {
    if (!currentMatch) {
      return;
    }
    onStart(currentMatch.id);
    showSuccess('Spiel gestartet!');
  }, [currentMatch, onStart, showSuccess]);

  const handleFinish = useCallback(() => {
    if (!currentMatch) {
      return;
    }
    onFinish(currentMatch.id);
    showInfo('Spiel beendet');
  }, [currentMatch, onFinish, showInfo]);

  const handleUndo = useCallback(() => {
    if (!currentMatch) {
      return;
    }
    onUndoLastEvent(currentMatch.id);
    showInfo('Letzte Aktion rückgängig gemacht');
  }, [currentMatch, onUndoLastEvent, showInfo]);

  const handlePauseResume = useCallback(() => {
    if (!currentMatch) {
      return;
    }
    if (currentMatch.status === 'RUNNING') {
      onPause(currentMatch.id);
      showInfo('Spiel pausiert');
    } else if (currentMatch.status === 'PAUSED') {
      onResume(currentMatch.id);
      showSuccess('Spiel fortgesetzt');
    }
  }, [currentMatch, onPause, onResume, showInfo, showSuccess]);

  // Time adjustment handler
  const handleTimeAdjust = useCallback(
    (newTimeSeconds: number) => {
      if (!currentMatch) {
        return;
      }
      onAdjustTime(currentMatch.id, newTimeSeconds);
      const mins = Math.floor(newTimeSeconds / 60);
      const secs = newTimeSeconds % 60;
      showInfo(`Zeit auf ${mins}:${secs.toString().padStart(2, '0')} gesetzt`);
    },
    [currentMatch, onAdjustTime, showInfo]
  );

  // Score edit handler
  const handleScoreEdit = useCallback(
    (homeScore: number, awayScore: number) => {
      if (!currentMatch) {
        return;
      }
      onManualEditResult(currentMatch.id, homeScore, awayScore);
      showInfo(`Ergebnis auf ${homeScore}:${awayScore} korrigiert`);
    },
    [currentMatch, onManualEditResult, showInfo]
  );

  // Tiebreaker handlers
  const handleStartOvertime = useCallback(() => {
    if (!currentMatch || !onStartOvertime) {
      return;
    }
    onStartOvertime(currentMatch.id);
  }, [currentMatch, onStartOvertime]);

  const handleStartGoldenGoal = useCallback(() => {
    if (!currentMatch || !onStartGoldenGoal) {
      return;
    }
    onStartGoldenGoal(currentMatch.id);
  }, [currentMatch, onStartGoldenGoal]);

  const handleStartPenaltyShootout = useCallback(() => {
    if (!currentMatch || !onStartPenaltyShootout) {
      return;
    }
    onStartPenaltyShootout(currentMatch.id);
  }, [currentMatch, onStartPenaltyShootout]);

  const handleCancelTiebreaker = useCallback(() => {
    if (!currentMatch || !onCancelTiebreaker) {
      return;
    }
    onCancelTiebreaker(currentMatch.id);
  }, [currentMatch, onCancelTiebreaker]);

  // Field navigation handlers
  const handleLoadNextMatch = useCallback(() => {
    onLoadNextMatch(fieldId);
  }, [fieldId, onLoadNextMatch]);

  const handleReopenLastMatch = useCallback(() => {
    onReopenLastMatch(fieldId);
  }, [fieldId, onReopenLastMatch]);

  // Card, Penalty, Substitution handlers
  const handleCardConfirm = useCallback(
    (cardType: 'YELLOW' | 'RED', teamId: string, playerNumber?: number) => {
      const teamName = currentMatch?.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch?.awayTeam.name;
      const playerInfo = playerNumber ? ` (#${playerNumber})` : '';
      const cardName = cardType === 'YELLOW' ? 'Gelbe' : 'Rote';
      showInfo(`${cardName} Karte für ${teamName}${playerInfo}`);
      setShowCardDialog(false);
      // TODO: Persist card event when backend supports it
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

      // Add to synced penalties (pauses with game timer)
      addPenalty(teamId, durationSeconds, playerNumber);

      // Check for 5-foul warning
      const currentFouls = activePenalties.filter(p => p.teamId === teamId).length + 1;
      if (currentFouls >= 5) {
        checkFouls(teamId, teamName, currentFouls);
      }

      setShowTimePenaltyDialog(false);
    },
    [currentMatch, showInfo, addPenalty, activePenalties, checkFouls]
  );

  // handlePenaltyExpire is now handled by useSyncedPenalties hook

  const handleSubstitutionConfirm = useCallback(
    (teamId: string, playerOut?: number, playerIn?: number) => {
      if (!currentMatch) {return;}
      const teamName = currentMatch.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch.awayTeam.name;
      const outInfo = playerOut ? `#${playerOut}` : '?';
      const inInfo = playerIn ? `#${playerIn}` : '?';
      showInfo(`Wechsel ${teamName}: ${outInfo} ↔ ${inInfo}`);
      setShowSubstitutionDialog(false);
      // TODO: Persist substitution event when backend supports it
    },
    [currentMatch, showInfo]
  );

  // TODO: OpenEntriesSection requires MatchEvent from tournament.ts
  // but LiveMatch.events uses a different type from match-cockpit.
  // Once types are unified, enable this feature.
  // const openEvents = useMemo(() => {
  //   if (!currentMatch) {return [];}
  //   return currentMatch.events.filter(event => !event.playerNumber);
  // }, [currentMatch]);

  // ---------------------------------------------------------------------------
  // Early return AFTER all hooks have been called
  // ---------------------------------------------------------------------------

  if (!currentMatch) {
    return (
      <div style={noMatchStyle}>
        <p style={noMatchTextStyle}>Kein Spiel ausgewählt</p>
      </div>
    );
  }

  // Alias for cleaner code below
  const match = currentMatch;

  // Computed values (not hooks, so can be after early return)
  const isFinished = match.status === 'FINISHED';
  const isNotStarted = match.status === 'NOT_STARTED';
  const canUndo = match.events.length > 0 && !isFinished;
  const canDecrementHome = match.homeScore > 0 && !isFinished;
  const canDecrementAway = match.awayScore > 0 && !isFinished;

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh', // Feste Höhe statt minHeight - verhindert Scrollen
    overflow: 'hidden', // Kein Overflow
    background: colors.background,
    color: colors.textPrimary,
  };

  // Responsive padding - KOMPAKT
  const getMainPadding = () => {
    if (isMobile) {return spacing.sm;}
    if (isTablet) {return spacing.md;}
    return spacing.lg;
  };

  const mainContentStyle: CSSProperties = {
    flex: '1 1 0',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: getMainPadding(),
    paddingBottom: isMobile ? '60px' : '70px', // Platz für fixierten Footer
    gap: isMobile ? spacing.xs : spacing.sm,
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    overflow: 'hidden',
  };

  const hardToReachZoneStyle: CSSProperties = {
    flex: '0 0 auto',
  };

  const naturalZoneStyle: CSSProperties = {
    flex: '1 1 0', // Flex-grow ohne Basis - nimmt verfügbaren Platz
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 0, // Erlaubt Schrumpfen unter Content-Größe
    overflow: 'auto', // Falls Content zu groß, hier scrollen
  };

  const thumbZoneStyle: CSSProperties = {
    flex: '0 0 auto',
  };

  const eventListSectionStyle: CSSProperties = {
    flex: '0 0 auto',
    maxHeight: isMobile ? '80px' : '100px', // Kompakter
    overflow: 'auto',
    width: '100%',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle} className={styles.liveCockpitContainer}>
      {/* Header */}
      <Header
        matchNumber={match.number}
        fieldName={fieldName}
        status={match.status}
        playPhase={match.playPhase}
        mode={mode}
        onModeChange={handleModeChange}
        onUndo={canUndo ? handleUndo : undefined}
        showUndo={mode !== 'focus'}
        onMenuOpen={() => setShowOverflowMenu(true)}
        breakpoint={breakpoint}
      />

      <main style={mainContentStyle}>
        {/* Next Match Hint - shows upcoming match */}
        {mode !== 'focus' && nextMatch && (
          <section style={hardToReachZoneStyle}>
            <NextMatchHint
              homeTeamName={nextMatch.homeTeam.name}
              awayTeamName={nextMatch.awayTeam.name}
              matchNumber={nextMatch.number}
              scheduledTime={nextMatch.scheduledKickoff}
              isMobile={isMobile}
            />
          </section>
        )}

        {/* Score Display */}
        <section style={naturalZoneStyle}>
          <ScoreDisplay
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            homeScore={match.homeScore}
            awayScore={match.awayScore}
            elapsedSeconds={displayElapsedSeconds}
            durationSeconds={match.durationSeconds}
            status={match.status}
            playPhase={match.playPhase}
            overtimeScore={
              match.playPhase === 'overtime'
                ? { home: match.overtimeScoreA ?? 0, away: match.overtimeScoreB ?? 0 }
                : undefined
            }
            penaltyScore={
              match.playPhase === 'penalty'
                ? { home: match.penaltyScoreA ?? 0, away: match.penaltyScoreB ?? 0 }
                : undefined
            }
            onTimerClick={
              !isFinished && mode !== 'focus'
                ? () => setShowTimeAdjustDialog(true)
                : undefined
            }
            breakpoint={breakpoint}
            compact={mode === 'focus'}
          />
        </section>

        {/* Foul Warning Banner - shows when team reaches 5 fouls */}
        <FoulWarningBanner
          teamName={warningTeam?.name ?? ''}
          foulCount={warningTeam?.count ?? 0}
          onDismiss={dismissWarning}
          isVisible={isWarningVisible}
        />

        {/* Penalty Indicators - show active time penalties */}
        {activePenalties.length > 0 && (
          <section style={{ flex: '0 0 auto' }}>
            <PenaltyIndicators
              activePenalties={activePenalties.map((p) => ({
                eventId: p.id,
                teamId: p.teamId,
                playerNumber: p.playerNumber,
                remainingSeconds: p.remainingSeconds,
                startedAt: new Date(p.startedAt),
                endsAt: new Date(p.startedAt + p.durationSeconds * 1000),
              }))}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              isMatchRunning={match.status === 'RUNNING'}
            />
          </section>
        )}

        {/* Extended Actions Panel - only in extended mode */}
        {mode === 'extended' && !isFinished && (
          <section style={{ flex: '0 0 auto' }}>
            <ExtendedActionsPanel
              onEditScore={() => setShowScoreEditDialog(true)}
              onAdjustTime={() => setShowTimeAdjustDialog(true)}
              onYellowCard={() => setShowCardDialog(true)}
              onRedCard={() => setShowCardDialog(true)}
              onTimePenalty={() => setShowTimePenaltyDialog(true)}
              onSubstitution={() => setShowSubstitutionDialog(true)}
              disabled={isNotStarted}
              breakpoint={breakpoint}
            />
          </section>
        )}

        {/* TODO: Open Entries - events without player numbers
            Disabled until MatchEvent types are unified between match-cockpit and tournament.ts
        {mode === 'extended' && openEvents.length > 0 && (
          <section style={{ flex: '0 0 auto' }}>
            <OpenEntriesSection
              openEvents={openEvents}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              onEditEvent={(eventId) => {
                showInfo(`Event ${eventId} bearbeiten - noch nicht implementiert`);
              }}
            />
          </section>
        )}
        */}

        {/* Event List - only in extended mode */}
        {mode === 'extended' && match.events.length > 0 && (
          <section style={eventListSectionStyle}>
            <EventList
              events={match.events}
              homeTeamName={match.homeTeam.name}
              awayTeamName={match.awayTeam.name}
              isMobile={isMobile}
            />
          </section>
        )}

        {/* Goal Buttons - Konzept §4.1: 80px vertikal im Fokus-Modus */}
        <section style={thumbZoneStyle}>
          <ActionZone
            onGoal={handleGoal}
            canDecrementHome={canDecrementHome}
            canDecrementAway={canDecrementAway}
            homeTeamName={match.homeTeam.name}
            awayTeamName={match.awayTeam.name}
            disabled={isFinished || isNotStarted}
            showMinusButtons={mode !== 'focus'}
            breakpoint={breakpoint}
            compact={mode === 'focus'}
          />
        </section>
      </main>

      {/* Footer Controls */}
      <FooterBar
        status={match.status}
        onStart={handleStart}
        onPauseResume={handlePauseResume}
        onFinish={handleFinish}
        onLoadNextMatch={handleLoadNextMatch}
        onReopenLastMatch={handleReopenLastMatch}
        hasNextMatch={nextMatch !== null}
        hasLastFinished={lastFinishedMatch !== null}
        breakpoint={breakpoint}
      />

      {/* Tiebreaker Banner */}
      {match.awaitingTiebreakerChoice && (
        <TiebreakerBanner
          homeTeamName={match.homeTeam.name}
          awayTeamName={match.awayTeam.name}
          score={match.homeScore}
          tiebreakerMode={match.tiebreakerMode}
          onStartOvertime={onStartOvertime ? handleStartOvertime : undefined}
          onStartGoldenGoal={onStartGoldenGoal ? handleStartGoldenGoal : undefined}
          onStartPenaltyShootout={onStartPenaltyShootout ? handleStartPenaltyShootout : undefined}
          onCancel={onCancelTiebreaker ? handleCancelTiebreaker : undefined}
        />
      )}

      {/* Time Adjust Dialog */}
      <TimeAdjustDialog
        isOpen={showTimeAdjustDialog}
        onClose={() => setShowTimeAdjustDialog(false)}
        onConfirm={handleTimeAdjust}
        currentTimeSeconds={displayElapsedSeconds}
        matchDurationMinutes={Math.floor(match.durationSeconds / 60)}
      />

      {/* Score Edit Dialog */}
      <ScoreEditDialog
        isOpen={showScoreEditDialog}
        onClose={() => setShowScoreEditDialog(false)}
        onConfirm={handleScoreEdit}
        currentHomeScore={match.homeScore}
        currentAwayScore={match.awayScore}
        homeTeamName={match.homeTeam.name}
        awayTeamName={match.awayTeam.name}
      />

      {/* Card Dialog */}
      <CardDialog
        isOpen={showCardDialog}
        onClose={() => setShowCardDialog(false)}
        onConfirm={handleCardConfirm}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
      />

      {/* Time Penalty Dialog */}
      <TimePenaltyDialog
        isOpen={showTimePenaltyDialog}
        onClose={() => setShowTimePenaltyDialog(false)}
        onConfirm={handleTimePenaltyConfirm}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
      />

      {/* Substitution Dialog */}
      <SubstitutionDialog
        isOpen={showSubstitutionDialog}
        onClose={() => setShowSubstitutionDialog(false)}
        onConfirm={handleSubstitutionConfirm}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
      />

      {/* GoalScorerDialog - opens when +Tor is clicked */}
      <GoalScorerDialog
        isOpen={showGoalDialog}
        onClose={() => {
          setShowGoalDialog(false);
          setPendingGoalTeam(null);
        }}
        onConfirm={handleGoalConfirm}
        teamName={
          pendingGoalTeam === 'home'
            ? match.homeTeam.name
            : pendingGoalTeam === 'away'
              ? match.awayTeam.name
              : ''
        }
        teamColor={colors.primary}
        autoDismissSeconds={10}
      />

      {/* EventEditDialog - for editing incomplete events */}
      <EventEditDialog
        isOpen={showEventEditDialog}
        onClose={() => {
          setShowEventEditDialog(false);
          setSelectedEventId(null);
        }}
        event={
          selectedEventId
            ? (match.events.find((e) => e.id === selectedEventId) as unknown as MatchEvent | null)
            : null
        }
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        onUpdate={(eventId, updates) => {
          // TODO: Implement event update when backend supports it
          showInfo(`Event ${eventId} aktualisiert: ${JSON.stringify(updates)}`);
          setShowEventEditDialog(false);
          setSelectedEventId(null);
        }}
        onDelete={(eventId) => {
          // TODO: Implement event deletion when backend supports it
          showInfo(`Event ${eventId} gelöscht`);
          setShowEventEditDialog(false);
          setSelectedEventId(null);
        }}
      />

      {/* OpenEntriesBottomSheet - Mobile bottom sheet for incomplete events */}
      {isMobileDevice && (
        <OpenEntriesBottomSheet
          openEvents={match.events
            .filter((e) => e.type === 'GOAL' && !(e.payload as { playerNumber?: number }).playerNumber)
            .map((e) => ({
              ...e,
              // Map to MatchEvent format required by OpenEntriesBottomSheet
              timestamp: new Date(),
              matchMinute: Math.floor(e.timestampSeconds / 60),
              createdAt: new Date(),
              updatedAt: new Date(),
              incomplete: !(e.payload as { playerNumber?: number }).playerNumber,
            })) as unknown as MatchEvent[]}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          onEditEvent={(eventId) => {
            setSelectedEventId(eventId);
            setShowEventEditDialog(true);
          }}
          isVisible={true} // Always visible on mobile, component handles expand/collapse
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

// ---------------------------------------------------------------------------
// NextMatchHint Component
// ---------------------------------------------------------------------------

interface NextMatchHintProps {
  homeTeamName: string;
  awayTeamName: string;
  matchNumber: number;
  scheduledTime?: string;
  isMobile: boolean;
}

const NextMatchHint: React.FC<NextMatchHintProps> = ({
  homeTeamName,
  awayTeamName,
  matchNumber: _matchNumber,
  scheduledTime,
  isMobile,
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: `${spacing.xs} ${spacing.sm}`,
    background: colors.infoLight,
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.info}30`,
    fontSize: fontSizes.xs,
  };

  return (
    <div style={containerStyle}>
      <span style={{ color: colors.info, fontWeight: fontWeights.medium }}>
        Nächstes →
      </span>
      <span style={{ color: colors.textPrimary, fontWeight: fontWeights.semibold }}>
        {homeTeamName} vs {awayTeamName}
      </span>
      {scheduledTime && !isMobile && (
        <span style={{ color: colors.textSecondary }}>({scheduledTime})</span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// EventList Component (Extended Mode)
// ---------------------------------------------------------------------------

interface EventListProps {
  events: Array<{
    id: string;
    type: string;
    timestampSeconds: number;
    payload?: {
      teamId?: string;
      teamName?: string;
      direction?: 'INC' | 'DEC';
    };
  }>;
  homeTeamName: string;
  awayTeamName: string;
  isMobile: boolean;
}

const EventList: React.FC<EventListProps> = ({
  events,
  homeTeamName,
  awayTeamName,
  isMobile,
}) => {
  // Show most recent events first, limit to last 3 on mobile, 5 on desktop
  const recentEvents = [...events].reverse().slice(0, isMobile ? 3 : 5);

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: spacing.xs,
    background: colors.surfaceDark,
    borderRadius: borderRadius.sm,
    border: `1px solid ${colors.border}`,
  };

  const headerStyle: CSSProperties = {
    fontSize: '10px',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const eventRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `2px ${spacing.xs}`,
    background: colors.surface,
    borderRadius: '2px',
    fontSize: isMobile ? '11px' : fontSizes.xs,
  };

  const eventIconStyle: CSSProperties = {
    fontSize: isMobile ? '12px' : '14px',
  };

  const eventTimeStyle: CSSProperties = {
    fontSize: '10px',
    color: colors.textSecondary,
    minWidth: '32px',
  };

  const eventTextStyle: CSSProperties = {
    flex: 1,
    color: colors.textPrimary,
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'GOAL': return '⚽';
      case 'UNDO_GOAL': return '↩️';
      case 'START': return '▶️';
      case 'PAUSE': return '⏸️';
      case 'RESUME': return '▶️';
      case 'FINISH': return '🏁';
      default: return '•';
    }
  };

  const getEventDescription = (event: EventListProps['events'][0]) => {
    const teamName = event.payload?.teamName ??
      (event.payload?.teamId === 'home' ? homeTeamName : awayTeamName);

    switch (event.type) {
      case 'GOAL':
        return event.payload?.direction === 'DEC'
          ? `Tor entfernt (${teamName})`
          : `Tor für ${teamName}`;
      case 'RESULT_EDIT':
        return 'Ergebnis korrigiert';
      case 'STATUS_CHANGE':
        return 'Status geändert';
      default:
        return event.type;
    }
  };

  const formatEventTime = (timestampSeconds: number) => {
    const mins = Math.floor(timestampSeconds / 60);
    const secs = timestampSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (recentEvents.length === 0) {
    return null;
  }

  return (
    <div style={containerStyle}>
      <span style={headerStyle}>Letzte Ereignisse</span>
      {recentEvents.map((event) => (
        <div key={event.id} style={eventRowStyle}>
          <span style={eventIconStyle}>{getEventIcon(event.type)}</span>
          <span style={eventTimeStyle}>{formatEventTime(event.timestampSeconds)}</span>
          <span style={eventTextStyle}>{getEventDescription(event)}</span>
        </div>
      ))}
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

export default LiveCockpit;
