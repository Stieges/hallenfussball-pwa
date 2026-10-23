/**
 * CockpitOverlays – alle Overlays des Live-Cockpits an einer Stelle (Scheibe 1).
 *
 * Dialoge, Blätter und Banner, bisher am Ende von `LiveCockpit.tsx`. Der Ton-Hinweis ist seit Aufgabe 2.4 ein Abzeichen der Tafel. Die Reihenfolge der
 * Elemente bleibt wie vorher. Die Sperr-Regeln (readOnly, beendetes Spiel) stehen hier bei den
 * Overlays, die sie betreffen (Task R2).
 */
import type { ReactElement } from 'react';
import type { LiveMatch } from '../types';
import type { EditableMatchEvent, MatchCockpitSettings } from '../../../types/tournament';
import type { UseRejectedOutboxDialogResult } from '../../../features/collaboration/outbox/useRejectedOutboxDialog';
import { RejectedOutboxDialog } from '../../../features/collaboration/outbox/RejectedOutboxDialog';
import type { useEngineEventEditing } from '../../../hooks/useEngineEventEditing';
import type { OffenerEintrag } from '../model/cockpitTypes';
import { EntrySheets, type EntrySheetsProps } from './EntrySheets';
import { FinishConfirm } from './FinishConfirm';
import { MoreSheet } from './MoreSheet';
import type { MehrPunkt } from '../model/mehrPunkte';
import {
  TimeAdjustDialog,
  EventEditDialog, EventLogBottomSheet, SettingsDialog, TiebreakerBanner, PenaltyShootoutDialog,
} from '../components';

type EngineEventEditing = ReturnType<typeof useEngineEventEditing>;

/** Welche Overlays offen sind: die Eintrags-Auswahl aus `useEntryFlows` plus die übrigen Blätter. */
export interface CockpitDialogState {
  offen: OffenerEintrag | null;
  showTimeAdjust: boolean;
  /** Grenzen der Zeitkorrektur aus der Engine-Ansicht (B-08d); `null` ohne Engine-Ansicht. */
  zeit: { current: number; min: number; max: number; minIsGoal: boolean } | null;
  showEventLog: boolean;
  showSettings: boolean;
  /** Blatt „Mehr“ (Aufgabe 3.6 / LT-1). */
  showMore: boolean;
  /** Rückfrage nach „Abpfiff halten“ mit der festgehaltenen Restzeit des Spiels (LT-1), sonst `null`. */
  finishFrage: { restText: string } | null;
  showPenaltyShootout: boolean;
}

/** Alle `on…`-Rückrufe der Overlays. Tiebreak-Handler sind `undefined`, wenn der Aufrufer sie nicht liefert. */
export interface CockpitOverlayHandlers {
  closeTimeAdjust: () => void;
  /** Neue Spielzeit im Abschnitt in Sekunden (B-08d). */
  confirmTimeAdjust: (sectionSeconds: number) => void;
  /** Schließt die offene Eintrags-Auswahl (Tor, Karte, Zeitstrafe, Nummer ändern). */
  closeEntry: () => void;
  updateEvent: EngineEventEditing['update'];
  deleteEvent: EngineEventEditing['remove'];
  closeEventLog: () => void;
  editEventFromLog: (event: { id: string }) => void;
  closeMore: () => void;
  /** „Beenden“ in der Rückfrage: der Abpfiff von Hand. */
  finishConfirmed: () => void;
  /** „Weiterspielen“, Esc oder Tipp daneben. */
  finishDeclined: () => void;
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
  effectiveScore: { home: number; away: number };
  dialogs: CockpitDialogState;
  editingEvent: EditableMatchEvent | null;
  editing: Pick<EngineEventEditing, 'deleteBlock' | 'amendLock'>;
  handlers: CockpitOverlayHandlers;
  rejectedOutbox: UseRejectedOutboxDialogResult;
  entrySheets: EntrySheetsProps;
  /** Punkte des Blatts „Mehr“ im Zustand und ihre Aktionen. */
  mehr: { punkte: readonly MehrPunkt[]; aktionen: Partial<Record<MehrPunkt, () => void>> };
}

export function CockpitOverlays(props: CockpitOverlaysProps): ReactElement {
  const { match, tournamentId, readOnly, isLocked, settings, effectiveScore, dialogs, editingEvent, editing, handlers, rejectedOutbox, entrySheets, mehr } = props;
  const zeit = dialogs.zeit;
  const offen = dialogs.offen;
  const editingEventId = offen?.art === 'nummer' ? offen.eventId ?? null : null;

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
        isOpen={dialogs.showTimeAdjust && zeit !== null}
        onClose={handlers.closeTimeAdjust}
        onConfirm={handlers.confirmTimeAdjust}
        currentSeconds={zeit?.current ?? 0}
        minSeconds={zeit?.min ?? 0}
        maxSeconds={zeit?.max ?? 0}
        minIsGoal={zeit?.minIsGoal ?? false}
      />

      <FinishConfirm
        offen={dialogs.finishFrage !== null} spielNummer={match.number} restText={dialogs.finishFrage?.restText ?? ''}
        onBeenden={handlers.finishConfirmed} onAbbrechen={handlers.finishDeclined}
      />

      <MoreSheet isOpen={dialogs.showMore} onClose={handlers.closeMore} punkte={mehr.punkte} aktionen={mehr.aktionen} />

      {/* Aufgaben 3.4/3.5: Nummernauswahl, Kartenart-Schritt und Rückfrage der Einträge (Tor, Karte, Zeitstrafe zählen mit dem ersten Tipp) */}
      <EntrySheets {...entrySheets} />

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
        discardedEntries={match.discardedEntries}
        homeTeamName={match.homeTeam.name}
        awayTeamName={match.awayTeam.name}
        homeTeamId={match.homeTeam.id}
        awayTeamId={match.awayTeam.id}
        onEventEdit={readOnly ? undefined : handlers.editEventFromLog}
        matchId={match.id}
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
