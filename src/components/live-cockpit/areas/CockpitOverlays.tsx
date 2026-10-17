/**
 * CockpitOverlays – alle Overlays des Live-Cockpits an einer Stelle (Scheibe 1).
 *
 * Dialoge, Blätter, Banner und Toasts, bisher am Ende von `LiveCockpit.tsx`. Die Reihenfolge der
 * Elemente bleibt wie vorher. Die Sperr-Regeln (readOnly, beendetes Spiel) stehen hier bei den
 * Overlays, die sie betreffen (Task R2).
 */
import type { ReactElement } from 'react';
import type { LiveMatch } from '../types';
import type { EditableMatchEvent, MatchCockpitSettings } from '../../../types/tournament';
import { cssVars } from '../../../design-tokens';
import type { UseRejectedOutboxDialogResult } from '../../../features/collaboration/outbox/useRejectedOutboxDialog';
import { RejectedOutboxDialog } from '../../../features/collaboration/outbox/RejectedOutboxDialog';
import type { useEngineEventEditing } from '../../../hooks/useEngineEventEditing';
import type { Side, CardKind } from '../model/cockpitTypes';
import {
  TimeAdjustDialog, CardDialog, TimePenaltyDialog, SubstitutionDialog, GoalScorerDialog,
  EventEditDialog, EventLogBottomSheet, SettingsDialog, TiebreakerBanner, PenaltyShootoutDialog,
  ToastContainer, type ToastData,
} from '../components';
import { AudioActivationBanner } from './AudioActivationBanner';

type EngineEventEditing = ReturnType<typeof useEngineEventEditing>;

/** Welche Overlays offen sind und was sie vorbelegen (Quelle: `useEntryFlows` und Hülle). */
export interface CockpitDialogState {
  showTimeAdjust: boolean;
  showCard: boolean;
  showTimePenalty: boolean;
  showSubstitution: boolean;
  showGoal: boolean;
  showEventEdit: boolean;
  showEventLog: boolean;
  showSettings: boolean;
  showPenaltyShootout: boolean;
  pendingGoalSide: Side | null;
  pendingPenaltySide: Side | null;
  pendingCardType: CardKind | null;
  pendingCardTeamSide: Side | null;
  pendingSubstitutionSide: Side | null;
  editingEventId: string | null;
}

/** Alle `on…`-Rückrufe der Overlays. Tiebreak-Handler sind `undefined`, wenn der Aufrufer sie nicht liefert. */
export interface CockpitOverlayHandlers {
  closeTimeAdjust: () => void;
  confirmTimeAdjust: (newDisplaySeconds: number) => void;
  closeCard: () => void;
  confirmCard: (cardType: CardKind, teamId: string, playerNumber?: number) => void;
  closeTimePenalty: () => void;
  confirmTimePenalty: (durationSeconds: number, teamId: string, playerNumber?: number) => void;
  closeSubstitution: () => void;
  confirmSubstitution: (teamId: string, playersOut: number[], playersIn: number[]) => void;
  closeGoal: () => void;
  confirmGoal: (jerseyNumber: number | null, assists?: (number | null)[], incomplete?: boolean) => void;
  closeEventEdit: () => void;
  updateEvent: EngineEventEditing['update'];
  deleteEvent: EngineEventEditing['remove'];
  closeEventLog: () => void;
  editEventFromLog: (event: { id: string }) => void;
  closeSettings: () => void;
  changeSettings: (settings: MatchCockpitSettings) => void;
  testSound: () => void;
  startOvertime?: () => void;
  startGoldenGoal?: () => void;
  startPenaltyShootout?: () => void;
  endAsDraw?: () => void;
  finishPenaltyShootout: (homeScore: number, awayScore: number) => void;
  cancelPenaltyShootout: () => void;
}

export interface CockpitOverlaysProps {
  match: LiveMatch;
  tournamentId: string;
  readOnly: boolean;
  isLocked: boolean;
  settings: MatchCockpitSettings;
  displaySeconds: number;
  effectiveScore: { home: number; away: number };
  dialogs: CockpitDialogState;
  editingEvent: EditableMatchEvent | null;
  editing: Pick<EngineEventEditing, 'deleteBlock' | 'amendLock'>;
  handlers: CockpitOverlayHandlers;
  sound: { activate: () => Promise<void>; isActivated: boolean };
  rejectedOutbox: UseRejectedOutboxDialogResult;
  toasts: ToastData[];
  onDismissToast: (id: string) => void;
}

export function CockpitOverlays(props: CockpitOverlaysProps): ReactElement {
  const { match, tournamentId, readOnly, isLocked, settings, displaySeconds, effectiveScore, dialogs, editingEvent, editing, handlers, sound, rejectedOutbox } = props;
  const goalTeamName = dialogs.pendingGoalSide === 'home'
    ? match.homeTeam.name
    : dialogs.pendingGoalSide === 'away' ? match.awayTeam.name : '';

  return (
    <>
      {/* I4 (W1, Nachtrag Fixrunde 1): Ablehnungsliste dieses Turniers, „Verstanden“ ruft dismiss. */}
      <RejectedOutboxDialog
        isOpen={rejectedOutbox.isOpen}
        onClose={rejectedOutbox.close}
        entries={rejectedOutbox.entries}
        onDismiss={rejectedOutbox.handleDismiss}
      />

      <TimeAdjustDialog
        isOpen={dialogs.showTimeAdjust}
        onClose={handlers.closeTimeAdjust}
        onConfirm={handlers.confirmTimeAdjust}
        currentTimeSeconds={displaySeconds}
        matchDurationMinutes={Math.floor(match.durationSeconds / 60)}
      />

      <CardDialog
        isOpen={dialogs.showCard}
        onClose={handlers.closeCard}
        onConfirm={handlers.confirmCard}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        // BUG-007: Pre-select card type and team based on button clicked
        initialCardType={dialogs.pendingCardType ?? undefined}
        preselectedTeamSide={dialogs.pendingCardTeamSide ?? undefined}
        autoDismissSeconds={10}
      />

      <TimePenaltyDialog
        isOpen={dialogs.showTimePenalty}
        onClose={handlers.closeTimePenalty}
        onConfirm={handlers.confirmTimePenalty}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        // BUG-006: Pre-select 2 minutes and team based on button clicked
        preselectedDurationSeconds={match.timePenaltyDurationSeconds ?? settings.timePenaltyDurationSeconds}
        preselectedTeamSide={dialogs.pendingPenaltySide ?? undefined}
        autoDismissSeconds={10}
      />

      <SubstitutionDialog
        isOpen={dialogs.showSubstitution}
        onClose={handlers.closeSubstitution}
        onConfirm={handlers.confirmSubstitution}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        // BUG-009: Pre-select team based on button clicked
        preselectedTeamSide={dialogs.pendingSubstitutionSide ?? undefined}
        autoDismissSeconds={10}
      />

      {/* GoalScorerDialog - BUG-002: Torschütze + Assist erfassen */}
      <GoalScorerDialog
        isOpen={dialogs.showGoal}
        onClose={handlers.closeGoal}
        onConfirm={handlers.confirmGoal}
        teamName={goalTeamName}
        teamColor={cssVars.colors.primary}
        autoDismissSeconds={10}
      />

      {/* BUG-010: EventEditDialog for editing/deleting events */}
      <EventEditDialog
        isOpen={dialogs.showEventEdit}
        onClose={handlers.closeEventEdit}
        event={editingEvent}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        onUpdate={handlers.updateEvent}
        onDelete={handlers.deleteEvent}
        deleteBlocked={dialogs.editingEventId ? editing.deleteBlock(dialogs.editingEventId) : undefined}
        amendLocked={dialogs.editingEventId ? editing.amendLock(dialogs.editingEventId) : undefined}
      />

      {/* BUG-002: Event Log Bottom Sheet for Mobile. Task R2 Fixrunde 2 (H1b/Rule 2): Bearbeiten
          nur bei echter readOnly-Sperre ausgeblendet, nicht bei beendetem Spiel allein. */}
      <EventLogBottomSheet
        isOpen={dialogs.showEventLog}
        onClose={handlers.closeEventLog}
        events={match.events}
        retractedEvents={match.retractedEvents}
        homeTeamName={match.homeTeam.name}
        awayTeamName={match.awayTeam.name}
        homeTeamId={match.homeTeam.id}
        awayTeamId={match.awayTeam.id}
        onEventEdit={readOnly ? undefined : handlers.editEventFromLog}
      />

      {/* Task R2 Fixrunde 3: `readOnly` (nicht `isLocked`) – Ansehen bleibt erlaubt, nur die Eingaben sperren. */}
      <SettingsDialog
        isOpen={dialogs.showSettings}
        onClose={handlers.closeSettings}
        settings={settings}
        onChange={handlers.changeSettings}
        tournamentId={tournamentId}
        onTestSound={handlers.testSound}
        readOnly={readOnly}
      />

      {/* Audio Activation Banner - required for browser autoplay policy */}
      {settings.soundEnabled && !sound.isActivated && (
        <AudioActivationBanner show={true} onActivate={sound.activate} />
      )}

      {/* L1: Tiebreaker-Banner. Task R2: bei isLocked (readOnly/finished) ohne die vier Handler,
          damit TiebreakerBanner die zugehörigen Knöpfe gar nicht erst anzeigt. */}
      {match.awaitingTiebreakerChoice && (
        <TiebreakerBanner
          homeTeamName={match.homeTeam.name} awayTeamName={match.awayTeam.name}
          score={effectiveScore.home} tiebreakerMode={match.tiebreakerMode}
          overtimeMinutes={Math.round((match.overtimeDurationSeconds ?? 300) / 60)}
          onStartOvertime={isLocked ? undefined : handlers.startOvertime}
          onStartGoldenGoal={isLocked ? undefined : handlers.startGoldenGoal}
          onStartPenaltyShootout={isLocked ? undefined : handlers.startPenaltyShootout}
          onEndAsDraw={isLocked ? undefined : handlers.endAsDraw}
        />
      )}

      {/* L1: Strafstoßschießen. Einzelschüsse werden nicht persistiert (Follow-up, Task 22).
          Task R2 Fixrunde 2 (H1): unter readOnly gar nicht gerendert – der Schuss-Stand ist reiner
          Lokalzustand des Dialogs, jede Aktion darin ein Schreib-Callback. */}
      {dialogs.showPenaltyShootout && (
        <PenaltyShootoutDialog
          homeTeamName={match.homeTeam.name} awayTeamName={match.awayTeam.name}
          onRecordShot={() => { /* Einzelschüsse werden nicht persistiert (Follow-up, Task 22) */ }}
          onFinish={handlers.finishPenaltyShootout} onCancel={handlers.cancelPenaltyShootout}
        />
      )}

      <ToastContainer toasts={props.toasts} onDismiss={props.onDismissToast} />
    </>
  );
}
