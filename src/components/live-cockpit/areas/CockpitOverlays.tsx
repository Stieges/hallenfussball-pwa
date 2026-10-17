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
import { EINTRAG_ZEITSTRAFE, type CardKind, type OffenerEintrag } from '../model/cockpitTypes';
import {
  TimeAdjustDialog, CardDialog, TimePenaltyDialog, SubstitutionDialog, GoalScorerDialog,
  EventEditDialog, EventLogBottomSheet, SettingsDialog, TiebreakerBanner, PenaltyShootoutDialog,
} from '../components';
import { AudioActivationBanner } from './AudioActivationBanner';

type EngineEventEditing = ReturnType<typeof useEngineEventEditing>;

/** Welche Overlays offen sind: die Eintrags-Auswahl aus `useEntryFlows` plus die übrigen Blätter. */
export interface CockpitDialogState {
  offen: OffenerEintrag | null;
  showTimeAdjust: boolean;
  showEventLog: boolean;
  showSettings: boolean;
  showPenaltyShootout: boolean;
}

/** Alle `on…`-Rückrufe der Overlays. Tiebreak-Handler sind `undefined`, wenn der Aufrufer sie nicht liefert. */
export interface CockpitOverlayHandlers {
  closeTimeAdjust: () => void;
  confirmTimeAdjust: (newDisplaySeconds: number) => void;
  /** Schließt die offene Eintrags-Auswahl (Tor, Karte, Zeitstrafe, Wechsel, Nummer ändern). */
  closeEntry: () => void;
  confirmCard: (cardType: CardKind, teamId: string, playerNumber?: number) => void;
  confirmTimePenalty: (durationSeconds: number, teamId: string, playerNumber?: number) => void;
  confirmSubstitution: (teamId: string, playersOut: number[], playersIn: number[]) => void;
  confirmGoal: (jerseyNumber: number | null, assists?: (number | null)[], incomplete?: boolean) => void;
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
}

export function CockpitOverlays(props: CockpitOverlaysProps): ReactElement {
  const { match, tournamentId, readOnly, isLocked, settings, displaySeconds, effectiveScore, dialogs, editingEvent, editing, handlers, sound, rejectedOutbox } = props;
  const offen = dialogs.offen;
  const editingEventId = offen?.art === 'nummer' ? offen.eventId ?? null : null;
  const seite = offen?.seite ?? null;
  const goalTeamName = offen?.art === 'tor'
    ? (seite === 'home' ? match.homeTeam.name : seite === 'away' ? match.awayTeam.name : '')
    : '';

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
        isOpen={offen?.art === 'karte'}
        onClose={handlers.closeEntry}
        onConfirm={handlers.confirmCard}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        // BUG-007: Pre-select card type and team based on button clicked
        initialCardType={offen?.art === 'karte' ? offen.kartenArt : undefined}
        preselectedTeamSide={offen?.art === 'karte' ? seite ?? undefined : undefined}
        autoDismissSeconds={10}
      />

      <TimePenaltyDialog
        isOpen={offen?.art === EINTRAG_ZEITSTRAFE}
        onClose={handlers.closeEntry}
        onConfirm={handlers.confirmTimePenalty}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        // BUG-006: Pre-select 2 minutes and team based on button clicked
        preselectedDurationSeconds={match.timePenaltyDurationSeconds ?? settings.timePenaltyDurationSeconds}
        preselectedTeamSide={offen?.art === EINTRAG_ZEITSTRAFE ? seite ?? undefined : undefined}
        autoDismissSeconds={10}
      />

      <SubstitutionDialog
        isOpen={offen?.art === 'wechsel'}
        onClose={handlers.closeEntry}
        onConfirm={handlers.confirmSubstitution}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        // BUG-009: Pre-select team based on button clicked
        preselectedTeamSide={offen?.art === 'wechsel' ? seite ?? undefined : undefined}
        autoDismissSeconds={10}
      />

      {/* GoalScorerDialog - BUG-002: Torschütze + Assist erfassen */}
      <GoalScorerDialog
        isOpen={offen?.art === 'tor'}
        onClose={handlers.closeEntry}
        onConfirm={handlers.confirmGoal}
        teamName={goalTeamName}
        teamColor={cssVars.colors.primary}
        autoDismissSeconds={10}
      />

      {/* BUG-010: EventEditDialog for editing/deleting events */}
      <EventEditDialog
        isOpen={offen?.art === 'nummer'}
        onClose={handlers.closeEntry}
        event={editingEvent}
        homeTeam={match.homeTeam}
        awayTeam={match.awayTeam}
        onUpdate={handlers.updateEvent}
        onDelete={handlers.deleteEvent}
        deleteBlocked={editingEventId ? editing.deleteBlock(editingEventId) : undefined}
        amendLocked={editingEventId ? editing.amendLock(editingEventId) : undefined}
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

    </>
  );
}
