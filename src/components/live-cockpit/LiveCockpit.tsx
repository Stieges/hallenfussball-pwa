/**
 * LiveCockpit - Live Match Control Interface
 *
 * A touch-optimized interface for tournament directors to manage live matches.
 * Features: Timer, Score Control, Event Tracking, Fouls, Cards, Substitutions.
 *
 * Layout:
 * - Desktop: Main grid (scoreboard + sidebar)
 * - Mobile: Stacked layout with bottom footer
 */

import { useState, useCallback, useMemo, useEffect, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens'
import { useBreakpoint, useMatchTimerExtended, useMatchSound } from '../../hooks';
import { useFoulCounts } from '../../hooks/useFoulCounts';
import { useFoulThresholdWarning } from '../../hooks/useFoulThresholdWarning';
import { useEngineEventEditing } from '../../hooks/useEngineEventEditing';
import { SyncStatusIndicator } from '../../features/collaboration';
import { OutboxNotice } from '../../features/collaboration/outbox/OutboxNotice';
import { useOutboxStatus } from '../../features/collaboration/outbox/useOutboxStatus';
import { useRejectedOutboxDialog } from '../../features/collaboration/outbox/useRejectedOutboxDialog';
import { RejectedOutboxDialog } from '../../features/collaboration/outbox/RejectedOutboxDialog';
import { useMatchEngineContextOptional } from '../../features/match-engine/useMatchEngineContext';
import { getEffectiveScore } from '../../utils/matchScore';
import type { LiveCockpitProps } from './types';
import type { EditableMatchEvent, MatchCockpitSettings } from '../../types/tournament';
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
  TiebreakerBanner,
  PenaltyShootoutDialog,
} from './components';
import { AudioActivationBanner } from '../match-cockpit/AudioActivationBanner';

// Hooks
import { useToast } from './hooks';
import { useActivePenalties } from './hooks/useActivePenalties';

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

export const LiveCockpit: React.FC<LiveCockpitProps> = ({
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
  onStartOvertime,
  onStartGoldenGoal,
  onStartPenaltyShootout,
  onRecordPenaltyResult,
  onForceFinish,
  onAbortPenaltyShootout,
  // Event tracking handlers (new)
  onTimePenalty,
  onCard,
  onSubstitution,
  onFoul,
  onUpdateEvent,
  onDeleteEvent,
  onUpdateSettings,
}) => {
  const { t } = useTranslation('cockpit');

  // W1 (Nachtrag C3a-2a): nur einbinden -- OutboxNotice rendert selbst nichts, solange kein
  // Ausgangs-Zustand vorliegt (kind === null).
  const matchEngineContext = useMatchEngineContextOptional();
  const outboxStatus = useOutboxStatus(matchEngineContext?.sender ?? null);
  const handleOutboxReload = useCallback(() => window.location.reload(), []);

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
  // M-1 FIX: Store only event ID, not the full object, to avoid stale data
  const [showEventEditDialog, setShowEventEditDialog] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  // BUG-002: Event Log Bottom Sheet for Mobile
  const [showEventLogBottomSheet, setShowEventLogBottomSheet] = useState(false);
  // Overflow Menu (⋮ button in header)

  // C3b-2b (G11): Foul-Zaehler aus den FOUL-Eintraegen in `events` -- ganzes Spiel, kein
  // Halbzeit-Reset, kein lokales +1 (zurueckgenommenes zaehlt nicht, G6/RC13).
  const { home: homeFouls, away: awayFouls } = useFoulCounts(currentMatch);
  // Seiten tauschen: Visuelle Darstellung der Teams vertauschen
  const [sidesSwapped, setSidesSwapped] = useState(false);
  // Settings Dialog
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  // L1: Strafstoßschießen-Dialog (Task 11)
  const [showPenaltyDialog, setShowPenaltyDialog] = useState(false);

  // Toast notifications
  const { toasts, showSuccess, showInfo, showError: showToastError, dismissToast } = useToast();

  // M7: 5-Fouls-Warnung als Effekt auf den Zaehler -- einmal je Team beim Erreichen von 5.
  useFoulThresholdWarning(
    { home: homeFouls, away: awayFouls },
    { home: currentMatch?.homeTeam.name ?? '', away: currentMatch?.awayTeam.name ?? '' },
    (teamName) => { showInfo(t('toast.foulWarning', { teamName })); },
  );

  // C3b-1: Minus/Rückgängig/Löschen/Bearbeiten (Engine-Spiele: RETRACT/AMEND) und Zeitstrafen-Countdown.
  const editing = useEngineEventEditing({
    tournamentId,
    match: currentMatch,
    readOnly,
    legacy: { onGoal, onUndoLastEvent, onUpdateEvent, onDeleteEvent },
    notify: { success: showSuccess, error: showToastError },
  });
  const penalties = useActivePenalties(currentMatch?.id, currentMatch?.status, currentMatch?.events);

  // I4 (W1, Nachtrag Fixrunde 1): Helfer im Cockpit sahen Ablehnungen (D-C1) bisher nirgends, nur
  // im AdminHeader -- dieselbe Verdrahtung wie dort (P8/Fixrunde 3: gemeinsamer Hook statt
  // doppeltem Code).
  const rejectedOutbox = useRejectedOutboxDialog(tournamentId, showToastError);

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

  // C-2 FIX: Reset all dialog states when match changes to prevent stale data
  // RC13/PC20 (C3a-2a, vorgezogen aus C3b): haengt NUR an `match.id` -- NICHT an
  // `currentMatch?.events`. Grund (per Fixrunde 2 belegt, s. task-C3a-report.md "C3a-2a
  // Fixrunde 2"): eine echte Engine-Aenderung AM SELBEN Spiel baut ein neues LiveMatch-Objekt
  // inkl. neuem `events`-Array, obwohl sich am Spiel selbst nichts geaendert hat. Mit
  // `currentMatch?.events` als Abhaengigkeit schloss dieser Effekt dabei ALLE offenen Dialoge --
  // riss z. B. den gerade offenen GoalScorerDialog waehrend der Torschuetzen-Eingabe weg (C1).
  // Regressionstest: `LiveCockpit.dialogReset.test.tsx`.
  const currentMatchId = currentMatch?.id;
  useEffect(() => {
    // Reset all dialog visibility states
    setShowTimeAdjustDialog(false);
    setShowCardDialog(false);
    setShowTimePenaltyDialog(false);
    setShowSubstitutionDialog(false);
    setShowGoalDialog(false);
    setShowEventEditDialog(false);
    setShowEventLogBottomSheet(false);
    setShowSettingsDialog(false);

    // Reset pending action states
    setPendingGoalSide(null);
    setPendingPenaltySide(null);
    setPendingCardType(null);
    setPendingCardTeamSide(null);
    setPendingSubstitutionSide(null);
    setEditingEventId(null);
  }, [currentMatchId]);

  // M-1 FIX: Derive editing event from current match events to always have fresh data
  // This prevents stale data when another tab modifies the event
  const editingEvent = useMemo((): EditableMatchEvent | null => {
    if (!editingEventId || !currentMatch?.events) {
      return null;
    }
    const event = currentMatch.events.find(e => e.id === editingEventId);
    if (!event) {
      return null;
    }
    return {
      id: event.id,
      type: event.type,
      timestampSeconds: event.timestampSeconds,
      payload: event.payload,
    };
  }, [editingEventId, currentMatch?.events]);

  // ---------------------------------------------------------------------------
  // Handler Adapters
  // ---------------------------------------------------------------------------

  // Open GoalScorerDialog instead of direct goal
  const handleGoalHome = useCallback(() => {
    if (!currentMatch) { return; }
    setPendingGoalSide('home');
    setShowGoalDialog(true);
  }, [currentMatch]);

  const handleGoalAway = useCallback(() => {
    if (!currentMatch) { return; }
    setPendingGoalSide('away');
    setShowGoalDialog(true);
  }, [currentMatch]);

  // Callback when GoalScorerDialog confirms
  const handleGoalConfirm = useCallback(
    (jerseyNumber: number | null, assists?: (number | null)[], incomplete?: boolean) => {
      if (!currentMatch || !pendingGoalSide) { return; }

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
        showInfo(`⚽ ${t('toast.goalScored', { teamName })} (ohne Nr.)`);
      } else if (jerseyNumber !== null) {
        const assistText = validAssists.length > 0
          ? ` (${t('sidebar.assistFormat', { assists: validAssists.map(a => `#${a}`).join(', ') })})`
          : '';
        showSuccess(`⚽ ${t('toast.goalScored', { teamName })} (#${jerseyNumber})${assistText}`);
      } else {
        showSuccess(`⚽ ${t('toast.goalScored', { teamName })}!`);
      }

      // Reset state
      setPendingGoalSide(null);
      setShowGoalDialog(false);
    },
    [currentMatch, pendingGoalSide, onGoal, showSuccess, showInfo, t]
  );

  const handleMinusHome = useCallback(() => { void editing.minus('home'); }, [editing]);
  const handleMinusAway = useCallback(() => { void editing.minus('away'); }, [editing]);

  const handleStart = useCallback(() => {
    if (!currentMatch) { return; }
    onStart(currentMatch.id);
    showSuccess('Spiel gestartet!');
  }, [currentMatch, onStart, showSuccess]);

  const handleFinish = useCallback(() => {
    if (!currentMatch) { return; }

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
    penalties.clear();
    showInfo('Spiel beendet');
  }, [currentMatch, onFinish, showInfo, cockpitSettings.soundEnabled, cockpitSettings.hapticEnabled, sound, penalties]);

  // Auto-Finish Logic (Moved safely after handleFinish declaration)
  // R4/H3: readOnly darf auch automatisch nichts beenden — sonst beendet das Gerät eines
  // Viewers/Trainers das Spiel selbst, die DB lehnt ab, der Eintrag landet in der
  // Dead-Letter-Queue und der lokale Stand weicht ab (final-review.md H3).
  useEffect(() => {
    if (
      !readOnly &&
      cockpitSettings.autoFinishEnabled &&
      currentMatch?.status === 'RUNNING' &&
      isOvertime
    ) {
      // console.log('⏰ Auto-Finish triggered');
      handleFinish();
    }
  }, [
    readOnly,
    cockpitSettings.autoFinishEnabled,
    currentMatch?.status,
    isOvertime,
    handleFinish
  ]);

  const handleUndo = useCallback(() => { void editing.undo(); }, [editing]);

  const handlePauseResume = useCallback(() => {
    if (!currentMatch) { return; }
    if (currentMatch.status === 'RUNNING') {
      onPause(currentMatch.id);
      showInfo('Spiel pausiert');
    } else if (currentMatch.status === 'PAUSED') {
      onResume(currentMatch.id);
      showSuccess('Spiel fortgesetzt');
    }
  }, [currentMatch, onPause, onResume, showInfo, showSuccess]);

  const handleTimeAdjust = useCallback(
    (newDisplaySeconds: number) => {
      if (!currentMatch) { return; }

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
    [currentMatch, onAdjustTime, showInfo, cockpitSettings.timerDirection]
  );

  const handleSwitchSides = useCallback(() => {
    setSidesSwapped(prev => !prev);
    showInfo('Seiten getauscht');
  }, [showInfo]);

  const handleHalfTime = useCallback(() => {
    // C3b-2b (G11): kein Foul-Reset -- die Zaehler gelten fuer das ganze Spiel.
    showInfo(t('toast.halftime'));
  }, [showInfo, t]);

  const handleFoulHome = useCallback(() => {
    if (!currentMatch) { return; }
    onFoul?.(currentMatch.id, currentMatch.homeTeam.id);
    showInfo(t('toast.foul', { teamName: currentMatch.homeTeam.name }));
  }, [currentMatch, onFoul, showInfo, t]);

  const handleFoulAway = useCallback(() => {
    if (!currentMatch) { return; }
    onFoul?.(currentMatch.id, currentMatch.awayTeam.id);
    showInfo(t('toast.foul', { teamName: currentMatch.awayTeam.name }));
  }, [currentMatch, onFoul, showInfo, t]);

  // Card/Penalty/Substitution handlers
  const handleCardConfirm = useCallback(
    (cardType: 'YELLOW' | 'YELLOW_RED' | 'RED', teamId: string, playerNumber?: number) => {
      if (!currentMatch) { return; }

      const teamName = currentMatch.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch.awayTeam.name;
      const playerInfo = playerNumber ? ` (#${playerNumber})` : '';

      // Call parent handler to create event
      onCard?.(currentMatch.id, teamId, cardType, { playerNumber });

      showInfo(`${t(cardType === 'YELLOW' ? 'toast.yellowCard' : 'toast.redCard', { teamName })}${playerInfo}`);
      setShowCardDialog(false);
      // BUG-007: Reset pending card state
      setPendingCardType(null);
      setPendingCardTeamSide(null);
    },
    [currentMatch, onCard, showInfo, t]
  );

  const handleTimePenaltyConfirm = useCallback(
    (durationSeconds: number, teamId: string, playerNumber?: number) => {
      if (!currentMatch) { return; }
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

      showInfo(`${t('toast.timePenalty', { minutes: mins, teamName })}${playerInfo}`);

      // Add to active penalties (local UI state for countdown)
      penalties.add({ teamId, playerNumber, durationSeconds });
      setShowTimePenaltyDialog(false);
      setPendingPenaltySide(null);
    },
    [currentMatch, onTimePenalty, showInfo, penalties, t]
  );

  // BUG-009: Updated to handle multi-player substitutions
  const handleSubstitutionConfirm = useCallback(
    (teamId: string, playersOut: number[], playersIn: number[]) => {
      if (!currentMatch) { return; }
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
    [currentMatch, onSubstitution, showInfo]
  );

  // BUG-010: Handler for editing events from the sidebar
  // M-1 FIX: Store only event ID, the actual event is derived via useMemo
  const handleEventEdit = useCallback(
    (event: { id: string; type: string; timestampSeconds: number; payload?: Record<string, unknown>; incomplete?: boolean }) => {
      if (!currentMatch) { return; }
      // Verify event exists in match (defensive check)
      const exists = currentMatch.events.some(e => e.id === event.id);
      if (exists) {
        setEditingEventId(event.id);
        setShowEventEditDialog(true);
      }
    },
    [currentMatch]
  );

  // BUG-010 / C3b-1: Bearbeiten (AMEND) und Löschen (RETRACT) laufen im Hook.
  const handleEventUpdate = editing.update;
  const handleEventDelete = editing.remove;

  // L1: Tiebreaker-Handler — leiten die Entscheidung an den Parent weiter (matchId).
  const handleStartOvertime = useCallback(() => { if (!currentMatch) { return; } onStartOvertime?.(currentMatch.id); }, [currentMatch, onStartOvertime]);
  const handleStartGoldenGoal = useCallback(() => { if (!currentMatch) { return; } onStartGoldenGoal?.(currentMatch.id); }, [currentMatch, onStartGoldenGoal]);
  const handleStartPenaltyShootout = useCallback(() => {
    if (!currentMatch) { return; }
    onStartPenaltyShootout?.(currentMatch.id);
    setShowPenaltyDialog(true);
  }, [currentMatch, onStartPenaltyShootout]);
  // "Als Unentschieden beenden": MatchExecutionService.cancelTiebreaker persistiert als regulären Ausgang.
  const handleEndAsDraw = useCallback(() => { if (!currentMatch) { return; } onForceFinish?.(currentMatch.id); }, [currentMatch, onForceFinish]);

  // L1: Strafstoßschießen — der Dialog verwaltet seine Schussliste selbst, wir brauchen nur das Endergebnis.
  // MatchExecutionService.recordPenaltyResult schreibt penaltyScoreA/B, decidedBy='penalty' (524–541).
  const handlePenaltyFinish = useCallback((homeScore: number, awayScore: number) => {
    if (!currentMatch) { return; }
    onRecordPenaltyResult?.(currentMatch.id, homeScore, awayScore);
    setShowPenaltyDialog(false);
  }, [currentMatch, onRecordPenaltyResult]);
  // Fixwave-Fix (Critical): "Abbrechen" bricht das Strafstoßschießen ab und zeigt wieder das
  // Tiebreaker-Banner — bewusst NICHT onCancelTiebreaker (beendet das Spiel als Unentschieden,
  // das ist dem separaten "Als Unentschieden beenden"-Knopf im Banner vorbehalten, siehe handleEndAsDraw).
  const handlePenaltyCancel = useCallback(() => {
    if (!currentMatch) { return; }
    setShowPenaltyDialog(false);
    onAbortPenaltyShootout?.(currentMatch.id);
  }, [currentMatch, onAbortPenaltyShootout]);

  // L1: Dialog an die persistierte Phase koppeln (matches.live_state.playPhase über Realtime) —
  // der Zustand kann von einem anderen Gerät kommen, nicht nur über handleStartPenaltyShootout oben.
  // Fixwave-Fix (Critical): zusätzlich awaitingTiebreakerChoice prüfen — abortPenaltyShootout setzt
  // dieses Flag, um den Dialog zu schließen, OHNE playPhase zu ändern (siehe Service-Kommentar).
  useEffect(() => {
    setShowPenaltyDialog(
      currentMatch?.playPhase === 'penalty' &&
      currentMatch.status !== 'FINISHED' &&
      !currentMatch.awaitingTiebreakerChoice
    );
  }, [currentMatch?.playPhase, currentMatch?.status, currentMatch?.awaitingTiebreakerChoice]);

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
  const effectiveScore = getEffectiveScore(match);
  const isFinished = match.status === 'FINISHED';
  // Task R2: readOnly kommt aus einer echten Berechtigungsprüfung (ManagementTab.checkCanEditMatch
  // → canEditResults), isFinished ist die bestehende "Spiel ist vorbei"-Sperre. Beide führen zum
  // selben Ergebnis (keine Bedienung), aber nur `readOnly` zeigt das Berechtigungs-Banner unten —
  // ein beendetes Spiel braucht keine "du hast keine Berechtigung"-Erklärung, das sagt schon der
  // Status-Badge ("BEENDET").
  const isLocked = readOnly || isFinished;
  const isNotStarted = match.status === 'NOT_STARTED';
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



  // Task R2: Read-Only-Banner — sichtbar, wenn readOnly (Berechtigungssperre), nicht bei
  // isFinished allein (dafür steht schon der Status-Badge "BEENDET").
  const readOnlyBannerStyle: CSSProperties = {
    background: cssVars.colors.warningBannerBg,
    border: `1px solid ${cssVars.colors.warningBannerBorder}`,
    borderRadius: cssVars.borderRadius.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    fontWeight: cssVars.fontWeights.semibold,
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
    cursor: !isLocked ? 'pointer' : 'default',
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
            {/* A4 (C-SYNC): SyncStatusIndicator rendert selbst nichts außerhalb des Cloud-Modus
                (isCloudSyncAvailable in useSyncStatus) -- kein zusätzlicher Auth-Check hier nötig.
                I4 (W1, Nachtrag Fixrunde 1): rejectedCount/reviewCount jetzt aus dem echten Sender
                (useEngineOutboxSummary), nicht mehr die bisherigen Default-Nullen. */}
            <SyncStatusIndicator
              tournamentId={tournamentId}
              compact
              rejectedCount={rejectedOutbox.rejectedCount}
              reviewCount={rejectedOutbox.reviewCount}
              onShowRejected={rejectedOutbox.show}
              enginePendingCount={rejectedOutbox.pendingCount}
            />
            <span style={statusBadgeStyle} data-testid="match-status-badge">{getStatusLabel()}</span>
            {/* ARIA-live region for screen readers to announce status changes */}
            <span
              aria-live="polite"
              aria-atomic="true"
              style={{
                position: 'absolute',
                left: -9999,
                width: 1,
                height: 1,
                overflow: 'hidden',
              }}
            >
              {match.status === 'RUNNING'
                ? 'Spiel läuft'
                : match.status === 'PAUSED'
                  ? 'Spiel pausiert'
                  : match.status === 'FINISHED'
                    ? 'Spiel beendet'
                    : 'Spiel noch nicht gestartet'}
            </span>
          </div>
        </div>

        {/* Task R2: Read-Only-Banner — nur bei fehlender Berechtigung (readOnly), nicht bei
            beendetem Spiel allein. */}
        {readOnly && (
          <div style={readOnlyBannerStyle} data-testid="cockpit-readonly-banner" role="status">
            {t('readOnly.banner')}
          </div>
        )}

        {/* W1 (Nachtrag C3a-2a): nur einbinden -- rendert selbst nichts, solange kein
            Ausgangs-Zustand (clientOutdated/authRequired/notReady/review) vorliegt. */}
        <OutboxNotice status={outboxStatus} matchId={match.id} onReload={handleOutboxReload} />

        {/* I4 (W1, Nachtrag Fixrunde 1): nur einbinden -- Dialog zeigt die Ablehnungsliste dieses
            Turniers, "Verstanden" ruft dismiss (store.dismissRejected + m7-Benachrichtigung). */}
        <RejectedOutboxDialog
          isOpen={rejectedOutbox.isOpen}
          onClose={rejectedOutbox.close}
          entries={rejectedOutbox.entries}
          onDismiss={rejectedOutbox.handleDismiss}
        />

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
                onClick={() => !isLocked && setShowTimeAdjustDialog(true)}
                role="button"
                tabIndex={0}
                aria-disabled={isLocked}
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
                score={sidesSwapped ? effectiveScore.away : effectiveScore.home}
                fouls={sidesSwapped ? awayFouls : homeFouls}
                disabled={isLocked || isNotStarted}
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
                {...editing.teamBlockProps(sidesSwapped ? 'away' : 'home')}
              />

              {/* Divider */}
              <span style={scoreDividerStyle}>:</span>

              {/* Rechtes Team (Away oder Home je nach sidesSwapped) */}
              <TeamBlock
                teamName={sidesSwapped ? match.homeTeam.name : match.awayTeam.name}
                teamLabel={sidesSwapped ? 'Heim' : 'Gast'}
                score={sidesSwapped ? effectiveScore.home : effectiveScore.away}
                fouls={sidesSwapped ? homeFouls : awayFouls}
                disabled={isLocked || isNotStarted}
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
                {...editing.teamBlockProps(sidesSwapped ? 'home' : 'away')}
              />
            </div>

            {/* Game Controls */}
            <GameControls
              status={match.status}
              onUndo={editing.undoVisible ? handleUndo : undefined}
              onStart={handleStart}
              onPauseResume={handlePauseResume}
              onEditTime={() => setShowTimeAdjustDialog(true)}
              onSwitchSides={handleSwitchSides}
              onHalfTime={handleHalfTime}
              onFinish={handleFinish}
              onSettings={() => setShowSettingsDialog(true)}
              // BUG-002: Event Log for Mobile
              onEventLog={() => setShowEventLogBottomSheet(true)}
              canUndo={editing.canUndo}
              undoLabel={editing.undoLabel}
              undoHint={editing.undoHint}
              breakpoint={breakpoint}
              // Task R2: sperrt Rückgängig/Start-Pause/Zeit/Seiten/Halbzeit/Beenden, wenn
              // readOnly/finished — unverändert gegenüber 235d947 (dort schon isFinished-gesperrt).
              // Settings/Event-Log sind davon NICHT betroffen (GameControls sperrt sie nie über
              // `disabled` — siehe dort). Fixrunde 3 (Review-Befund M): der Settings-Button öffnet
              // sich deshalb jetzt auch unter readOnly immer, `SettingsDialog` sperrt stattdessen
              // die Eingaben selbst (siehe `readOnly`-Prop dort unten).
              disabled={isLocked}
            />
          </div>

          {/* Sidebar - Desktop only */}
          {isDesktop && (
            <Sidebar
              activePenalties={penalties.penalties}
              events={match.events}
              retractedEvents={match.retractedEvents}
              homeTeamName={match.homeTeam.name}
              awayTeamName={match.awayTeam.name}
              homeTeamId={match.homeTeam.id}
              awayTeamId={match.awayTeam.id}
              // BUG-010: Enable event editing — Task R2 Fixrunde 2 (M2/Rule 1): gesperrt NUR bei
              // echter readOnly-Sperre, nicht bei isFinished allein. Vor R2 (235d947) war dieser
              // Button nie durch isFinished gesperrt (Bearbeiten nach Spielende war immer
              // möglich) — `isLocked` hätte das für readOnly=false+isFinished neu gesperrt, eine
              // Regression gegen Rule 1. `undefined` blendet den Bearbeiten-Button in Sidebar
              // komplett aus, siehe Sidebar/index.tsx canEdit.
              onEventEdit={readOnly ? undefined : handleEventEdit}
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
          setEditingEventId(null);
        }}
        event={editingEvent}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        onUpdate={handleEventUpdate}
        onDelete={handleEventDelete}
        deleteBlocked={editingEventId ? editing.deleteBlock(editingEventId) : undefined}
        amendLocked={editingEventId ? editing.amendLock(editingEventId) : undefined}
      />

      {/* BUG-002: Event Log Bottom Sheet for Mobile */}
      <EventLogBottomSheet
        isOpen={showEventLogBottomSheet}
        onClose={() => setShowEventLogBottomSheet(false)}
        events={match.events}
        retractedEvents={match.retractedEvents}
        homeTeamName={match.homeTeam.name}
        awayTeamName={match.awayTeam.name}
        homeTeamId={match.homeTeam.id}
        awayTeamId={match.awayTeam.id}
        // Task R2 Fixrunde 2 (H1b/Rule 2): gesperrt NUR bei readOnly, nicht bei isFinished allein
        // (dasselbe Rule-1-Argument wie bei Sidebar.onEventEdit oben — vor R2 war dieser Handler
        // gar nicht gegen isFinished/isLocked gesperrt). Öffnen und Lesen des Sheets bleibt über
        // den "Ereignisprotokoll"-Knopf in GameControls immer erlaubt (siehe dort); nur das
        // Bearbeiten selbst ist ein Schreib-Callback und wird unter readOnly zu `undefined`
        // (EventLogBottomSheet blendet den "Bearbeiten"-Knopf dann komplett aus).
        onEventEdit={readOnly ? undefined : (event) => {
          setShowEventLogBottomSheet(false);
          // M-1 FIX: Store only event ID for fresh data lookup
          setEditingEventId(event.id);
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
        // Task R2 Fixrunde 3 (Review-Befund M): `readOnly` (nicht `isLocked`) — Settings zeigen
        // echte, synchronisierte Werte (Regel 2: "ansehen bleibt erlaubt"), der Dialog bleibt also
        // auch bei bloß beendetem Spiel (Rule 1, readOnly=false) voll bedienbar. Nur bei echter
        // readOnly-Sperre werden die Eingaben deaktiviert (SettingsDialog → MatchCockpitSettingsPanel).
        readOnly={readOnly}
      />

      {/* Audio Activation Banner - required for browser autoplay policy */}
      {cockpitSettings.soundEnabled && !sound.isActivated && (
        <AudioActivationBanner
          show={true}
          onActivate={sound.activate}
        />
      )}

      {/* L1: Tiebreaker-Banner — MatchExecutionService.finishMatch setzt awaitingTiebreakerChoice,
          useMatchExecution.handleFinish lädt das Match neu, der Zustand kommt hier an. */}
      {match.awaitingTiebreakerChoice && (
        <TiebreakerBanner
          homeTeamName={match.homeTeam.name} awayTeamName={match.awayTeam.name}
          score={effectiveScore.home} tiebreakerMode={match.tiebreakerMode}
          overtimeMinutes={Math.round((match.overtimeDurationSeconds ?? 300) / 60)}
          // Task R2: die vier Tiebreaker-Handler — bei isLocked (readOnly/finished) undefined,
          // damit TiebreakerBanner die zugehörigen Knöpfe gar nicht erst anzeigt.
          onStartOvertime={onStartOvertime && !isLocked ? handleStartOvertime : undefined}
          onStartGoldenGoal={onStartGoldenGoal && !isLocked ? handleStartGoldenGoal : undefined}
          onStartPenaltyShootout={onStartPenaltyShootout && !isLocked ? handleStartPenaltyShootout : undefined}
          onEndAsDraw={onForceFinish && !isLocked ? handleEndAsDraw : undefined}
        />
      )}

      {/* L1: Strafstoßschießen. onRecordShot ist vom Dialog gefordert, Einzelschüsse werden derzeit nicht
          persistiert — der Service kennt nur das Endergebnis. Bewusst No-op statt Scheinpersistenz.
          Task R2 Fixrunde 2 (H1): `!readOnly` — der Dialog öffnet sich automatisch per Effekt
          (oben, an `playPhase === 'penalty'` gekoppelt), auch wenn playPhase über Realtime von
          einem anderen Gerät kommt. Unter readOnly wird er GAR NICHT gerendert (statt rein
          lesend): sein Schuss-Stand ist reiner Lokalzustand (`useState` im Dialog selbst, siehe
          PenaltyShootoutDialog.tsx `initialShots`/`shots`), nicht mit anderen Geräten
          synchronisiert — eine "Lese"-Ansicht würde einem readOnly-Betrachter einen leeren,
          irreführenden Schuss-Stand zeigen statt des echten (der nur auf dem bedienenden Gerät
          existiert), und jede Aktion im Dialog (TOR/DANEBEN/Korrigieren/Beenden/Abbrechen) ist
          ein Schreib-Callback — Regel 2 erlaubt, einen ausschließlich schreibenden Dialog unter
          readOnly gesperrt zu lassen. Siehe Report für die volle Begründung. */}
      {showPenaltyDialog && !readOnly && onRecordPenaltyResult && onAbortPenaltyShootout && (
        <PenaltyShootoutDialog
          homeTeamName={match.homeTeam.name} awayTeamName={match.awayTeam.name}
          onRecordShot={() => { /* Einzelschüsse werden nicht persistiert (Follow-up, Task 22) */ }}
          onFinish={handlePenaltyFinish} onCancel={handlePenaltyCancel}
        />
      )}

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

export default LiveCockpit;
