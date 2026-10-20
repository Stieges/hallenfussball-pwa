/**
 * useCockpitCommands – Befehls-Adapter und Effekte der Cockpit-Hülle (Aufgabe 1.3).
 *
 * Verbindet die `on…`-Rückrufe des Aufrufers mit den Bereichen: Tor-, Foul-, Karten- und Zeitstrafen-
 * Abläufe samt Meldungen, Zeit anpassen, Rückgängig, Uhr-Steuerung (`useClockControls`)
 * und die Entscheidung nach Gleichstand (`useTiebreakCommands`). Hier – nicht in `LiveCockpit.tsx` –
 * kommt jede weitere Befehls- und Effektlogik der Hülle hin, damit sie unter 300 Zeilen bleibt.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { useMatchSound } from '../../../hooks';
import { useEngineEventEditing } from '../../../hooks/useEngineEventEditing';
import type { ActivePenalty, EditableMatchEvent, MatchCockpitSettings } from '../../../types/tournament';
import type { CockpitDialogState, CockpitOverlayHandlers } from '../areas/CockpitOverlays';
import type { LegacyPlayAreaProps } from '../areas/LegacyPlayArea';
import type { Side } from '../model/cockpitTypes';
import type { PhaseView } from '../engine/phaseView';
import type { LiveCockpitProps } from '../types';
import type { UseCockpitNoticesReturn } from './useCockpitNotices';
import { useClockControls } from './useClockControls';
import { useCockpitClock } from './useCockpitClock';
import type { UseEntryFlowsReturn } from './useEntryFlows';
import type { UseSideOrderReturn } from './useSideOrder';
import { useTiebreakCommands } from './useTiebreakCommands';
import { korrekturUhrstaende } from '../model/zeitKorrektur';

/** Die vier Tipps einer Team-Spalte, je Seite (Aufgabe 3.3). */
export interface TeamSideHandlers { onTor: () => void; onFoul: () => void; onZeitstrafe: () => void; onKarte: () => void }

export interface CockpitCommandsArgs {
  props: LiveCockpitProps;
  settings: MatchCockpitSettings;
  sound: Pick<ReturnType<typeof useMatchSound>, 'play' | 'activate' | 'isActivated'>;
  flows: UseEntryFlowsReturn;
  sides: UseSideOrderReturn;
  /** Meldezeile (Stufe 3 = Bestätigung, Stufe 2 = Fehler). */
  melde: UseCockpitNoticesReturn['melde'];
  /** Engine-Ansicht des Spiels (`null` ohne Engine-Kopie): Grundlage für Abschnittsende von selbst und Wiederanpfiff. */
  engineView: PhaseView | null;
}

export interface CockpitCommands {
  editing: ReturnType<typeof useEngineEventEditing>;
  editingEvent: EditableMatchEvent | null;
  activePenalties: ActivePenalty[];
  dialogs: CockpitDialogState;
  overlayHandlers: CockpitOverlayHandlers;
  teamHandlers: Record<Side, TeamSideHandlers>;
  controls: LegacyPlayAreaProps['controls'];
  onSidebarEventEdit?: LegacyPlayAreaProps['sidebar']['onEventEdit'];
}

export function useCockpitCommands({ props, settings, sound, flows, sides, melde, engineView }: CockpitCommandsArgs): CockpitCommands {
  const { t } = useTranslation('cockpit');
  const { currentMatch: match, onStart, onPause, onResume, onFinish, onGoal, onAdjustTime, onUpdateSettings } = props;
  const readOnly = props.readOnly ?? false;
  // Bestätigungen sind Stufe 3, Fehler Stufe 2 (Spec § 7); `melde` ist stabil.
  const showSuccess = useCallback((message: string) => { melde(3, message); }, [melde]);
  const showInfo = showSuccess;
  const showError = useCallback((message: string) => { melde(2, message); }, [melde]);

  // @SL-068: ein Zurücksetzen durch die Turnierleitung meldet sich, WÄHREND das Cockpit offen ist. Beim Öffnen merkt sich der
  // Ref die vorhandene Kennung und meldet nichts (Gegenbeispiel: schon bekannte Zurücksetzung, auch nicht nach Neuzeichnen).
  const zuruecksetzung = props.letzteZuruecksetzung ?? null;
  const bekannteZuruecksetzung = useRef<string | null>(zuruecksetzung?.id ?? null);
  useEffect(() => {
    if (zuruecksetzung === null || zuruecksetzung.id === bekannteZuruecksetzung.current) { return; }
    bekannteZuruecksetzung.current = zuruecksetzung.id;
    melde(3, t('meldung.zurueckgesetzt', { nummer: zuruecksetzung.spielNummer }));
  }, [zuruecksetzung, melde, t]);

  const [showTimeAdjust, setShowTimeAdjust] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Blätter schließen, wenn das Spiel wechselt (die Eintrags-Auswahl schließt `useEntryFlows` selbst; nur an der
  // Spiel-ID, nicht an `events`, C1/RC13: `LiveCockpit.dialogReset.test.tsx`).
  const matchId = match?.id;
  useEffect(() => {
    setShowTimeAdjust(false);
    setShowEventLog(false);
    setShowSettings(false);
  }, [matchId]);

  // C3b-1: Minus/Rückgängig/Löschen/Bearbeiten (Engine-Spiele: RETRACT/AMEND).
  const editing = useEngineEventEditing({
    tournamentId: props.tournamentId,
    match,
    readOnly,
    legacy: { onGoal, onUndoLastEvent: props.onUndoLastEvent, onUpdateEvent: props.onUpdateEvent, onDeleteEvent: props.onDeleteEvent },
    notify: { success: showSuccess, error: showError },
  });
  const tiebreak = useTiebreakCommands(match, props);

  // Zeitstrafen kommen aus der Engine-Ansicht (B-08a): Sie enden mit dem Abpfiff von selbst (@SL-097), kein lokaler Countdown mehr.
  const activePenalties = useMemo((): ActivePenalty[] => (engineView?.penalties ?? []).map((p) => ({
    eventId: p.id, teamId: p.teamId, ...(p.playerNumber !== undefined ? { playerNumber: p.playerNumber } : {}),
    remainingSeconds: Math.ceil(p.remainingMs / 1000), startedAt: new Date(0), endsAt: new Date(0),
  })), [engineView]);

  // Uhr: Abschnittsende und Abpfiff von selbst, Wiederanpfiff sowie Ton und Vibration (einzige Quelle) in `useCockpitClock`.
  const cockpitClock = useCockpitClock({
    tournamentId: props.tournamentId, match, readOnly, settings, engineView, melde,
    playSound: useCallback(() => { void sound.play(); }, [sound]),
  });
  const clock = useClockControls({
    match, abschnittspause: cockpitClock.abschnittspause,
    // Der Tipp auf Anpfiff/Pause/Weiter gibt den Ton frei (Browser-Geste); ein schwebender Hinweis entfällt.
    sound: { aktiviere: () => { if (settings.soundEnabled && !sound.isActivated) { void sound.activate(); } } },
    onStart: (id) => { onStart(id); showSuccess(t('meldung.angepfiffen')); },
    onPause: (id) => { onPause(id); showInfo(t('meldung.pausiert')); },
    onResume: (id) => { onResume(id); showSuccess(t('meldung.fortgesetzt')); },
    onStartSection: cockpitClock.wiederanpfiff,
    onFinish: (id) => { const gesendet = onFinish(id); melde(3, t('meldung.abgepfiffen'), 'abgepfiffen'); return gesendet; },
    onFinished: cockpitClock.abgepfiffenVonHand,
  });

  // M-1 FIX: Das bearbeitete Ereignis wird aus den aktuellen Ereignissen abgeleitet (kein veralteter Stand).
  const editingEventId = flows.offen?.art === 'nummer' ? flows.offen.eventId ?? null : null;
  const editingEvent = useMemo((): EditableMatchEvent | null => {
    const event = editingEventId ? match?.events.find((e) => e.id === editingEventId) : undefined;
    return event ? { id: event.id, type: event.type, timestampSeconds: event.timestampSeconds, payload: event.payload } : null;
  }, [editingEventId, match?.events]);
  const handleEventEdit = useCallback((event: { id: string }) => {
    if (match?.events.some((e) => e.id === event.id)) { flows.oeffne({ art: 'nummer', seite: null, eventId: event.id }); }
  }, [match, flows]);

  // B-08d: die neue Spielzeit im Abschnitt geht als CLOCK_ADJUST über die Engine. Der Abschnittsbeginn auf der
  // Spieluhr (`limitClockMs - sectionLimitMs`) macht aus der Abschnittszeit den absoluten Uhrstand. Keine Meldung
  // bei Erfolg: die Liste der Einträge zeigt die Korrektur (Aufgabe 4.1); eine Ablehnung meldet die Engine.
  const korrigiereUhr = cockpitClock.korrigiereUhr;
  const handleTimeAdjust = useCallback((neuSekunden: number) => {
    if (!match) { return; }
    // Ohne Engine-Ansicht (Ersatz-Ansicht aus dem LiveMatch) bleibt der bisherige Weg über `onAdjustTime`, mit Meldung.
    if (!engineView) {
      // Im Countdown stellt der Nutzer die Restzeit ein: verstrichen = Dauer - Rest.
      const elapsed = settings.timerDirection === 'countdown' ? match.durationSeconds - neuSekunden : neuSekunden;
      onAdjustTime?.(match.id, elapsed);
      showInfo(t('meldung.zeitGesetzt', { zeit: `${Math.floor(neuSekunden / 60)}:${(neuSekunden % 60).toString().padStart(2, '0')}` }));
      return;
    }
    const { clockMs, previousClockMs } = korrekturUhrstaende(engineView, neuSekunden);
    void korrigiereUhr(clockMs, previousClockMs);
  }, [match, engineView, korrigiereUhr, onAdjustTime, settings.timerDirection, showInfo, t]);

  const sideHandlers = (side: Side): TeamSideHandlers => ({
    onTor: () => flows.tippeTor(side),
    onFoul: () => flows.tippeFoul(side),
    onZeitstrafe: () => flows.tippeZeitstrafe(side),
    onKarte: () => flows.tippeKarte(side),
  });

  // @SL-079: in der Halbzeitpause und nach dem Abpfiff gibt es keine Korrektur (nur laufend oder angehalten).
  // Ohne Engine-Ansicht (Ersatz-Ansicht aus dem LiveMatch) gilt der Status des Spiels.
  const zeitKorrekturMoeglich = engineView
    ? engineView.status === 'running' || engineView.status === 'paused'
    : match?.status === 'RUNNING' || match?.status === 'PAUSED';
  const openTimeAdjust = onAdjustTime && zeitKorrekturMoeglich ? () => setShowTimeAdjust(true) : undefined;
  const zeitGrenzen = engineView
    ? {
      current: Math.floor(engineView.sectionElapsedMs / 1000),
      min: Math.ceil(engineView.earliestAdjustMs / 1000),
      max: Math.floor(engineView.sectionLimitMs / 1000),
      minIsGoal: engineView.earliestAdjustIsGoal,
    }
    : match
      ? { current: match.timerElapsedSeconds ?? 0, min: 0, max: match.durationSeconds, minIsGoal: false }
      : null;
  const overlayHandlers: CockpitOverlayHandlers = {
    closeTimeAdjust: () => setShowTimeAdjust(false),
    confirmTimeAdjust: handleTimeAdjust,
    closeEntry: flows.schliesse,
    updateEvent: editing.update,
    deleteEvent: editing.remove,
    closeEventLog: () => setShowEventLog(false),
    // M-1 FIX: nur die Ereignis-ID merken, das Ereignis wird frisch nachgeschlagen
    editEventFromLog: (event) => { setShowEventLog(false); flows.oeffne({ art: 'nummer', seite: null, eventId: event.id }); },
    closeSettings: () => setShowSettings(false),
    changeSettings: (newSettings) => { if (onUpdateSettings) { onUpdateSettings(newSettings); } },
    testSound: () => { void sound.play(); },
    startOvertime: props.onStartOvertime ? tiebreak.startOvertime : undefined,
    startGoldenGoal: props.onStartGoldenGoal ? tiebreak.startGoldenGoal : undefined,
    startPenaltyShootout: props.onStartPenaltyShootout ? tiebreak.startPenaltyShootout : undefined,
    endAsDraw: props.onForceFinish ? tiebreak.endAsDraw : undefined,
    finishPenaltyShootout: tiebreak.finishPenaltyShootout,
    cancelPenaltyShootout: tiebreak.cancelPenaltyShootout,
  };

  return {
    editing,
    editingEvent,
    activePenalties,
    dialogs: {
      offen: flows.offen,
      showTimeAdjust, showEventLog, showSettings, zeit: zeitGrenzen,
      // Task R2 Fixrunde 2 (H1): unter readOnly gar nicht, und nur mit beiden Strafstoß-Handlern.
      showPenaltyShootout: tiebreak.showPenaltyDialog && !readOnly && !!props.onRecordPenaltyResult && !!props.onAbortPenaltyShootout,
    },
    overlayHandlers,
    teamHandlers: { home: sideHandlers('home'), away: sideHandlers('away') },
    controls: {
      onUndo: editing.undoVisible ? () => { void editing.undo(); } : undefined,
      onStart: clock.starte,
      onPauseResume: clock.pauseOderWeiter,
      wiederanpfiff: cockpitClock.abschnittspause,
      onEditTime: openTimeAdjust,
      onSwitchSides: () => { sides.tausche(); showInfo(t('meldung.seitenGetauscht')); },
      onFinish: clock.pfeifeAb,
      onSettings: () => setShowSettings(true),
      // BUG-002: Event Log for Mobile
      onEventLog: () => setShowEventLog(true),
      canUndo: editing.canUndo,
      undoLabel: editing.undoLabel,
      undoHint: editing.undoHint,
    },
    // Task R2 Fixrunde 2 (M2/Rule 1): Bearbeiten nur bei echter readOnly-Sperre ausgeblendet.
    onSidebarEventEdit: readOnly ? undefined : handleEventEdit,
  };
}
