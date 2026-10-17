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

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpoint, useMatchTimerExtended, useMatchSound } from '../../hooks';
import { useFoulCounts } from '../../hooks/useFoulCounts';
import { useFoulThresholdWarning } from '../../hooks/useFoulThresholdWarning';
import { useEngineEventEditing } from '../../hooks/useEngineEventEditing';
import { SyncStatusIndicator } from '../../features/collaboration';
import { OutboxNotice } from '../../features/collaboration/outbox/OutboxNotice';
import { useOutboxStatus } from '../../features/collaboration/outbox/useOutboxStatus';
import { useRejectedOutboxDialog } from '../../features/collaboration/outbox/useRejectedOutboxDialog';
import { useMatchEngineContextOptional } from '../../features/match-engine/useMatchEngineContext';
import { getEffectiveScore } from '../../utils/matchScore';
import { isAutoFinishDue } from '../../core/match/client/viewDuration';
import type { LiveCockpitProps } from './types';
import type { EditableMatchEvent, MatchCockpitSettings } from '../../types/tournament';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../types/tournament';

// Sub-components
import { LegacyMatchHeader } from './areas/LegacyMatchHeader';
import { LegacyPlayArea, type TeamSideHandlers } from './areas/LegacyPlayArea';
import { CockpitOverlays, type CockpitDialogState, type CockpitOverlayHandlers } from './areas/CockpitOverlays';
import type { Side } from './model/cockpitTypes';
import shell from './LiveCockpitShell.module.css';

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

// F3b2: Toast-Schluessel je Kartentyp -- Modulebene statt useCallback-Abhaengigkeit (statisch).
const CARD_TOAST_KEYS: Record<'YELLOW' | 'YELLOW_RED' | 'RED', 'toast.yellowCard' | 'toast.yellowRedCard' | 'toast.redCard'> = {
  YELLOW: 'toast.yellowCard', YELLOW_RED: 'toast.yellowRedCard', RED: 'toast.redCard',
};

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
  const [pendingCardType, setPendingCardType] = useState<'YELLOW' | 'YELLOW_RED' | 'RED' | null>(null);
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
    // C-VERLAENGERUNG-ENDET-SOFORT: nur bei wirklich abgelaufener Spielzeit (auch Verlängerung/Golden Goal)
    if (!readOnly && cockpitSettings.autoFinishEnabled && isAutoFinishDue(currentMatch, isOvertime)) {
      // console.log('⏰ Auto-Finish triggered');
      handleFinish();
    }
  }, [
    readOnly,
    cockpitSettings.autoFinishEnabled,
    currentMatch,
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

      onAdjustTime?.(currentMatch.id, newElapsedSeconds);

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
  // F3b2: ein Knopf je Kartentyp (Gelb/Gelb-Rot/Rot) ruft denselben Oeffner -- ersetzt zwei fast
  // identische Closures je Team (TeamBlock) durch eine, spart Zeilen statt den dritten Knopf
  // welche zu kosten (LiveCockpit.tsx darf nicht wachsen).
  const openCardDialog = useCallback((type: 'YELLOW' | 'YELLOW_RED' | 'RED', side: 'home' | 'away') => {
    setPendingCardType(type);
    setPendingCardTeamSide(side);
    setShowCardDialog(true);
  }, []);

  const handleCardConfirm = useCallback(
    (cardType: 'YELLOW' | 'YELLOW_RED' | 'RED', teamId: string, playerNumber?: number) => {
      if (!currentMatch) { return; }

      const teamName = currentMatch.homeTeam.id === teamId
        ? currentMatch.homeTeam.name
        : currentMatch.awayTeam.name;
      const playerInfo = playerNumber ? ` (#${playerNumber})` : '';

      // Call parent handler to create event
      onCard?.(currentMatch.id, teamId, cardType, { playerNumber });

      showInfo(`${t(CARD_TOAST_KEYS[cardType], { teamName })}${playerInfo}`);
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
      <div className={shell.empty}>
        <p className={shell.emptyText}>{t('leer.keinSpielGewaehlt')}</p>
      </div>
    );
  }

  const match = currentMatch;
  // Task R2: readOnly kommt aus einer echten Berechtigungsprüfung (ManagementTab.checkCanEditMatch
  // → canEditResults), isFinished ist die bestehende "Spiel ist vorbei"-Sperre. Beide führen zum
  // selben Ergebnis (keine Bedienung), aber nur `readOnly` zeigt das Berechtigungs-Banner —
  // ein beendetes Spiel braucht keine "du hast keine Berechtigung"-Erklärung, das sagt schon der
  // Status-Badge ("BEENDET").
  const isLocked = readOnly || match.status === 'FINISHED';
  const isDesktop = !isMobile && !isTablet;
  const openTimeAdjust = onAdjustTime ? () => setShowTimeAdjustDialog(true) : undefined;

  // Die acht Aktionen eines Team-Blocks je Seite.
  const sideHandlers = (side: Side): TeamSideHandlers => ({
    onGoal: side === 'home' ? handleGoalHome : handleGoalAway,
    onMinus: side === 'home' ? handleMinusHome : handleMinusAway,
    onPenalty: () => { setPendingPenaltySide(side); setShowTimePenaltyDialog(true); },
    onYellowCard: () => openCardDialog('YELLOW', side),
    onYellowRedCard: () => openCardDialog('YELLOW_RED', side),
    onRedCard: () => openCardDialog('RED', side),
    onSubstitution: () => { setPendingSubstitutionSide(side); setShowSubstitutionDialog(true); },
    onFoul: side === 'home' ? handleFoulHome : handleFoulAway,
  });

  const dialogs: CockpitDialogState = {
    showTimeAdjust: showTimeAdjustDialog, showCard: showCardDialog, showTimePenalty: showTimePenaltyDialog,
    showSubstitution: showSubstitutionDialog, showGoal: showGoalDialog, showEventEdit: showEventEditDialog,
    showEventLog: showEventLogBottomSheet, showSettings: showSettingsDialog,
    // Task R2 Fixrunde 2 (H1): unter readOnly gar nicht, und nur mit beiden Strafstoß-Handlern.
    showPenaltyShootout: showPenaltyDialog && !readOnly && !!onRecordPenaltyResult && !!onAbortPenaltyShootout,
    pendingGoalSide, pendingPenaltySide, pendingCardType, pendingCardTeamSide, pendingSubstitutionSide, editingEventId,
  };

  const overlayHandlers: CockpitOverlayHandlers = {
    closeTimeAdjust: () => setShowTimeAdjustDialog(false),
    confirmTimeAdjust: handleTimeAdjust,
    closeCard: () => { setShowCardDialog(false); setPendingCardType(null); setPendingCardTeamSide(null); },
    confirmCard: handleCardConfirm,
    closeTimePenalty: () => { setShowTimePenaltyDialog(false); setPendingPenaltySide(null); },
    confirmTimePenalty: handleTimePenaltyConfirm,
    closeSubstitution: () => { setShowSubstitutionDialog(false); setPendingSubstitutionSide(null); },
    confirmSubstitution: handleSubstitutionConfirm,
    closeGoal: () => { setShowGoalDialog(false); setPendingGoalSide(null); },
    confirmGoal: handleGoalConfirm,
    closeEventEdit: () => { setShowEventEditDialog(false); setEditingEventId(null); },
    updateEvent: handleEventUpdate,
    deleteEvent: handleEventDelete,
    closeEventLog: () => setShowEventLogBottomSheet(false),
    // M-1 FIX: nur die Ereignis-ID merken, das Ereignis wird frisch nachgeschlagen
    editEventFromLog: (event) => { setShowEventLogBottomSheet(false); setEditingEventId(event.id); setShowEventEditDialog(true); },
    closeSettings: () => setShowSettingsDialog(false),
    changeSettings: (newSettings) => { if (onUpdateSettings) { onUpdateSettings(newSettings); } },
    testSound: () => void sound.play(),
    startOvertime: onStartOvertime ? handleStartOvertime : undefined,
    startGoldenGoal: onStartGoldenGoal ? handleStartGoldenGoal : undefined,
    startPenaltyShootout: onStartPenaltyShootout ? handleStartPenaltyShootout : undefined,
    endAsDraw: onForceFinish ? handleEndAsDraw : undefined,
    finishPenaltyShootout: handlePenaltyFinish,
    cancelPenaltyShootout: handlePenaltyCancel,
  };

  const effectiveScore = getEffectiveScore(match);

  return (
    <div className={shell.container}>
      <main className={isMobile ? `${shell.content} ${shell.contentMobile}` : shell.content}>
        <LegacyMatchHeader
          match={match}
          fieldName={fieldName}
          isMobile={isMobile}
          homeFouls={homeFouls}
          awayFouls={awayFouls}
          readOnly={readOnly}
          // A4 (C-SYNC): rendert selbst nichts außerhalb des Cloud-Modus. I4 (W1, Nachtrag
          // Fixrunde 1): rejectedCount/reviewCount aus dem echten Sender (useEngineOutboxSummary).
          sync={
            <SyncStatusIndicator
              tournamentId={tournamentId}
              compact
              rejectedCount={rejectedOutbox.rejectedCount}
              reviewCount={rejectedOutbox.reviewCount}
              onShowRejected={rejectedOutbox.show}
              enginePendingCount={rejectedOutbox.pendingCount}
            />
          }
        />

        {/* W1 (Nachtrag C3a-2a): rendert selbst nichts, solange kein Ausgangs-Zustand
            (clientOutdated/authRequired/notReady/review) vorliegt. */}
        <OutboxNotice status={outboxStatus} matchId={match.id} onReload={handleOutboxReload} />

        <LegacyPlayArea
          match={match}
          nextMatch={nextMatch}
          breakpoint={breakpoint}
          isMobile={isMobile}
          isDesktop={isDesktop}
          isLocked={isLocked}
          displaySeconds={displaySeconds}
          timerState={timerState}
          homeFouls={homeFouls}
          awayFouls={awayFouls}
          effectiveScore={effectiveScore}
          sidesSwapped={sidesSwapped}
          onTimerClick={openTimeAdjust}
          teams={{ handlers: { home: sideHandlers('home'), away: sideHandlers('away') }, extraProps: editing.teamBlockProps }}
          controls={{
            onUndo: editing.undoVisible ? handleUndo : undefined,
            onStart: handleStart,
            onPauseResume: handlePauseResume,
            onEditTime: openTimeAdjust,
            onSwitchSides: handleSwitchSides,
            onFinish: handleFinish,
            onSettings: () => setShowSettingsDialog(true),
            // BUG-002: Event Log for Mobile
            onEventLog: () => setShowEventLogBottomSheet(true),
            canUndo: editing.canUndo,
            undoLabel: editing.undoLabel,
            undoHint: editing.undoHint,
          }}
          sidebar={{
            activePenalties: penalties.penalties,
            // Task R2 Fixrunde 2 (M2/Rule 1): gesperrt NUR bei echter readOnly-Sperre.
            onEventEdit: readOnly ? undefined : handleEventEdit,
          }}
        />
      </main>

      <CockpitOverlays
        match={match}
        tournamentId={tournamentId}
        readOnly={readOnly}
        isLocked={isLocked}
        settings={cockpitSettings}
        displaySeconds={displaySeconds}
        effectiveScore={effectiveScore}
        dialogs={dialogs}
        editingEvent={editingEvent}
        editing={editing}
        handlers={overlayHandlers}
        sound={sound}
        rejectedOutbox={rejectedOutbox}
        toasts={toasts}
        onDismissToast={dismissToast}
      />
    </div>
  );
};

export default LiveCockpit;
