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
import { cssVars } from '../../design-tokens'
import { useBreakpoint, useMatchTimerExtended, useMatchSound } from '../../hooks';
import type { LiveCockpitProps } from './types';
import type { ActivePenalty, EditableMatchEvent, MatchCockpitSettings } from '../../types/tournament';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../types/tournament';

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
  // BUG-002: Event Log Bottom Sheet for Mobile
  EventLogBottomSheet,
  // Overflow Menu for quick actions + settings link

  SettingsDialog,
} from './components';

// Hooks
import { useToast } from './hooks';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

// Helper to get cockpit settings with defaults
function getCockpitSettings(settings: MatchCockpitSettings | undefined): MatchCockpitSettings {
  return {
    ...DEFAULT_MATCH_COCKPIT_SETTINGS,
    ...settings,
  };
}

export const LiveCockpitMockup: React.FC<LiveCockpitProps> = ({
  fieldName,
  tournamentName: _tournamentName,
  tournamentId,
  cockpitSettings: cockpitSettingsProp,
  readOnly = false,
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
  // Event tracking handlers (new)
  onTimePenalty,
  onCard,
  onSubstitution,
  onFoul,
  onUpdateEvent,
  onUpdateSettings,
}) => {
  // Get cockpit settings with defaults
  const cockpitSettings = useMemo(
    () => getCockpitSettings(cockpitSettingsProp),
    [cockpitSettingsProp]
  );

  // Sound hook for match end horn
  const sound = useMatchSound(
    cockpitSettings.soundId,
    cockpitSettings.soundVolume,
    cockpitSettings.soundEnabled,
    tournamentId
  );
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
  // BUG-002: Event Log Bottom Sheet for Mobile
  const [showEventLogBottomSheet, setShowEventLogBottomSheet] = useState(false);
  // Overflow Menu (⋮ button in header)

  const [homeFouls, setHomeFouls] = useState(0);
  const [awayFouls, setAwayFouls] = useState(0);
  // Seiten tauschen: Visuelle Darstellung der Teams vertauschen
  const [sidesSwapped, setSidesSwapped] = useState(false);
  // Settings Dialog
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Toast notifications
  const { toasts, showSuccess, showInfo, dismissToast } = useToast();

  // Next match info
  const nextMatch = useMemo(() => {
    return upcomingMatches.length > 0 ? upcomingMatches[0] : null;
  }, [upcomingMatches]);

  // BUG-004 FIX: Real-time timer display using useMatchTimerExtended
  // Supports Countdown, Netto-Warning and Timer State
  const {
    displaySeconds,
    isOvertime,
    timerState
  } = useMatchTimerExtended(
    currentMatch?.timerStartTime ?? null,
    currentMatch?.timerElapsedSeconds ?? 0,
    currentMatch?.status ?? 'NOT_STARTED',
    currentMatch?.durationSeconds ?? 900, // Default 15 min if missing
    cockpitSettings.timerDirection,
    cockpitSettings.nettoWarningSeconds
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
    if (!currentMatch || readOnly) { return; }
    setPendingGoalSide('home');
    setShowGoalDialog(true);
  }, [currentMatch, readOnly]);

  const handleGoalAway = useCallback(() => {
    if (!currentMatch || readOnly) { return; }
    setPendingGoalSide('away');
    setShowGoalDialog(true);
  }, [currentMatch, readOnly]);

  // Callback when GoalScorerDialog confirms
  const handleGoalConfirm = useCallback(
    (jerseyNumber: number | null, assists?: (number | null)[], incomplete?: boolean) => {
      if (!currentMatch || !pendingGoalSide || readOnly) { return; }

      const teamId = pendingGoalSide === 'home' ? currentMatch.homeTeam.id : currentMatch.awayTeam.id;
      const teamName = pendingGoalSide === 'home' ? currentMatch.homeTeam.name : currentMatch.awayTeam.name;

      // Filter out null assists and convert to number array
      const validAssists = assists?.filter((a): a is number => a !== null) ?? [];

      // Call the parent handler with delta +1 and player options
      onGoal(currentMatch.id, teamId, 1, {
        playerNumber: jerseyNumber ?? undefined,
        assists: validAssists.length > 0 ? validAssists : undefined,
        incomplete: incomplete ?? false,
      });

      // Build toast message with jersey number and assists
      if (incomplete) {
        showInfo(`⚽ Tor für ${teamName} (ohne Nr.)`);
      } else if (jerseyNumber !== null) {
        const assistText = validAssists.length > 0
          ? ` (Assist: ${validAssists.map(a => `#${a}`).join(', ')})`
          : '';
        showSuccess(`⚽ Tor für ${teamName} (#${jerseyNumber})${assistText}`);
      } else {
        showSuccess(`⚽ Tor für ${teamName}!`);
      }

      // Reset state
      setPendingGoalSide(null);
      setShowGoalDialog(false);
    },
    [currentMatch, pendingGoalSide, onGoal, showSuccess, showInfo, readOnly]
  );

  const handleMinusHome = useCallback(() => {
    if (!currentMatch || currentMatch.homeScore <= 0 || readOnly) { return; }
    onGoal(currentMatch.id, currentMatch.homeTeam.id, -1);
    showInfo(`Tor für ${currentMatch.homeTeam.name} entfernt`);
  }, [currentMatch, onGoal, showInfo, readOnly]);

  const handleMinusAway = useCallback(() => {
    if (!currentMatch || currentMatch.awayScore <= 0 || readOnly) { return; }
    onGoal(currentMatch.id, currentMatch.awayTeam.id, -1);
    showInfo(`Tor für ${currentMatch.awayTeam.name} entfernt`);
  }, [currentMatch, onGoal, showInfo, readOnly]);

  const handleStart = useCallback(() => {
    if (!currentMatch || readOnly) { return; }
    onStart(currentMatch.id);
    showSuccess('Spiel gestartet!');
  }, [currentMatch, onStart, showSuccess, readOnly]);

  const handleFinish = useCallback(() => {
    if (!currentMatch || readOnly) { return; }

    // Play match end sound if enabled
    if (cockpitSettings.soundEnabled) {
      void sound.play();
    }

    // Trigger haptic feedback if enabled (navigator.vibrate is not available on all browsers)
     
    if (cockpitSettings.hapticEnabled && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]); // Double pulse pattern
    }

    onFinish(currentMatch.id);
    // BUG-008: Clear all active penalties when match ends
    setActivePenalties([]);
    showInfo('Spiel beendet');
  }, [currentMatch, onFinish, showInfo, cockpitSettings.soundEnabled, cockpitSettings.hapticEnabled, sound, readOnly]);

  // Auto-Finish Logic (Moved safely after handleFinish declaration)
  useEffect(() => {
    if (
      cockpitSettings.autoFinishEnabled &&
      currentMatch?.status === 'RUNNING' &&
      isOvertime
    ) {
      // console.log('⏰ Auto-Finish triggered');
      handleFinish();
    }
  }, [
    cockpitSettings.autoFinishEnabled,
    currentMatch?.status,
    isOvertime,
    handleFinish
  ]);

  const handleUndo = useCallback(() => {
    if (!currentMatch || readOnly) { return; }
    onUndoLastEvent(currentMatch.id);
    showInfo('Letzte Aktion rückgängig gemacht');
  }, [currentMatch, onUndoLastEvent, showInfo, readOnly]);

  const handlePauseResume = useCallback(() => {
    if (!currentMatch || readOnly) { return; }
    if (currentMatch.status === 'RUNNING') {
      onPause(currentMatch.id);
      showInfo('Spiel pausiert');
    } else if (currentMatch.status === 'PAUSED') {
      onResume(currentMatch.id);
      showSuccess('Spiel fortgesetzt');
    }
  }, [currentMatch, onPause, onResume, showInfo, showSuccess, readOnly]);

  const handleTimeAdjust = useCallback(
    (newDisplaySeconds: number) => {
      if (!currentMatch || readOnly) { return; }

      let newElapsedSeconds = newDisplaySeconds;

      // If in countdown mode, convert display time (remaining) back to elapsed
      if (cockpitSettings.timerDirection === 'countdown') {
        // User sets "remaining time", so elapsed = duration - remaining
        const duration = currentMatch.durationSeconds; // durationSeconds is required in LiveMatch, defaults handled upstream
        newElapsedSeconds = duration - newDisplaySeconds;
        // Ensure strictly positive bounds (optional, but good practice)
        // newElapsedSeconds = Math.max(0, newElapsedSeconds); 
        // Actually, negative elapsed is possible if user sets > duration (not typical but possible logic)
      }

      onAdjustTime(currentMatch.id, newElapsedSeconds);

      const mins = Math.floor(newDisplaySeconds / 60);
      const secs = newDisplaySeconds % 60;
      showInfo(`Zeit auf ${mins}:${secs.toString().padStart(2, '0')} gesetzt`);
    },
    [currentMatch, onAdjustTime, showInfo, cockpitSettings.timerDirection, readOnly]
  );

  const handleSwitchSides = useCallback(() => {
    setSidesSwapped(prev => !prev);
    showInfo('Seiten getauscht');
  }, [showInfo]);

  const handleHalfTime = useCallback(() => {
    // Reset fouls
    setHomeFouls(0);
    setAwayFouls(0);
    showInfo('Halbzeit - Fouls zurückgesetzt');
  }, [showInfo]);

  const handleFoulHome = useCallback(() => {
    if (!currentMatch || readOnly) { return; }
    const newFouls = homeFouls + 1;
    setHomeFouls(newFouls);

    // Call parent handler to create event
    onFoul?.(currentMatch.id, currentMatch.homeTeam.id);

    showInfo(`Foul für ${currentMatch.homeTeam.name} (${newFouls})`);
    if (newFouls === 5) {
      showInfo(`⚠ ACHTUNG: ${currentMatch.homeTeam.name} hat 5 Fouls!`);
    }
  }, [currentMatch, homeFouls, onFoul, showInfo, readOnly]);

  const handleFoulAway = useCallback(() => {
    if (!currentMatch || readOnly) { return; }
    const newFouls = awayFouls + 1;
    setAwayFouls(newFouls);

    // Call parent handler to create event
    onFoul?.(currentMatch.id, currentMatch.awayTeam.id);

    showInfo(`Foul für ${currentMatch.awayTeam.name} (${newFouls})`);
    if (newFouls === 5) {
      showInfo(`⚠ ACHTUNG: ${currentMatch.awayTeam.name} hat 5 Fouls!`);
    }
  }, [currentMatch, awayFouls, onFoul, showInfo, readOnly]);

  // Card/Penalty/Substitution handlers
  const handleCardConfirm = useCallback(
    (cardType: 'YELLOW' | 'RED', teamId: string, playerNumber?: number) => {
      if (!currentMatch || readOnly) { return; }

      const teamName = currentMatch.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch.awayTeam.name;
      const playerInfo = playerNumber ? ` (#${playerNumber})` : '';
      const cardName = cardType === 'YELLOW' ? 'Gelbe' : 'Rote';

      // Call parent handler to create event
      onCard?.(currentMatch.id, teamId, cardType, { playerNumber });

      showInfo(`${cardName} Karte für ${teamName}${playerInfo}`);
      setShowCardDialog(false);
      // BUG-007: Reset pending card state
      setPendingCardType(null);
      setPendingCardTeamSide(null);
    },
    [currentMatch, onCard, showInfo, readOnly]
  );

  const handleTimePenaltyConfirm = useCallback(
    (durationSeconds: number, teamId: string, playerNumber?: number) => {
      if (!currentMatch || readOnly) { return; }
      const teamName = currentMatch.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch.awayTeam.name;
      const mins = Math.floor(durationSeconds / 60);
      const playerInfo = playerNumber ? ` (#${playerNumber})` : '';

      // Call parent handler to create event
      onTimePenalty?.(currentMatch.id, teamId, {
        playerNumber,
        durationSeconds,
      });

      showInfo(`${mins} Min Zeitstrafe für ${teamName}${playerInfo}`);

      // Add to active penalties (local UI state for countdown)
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
    [currentMatch, onTimePenalty, showInfo, readOnly]
  );

  // BUG-009: Updated to handle multi-player substitutions
  const handleSubstitutionConfirm = useCallback(
    (teamId: string, playersOut: number[], playersIn: number[]) => {
      if (!currentMatch || readOnly) { return; }
      const teamName = currentMatch.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch.awayTeam.name;

      // Call parent handler to create event
      onSubstitution?.(currentMatch.id, teamId, {
        playersOut: playersOut.length > 0 ? playersOut : undefined,
        playersIn: playersIn.length > 0 ? playersIn : undefined,
      });

      // Format player numbers for display
      const outInfo = playersOut.length > 0 ? playersOut.map(n => `#${n}`).join(',') : '?';
      const inInfo = playersIn.length > 0 ? playersIn.map(n => `#${n}`).join(',') : '?';
      showInfo(`🔄 Wechsel ${teamName}: ${outInfo} → ${inInfo}`);
      setShowSubstitutionDialog(false);
      setPendingSubstitutionSide(null);
    },
    [currentMatch, onSubstitution, showInfo, readOnly]
  );

  // BUG-010: Handler for editing events from the sidebar
  const handleEventEdit = useCallback(
    (event: { id: string; type: string; timestampSeconds: number; payload?: Record<string, unknown>; incomplete?: boolean }) => {
      if (!currentMatch || readOnly) { return; }
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
    [currentMatch, readOnly]
  );

  // BUG-010: Handler for updating event details
  const handleEventUpdate = useCallback(
    (eventId: string, updates: { playerNumber?: number; incomplete?: boolean }) => {
      if (!currentMatch || readOnly) { return; }
      const event = currentMatch.events.find(e => e.id === eventId);
      if (!event) { return; }

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

      // Call parent handler to persist update
      if (onUpdateEvent) {
        onUpdateEvent(currentMatch.id, eventId, updates);
        showSuccess(`✅ ${label}${playerInfo} aktualisiert`);
      } else {
        showInfo(`(Preview) ${label}${playerInfo} aktualisiert`);
      }
    },
    [currentMatch, showSuccess, showInfo, onUpdateEvent, readOnly]
  );

  // BUG-010: Handler for deleting events (with score adjustment for GOALs)
  const handleEventDelete = useCallback(
    (eventId: string) => {
      if (!currentMatch || readOnly) { return; }
      const event = currentMatch.events.find(e => e.id === eventId);
      if (!event) { return; }

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
    [currentMatch, onGoal, showInfo, readOnly]
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
    background: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    minHeight: 'var(--min-h-screen)',
    display: 'flex',
    flexDirection: 'column',
  };

  const contentStyle: CSSProperties = {
    padding: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
    flex: 1,
  };

  // Match Header
  const matchHeaderStyle: CSSProperties = {
    background: cssVars.colors.surfaceSolid,
    borderRadius: cssVars.borderRadius.lg,
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: cssVars.spacing.md,
  };

  const matchInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
  };

  const matchNumberStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.bold,
    fontSize: cssVars.fontSizes.md,
  };

  const matchFieldStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const statusBadgeStyle: CSSProperties = {
    background: match.status === 'RUNNING'
      ? cssVars.colors.primaryLight
      : cssVars.colors.surfaceElevated,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.semibold,
    textTransform: 'uppercase',
    color: match.status === 'RUNNING' ? cssVars.colors.primary : cssVars.colors.textPrimary,
  };



  // Next Banner
  const nextBannerStyle: CSSProperties = {
    background: `linear-gradient(90deg, ${cssVars.colors.dangerGradientStart} 0%, ${cssVars.colors.dangerGradientEnd} 100%)`,
    border: `1px solid ${cssVars.colors.dangerBorder}`,
    borderRadius: cssVars.borderRadius.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.sm,
    display: 'flex',
    gap: cssVars.spacing.sm,
  };

  // Main Grid
  const mainGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isDesktop ? '1fr 300px' : '1fr',
    gap: cssVars.spacing.lg,
  };

  // Scoreboard
  const scoreboardStyle: CSSProperties = {
    background: cssVars.colors.surfaceSolid,
    borderRadius: cssVars.borderRadius.lg,
    padding: isMobile ? cssVars.spacing.md : cssVars.spacing.xl,
  };

  // Timer Row
  const timerRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: cssVars.spacing.md,
    marginBottom: cssVars.spacing.lg,
  };

  const timerLabelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '1px',
  };

  const timerStyle: CSSProperties = {
    fontSize: isMobile ? '48px' : '64px',
    fontWeight: cssVars.fontWeights.bold,
    fontVariantNumeric: 'tabular-nums',
    cursor: !isFinished ? 'pointer' : 'default',
    color: timerState === 'netto-warning'
      ? cssVars.colors.warning
      : timerState === 'overtime' || timerState === 'zero'
        ? cssVars.colors.error
        : cssVars.colors.textPrimary,
    transition: 'color 0.3s ease',
  };

  const timerTotalStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    color: cssVars.colors.textSecondary,
  };

  // Score Row
  const scoreRowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: isMobile ? cssVars.spacing.sm : cssVars.spacing.lg,
    alignItems: 'start',
  };

  const scoreDividerStyle: CSSProperties = {
    fontSize: '48px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textMuted,
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

          <div style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.sm }}>
            <span style={statusBadgeStyle} data-testid="match-status-badge">{getStatusLabel()}</span>

          </div>
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
            <span style={{ color: cssVars.colors.error, fontWeight: cssVars.fontWeights.semibold }}>
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
                data-testid="match-timer-display"
              >
                {formatTime(displaySeconds)}
              </span>
              <span style={timerTotalStyle}>
                / {formatTime(match.durationSeconds)}
              </span>
            </div>

            {/* Score Row - Teams können mit "Seiten tauschen" vertauscht werden */}
            <div style={scoreRowStyle}>
              {/* Linkes Team (Home oder Away je nach sidesSwapped) */}
              <TeamBlock
                teamName={sidesSwapped ? match.awayTeam.name : match.homeTeam.name}
                teamLabel={sidesSwapped ? 'Gast' : 'Heim'}
                score={sidesSwapped ? match.awayScore : match.homeScore}
                fouls={sidesSwapped ? awayFouls : homeFouls}
                disabled={isFinished || isNotStarted}
                breakpoint={breakpoint}
                side={sidesSwapped ? 'away' : 'home'}
                onGoal={sidesSwapped ? handleGoalAway : handleGoalHome}
                onMinus={sidesSwapped ? handleMinusAway : handleMinusHome}
                onPenalty={() => {
                  setPendingPenaltySide(sidesSwapped ? 'away' : 'home');
                  setShowTimePenaltyDialog(true);
                }}
                onYellowCard={() => {
                  setPendingCardType('YELLOW');
                  setPendingCardTeamSide(sidesSwapped ? 'away' : 'home');
                  setShowCardDialog(true);
                }}
                onRedCard={() => {
                  setPendingCardType('RED');
                  setPendingCardTeamSide(sidesSwapped ? 'away' : 'home');
                  setShowCardDialog(true);
                }}
                onSubstitution={() => {
                  setPendingSubstitutionSide(sidesSwapped ? 'away' : 'home');
                  setShowSubstitutionDialog(true);
                }}
                onFoul={sidesSwapped ? handleFoulAway : handleFoulHome}
                canDecrement={sidesSwapped ? canDecrementAway : canDecrementHome}
              />

              {/* Divider */}
              <span style={scoreDividerStyle}>:</span>

              {/* Rechtes Team (Away oder Home je nach sidesSwapped) */}
              <TeamBlock
                teamName={sidesSwapped ? match.homeTeam.name : match.awayTeam.name}
                teamLabel={sidesSwapped ? 'Heim' : 'Gast'}
                score={sidesSwapped ? match.homeScore : match.awayScore}
                fouls={sidesSwapped ? homeFouls : awayFouls}
                disabled={isFinished || isNotStarted}
                breakpoint={breakpoint}
                side={sidesSwapped ? 'home' : 'away'}
                onGoal={sidesSwapped ? handleGoalHome : handleGoalAway}
                onMinus={sidesSwapped ? handleMinusHome : handleMinusAway}
                onPenalty={() => {
                  setPendingPenaltySide(sidesSwapped ? 'home' : 'away');
                  setShowTimePenaltyDialog(true);
                }}
                onYellowCard={() => {
                  setPendingCardType('YELLOW');
                  setPendingCardTeamSide(sidesSwapped ? 'home' : 'away');
                  setShowCardDialog(true);
                }}
                onRedCard={() => {
                  setPendingCardType('RED');
                  setPendingCardTeamSide(sidesSwapped ? 'home' : 'away');
                  setShowCardDialog(true);
                }}
                onSubstitution={() => {
                  setPendingSubstitutionSide(sidesSwapped ? 'home' : 'away');
                  setShowSubstitutionDialog(true);
                }}
                onFoul={sidesSwapped ? handleFoulHome : handleFoulAway}
                canDecrement={sidesSwapped ? canDecrementHome : canDecrementAway}
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
              onSettings={() => setShowSettingsDialog(true)}
              // BUG-002: Event Log for Mobile
              onEventLog={() => setShowEventLogBottomSheet(true)}
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
        currentTimeSeconds={displaySeconds}
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
        teamColor={cssVars.colors.primary}
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

      {/* BUG-002: Event Log Bottom Sheet for Mobile */}
      <EventLogBottomSheet
        isOpen={showEventLogBottomSheet}
        onClose={() => setShowEventLogBottomSheet(false)}
        events={match.events}
        homeTeamName={match.homeTeam.name}
        awayTeamName={match.awayTeam.name}
        homeTeamId={match.homeTeam.id}
        awayTeamId={match.awayTeam.id}
        onEventEdit={(event) => {
          setShowEventLogBottomSheet(false);
          setEditingEvent(event);
          setShowEventEditDialog(true);
        }}
      />



      <SettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        settings={cockpitSettings}
        onChange={(newSettings) => {
          if (onUpdateSettings) {
            onUpdateSettings(newSettings);
          }
        }}
        tournamentId={tournamentId}
        onTestSound={() => void sound.play()}
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
  background: cssVars.colors.background,
};

const noMatchTextStyle: CSSProperties = {
  color: cssVars.colors.textSecondary,
  fontSize: '1.125rem',
};

export default LiveCockpitMockup;
