/**
 * useCockpitCommands – Befehls-Adapter und Effekte der Cockpit-Hülle (Aufgabe 1.3).
 *
 * Verbindet die `on…`-Rückrufe des Aufrufers mit den Bereichen: Tor-, Foul-, Karten-, Zeitstrafen-
 * und Wechsel-Abläufe samt Meldungen, Zeit anpassen, Rückgängig, Uhr-Steuerung (`useClockControls`)
 * und die Entscheidung nach Gleichstand (`useTiebreakCommands`). Hier – nicht in `LiveCockpit.tsx` –
 * kommt jede weitere Befehls- und Effektlogik der Hülle hin, damit sie unter 300 Zeilen bleibt.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { useMatchSound } from '../../../hooks';
import { useEngineEventEditing } from '../../../hooks/useEngineEventEditing';
import type { ActivePenalty, EditableMatchEvent, MatchCockpitSettings } from '../../../types/tournament';
import type { CockpitDialogState, CockpitOverlayHandlers } from '../areas/CockpitOverlays';
import type { LegacyPlayAreaProps, TeamSideHandlers } from '../areas/LegacyPlayArea';
import { EINTRAG_ZEITSTRAFE, type CardKind, type EntryKind, type Side } from '../model/cockpitTypes';
import type { LiveCockpitProps } from '../types';
import type { UseCockpitNoticesReturn } from './useCockpitNotices';
import { useActivePenalties } from './useActivePenalties';
import { useClockControls } from './useClockControls';
import type { UseEntryFlowsReturn } from './useEntryFlows';
import type { UseSideOrderReturn } from './useSideOrder';
import { useTiebreakCommands } from './useTiebreakCommands';

// F3b2: Toast-Schluessel je Kartentyp -- Modulebene statt useCallback-Abhaengigkeit (statisch).
const CARD_TOAST_KEYS: Record<CardKind, 'toast.yellowCard' | 'toast.yellowRedCard' | 'toast.redCard'> = {
  YELLOW: 'toast.yellowCard', YELLOW_RED: 'toast.yellowRedCard', RED: 'toast.redCard',
};

export interface CockpitCommandsArgs {
  props: LiveCockpitProps;
  settings: MatchCockpitSettings;
  sound: Pick<ReturnType<typeof useMatchSound>, 'play' | 'activate' | 'isActivated'>;
  flows: UseEntryFlowsReturn;
  sides: UseSideOrderReturn;
  /** Meldezeile (Stufe 3 = Bestätigung, Stufe 2 = Fehler). */
  melde: UseCockpitNoticesReturn['melde'];
  /** Spielzeit (auch Verlängerung) abgelaufen – Quelle: `useMatchTimerExtended`. */
  isOvertime: boolean;
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

export function useCockpitCommands({ props, settings, sound, flows, sides, melde, isOvertime }: CockpitCommandsArgs): CockpitCommands {
  const { t } = useTranslation('cockpit');
  const { currentMatch: match, onStart, onPause, onResume, onFinish, onGoal, onAdjustTime, onTimePenalty, onCard, onSubstitution, onFoul, onUpdateSettings } = props;
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

  // C3b-1: Minus/Rückgängig/Löschen/Bearbeiten (Engine-Spiele: RETRACT/AMEND) und Zeitstrafen-Countdown.
  const editing = useEngineEventEditing({
    tournamentId: props.tournamentId,
    match,
    readOnly,
    legacy: { onGoal, onUndoLastEvent: props.onUndoLastEvent, onUpdateEvent: props.onUpdateEvent, onDeleteEvent: props.onDeleteEvent },
    notify: { success: showSuccess, error: showError },
  });
  const penalties = useActivePenalties(match?.id, match?.status, match?.events);
  const tiebreak = useTiebreakCommands(match, props);

  // Uhr: Meldungen und das Leeren der Zeitstrafen (BUG-008) hängen am Abpfiff, auch am automatischen.
  const clock = useClockControls({
    match, kannSteuern: !readOnly, autoFinishEnabled: settings.autoFinishEnabled, zeitAbgelaufen: isOvertime,
    sound: {
      enabled: settings.soundEnabled, play: () => { void sound.play(); },
      // Der Tipp auf Anpfiff/Pause/Weiter gibt den Ton frei (Browser-Geste); ein schwebender Hinweis entfällt.
      aktiviere: () => { if (settings.soundEnabled && !sound.isActivated) { void sound.activate(); } },
    },
    hapticEnabled: settings.hapticEnabled,
    onStart: (id) => { onStart(id); showSuccess(t('meldung.angepfiffen')); },
    onPause: (id) => { onPause(id); showInfo(t('meldung.pausiert')); },
    onResume: (id) => { onResume(id); showSuccess(t('meldung.fortgesetzt')); },
    onFinish: (id) => { onFinish(id); penalties.clear(); showInfo(t('meldung.abgepfiffen')); },
  });

  const teamNameOf = useCallback(
    (teamId: string): string => (match?.homeTeam.id === teamId ? match.homeTeam.name : match?.awayTeam.name ?? ''),
    [match],
  );

  // M-1 FIX: Das bearbeitete Ereignis wird aus den aktuellen Ereignissen abgeleitet (kein veralteter Stand).
  const editingEventId = flows.offen?.art === 'nummer' ? flows.offen.eventId ?? null : null;
  const editingEvent = useMemo((): EditableMatchEvent | null => {
    const event = editingEventId ? match?.events.find((e) => e.id === editingEventId) : undefined;
    return event ? { id: event.id, type: event.type, timestampSeconds: event.timestampSeconds, payload: event.payload } : null;
  }, [editingEventId, match?.events]);
  const handleEventEdit = useCallback((event: { id: string }) => {
    if (match?.events.some((e) => e.id === event.id)) { flows.oeffne({ art: 'nummer', seite: null, eventId: event.id }); }
  }, [match, flows]);

  const goalSide = flows.offen?.art === 'tor' ? flows.offen.seite : null;
  const handleGoalConfirm = useCallback(
    (jerseyNumber: number | null, assists?: (number | null)[], incomplete?: boolean) => {
      if (!match || !goalSide) { return; }
      const team = goalSide === 'home' ? match.homeTeam : match.awayTeam;
      const validAssists = assists?.filter((a): a is number => a !== null) ?? [];
      onGoal(match.id, team.id, 1, {
        playerNumber: jerseyNumber ?? undefined,
        assists: validAssists.length > 0 ? validAssists : undefined,
        incomplete: incomplete ?? false,
      });
      if (incomplete) {
        showInfo(`${t('toast.goalScored', { teamName: team.name })} (ohne Nr.)`);
      } else if (jerseyNumber !== null) {
        const assistText = validAssists.length > 0
          ? ` (${t('sidebar.assistFormat', { assists: validAssists.map((a) => `#${a}`).join(', ') })})`
          : '';
        showSuccess(`${t('toast.goalScored', { teamName: team.name })} (#${jerseyNumber})${assistText}`);
      } else {
        showSuccess(`${t('toast.goalScored', { teamName: team.name })}!`);
      }
      flows.schliesse();
    },
    [match, goalSide, flows, onGoal, showSuccess, showInfo, t],
  );

  const handleFoul = useCallback((side: Side) => {
    if (!match) { return; }
    const team = side === 'home' ? match.homeTeam : match.awayTeam;
    onFoul?.(match.id, team.id);
    showInfo(t('toast.foul', { teamName: team.name }));
  }, [match, onFoul, showInfo, t]);

  const handleCardConfirm = useCallback((cardType: CardKind, teamId: string, playerNumber?: number) => {
    if (!match) { return; }
    onCard?.(match.id, teamId, cardType, { playerNumber });
    showInfo(`${t(CARD_TOAST_KEYS[cardType], { teamName: teamNameOf(teamId) })}${playerNumber ? ` (#${playerNumber})` : ''}`);
    flows.schliesse();
  }, [match, onCard, flows, showInfo, t, teamNameOf]);

  const handleTimePenaltyConfirm = useCallback((durationSeconds: number, teamId: string, playerNumber?: number) => {
    if (!match) { return; }
    onTimePenalty?.(match.id, teamId, { playerNumber, durationSeconds });
    showInfo(`${t('toast.timePenalty', { minutes: Math.floor(durationSeconds / 60), teamName: teamNameOf(teamId) })}${playerNumber ? ` (#${playerNumber})` : ''}`);
    penalties.add({ teamId, playerNumber, durationSeconds }); // lokaler Countdown
    flows.schliesse();
  }, [match, onTimePenalty, flows, showInfo, penalties, t, teamNameOf]);

  // BUG-009: mehrere Spieler je Wechsel
  const handleSubstitutionConfirm = useCallback((teamId: string, playersOut: number[], playersIn: number[]) => {
    if (!match) { return; }
    onSubstitution?.(match.id, teamId, {
      playersOut: playersOut.length > 0 ? playersOut : undefined,
      playersIn: playersIn.length > 0 ? playersIn : undefined,
    });
    const nummern = (liste: number[]): string => (liste.length > 0 ? liste.map((n) => `#${n}`).join(',') : '?');
    showInfo(`Wechsel ${teamNameOf(teamId)}: ${nummern(playersOut)} → ${nummern(playersIn)}`);
    flows.schliesse();
  }, [match, onSubstitution, flows, showInfo, teamNameOf]);

  const handleTimeAdjust = useCallback((newDisplaySeconds: number) => {
    if (!match) { return; }
    // Im Countdown stellt der Nutzer die Restzeit ein: verstrichen = Dauer - Rest.
    const elapsed = settings.timerDirection === 'countdown' ? match.durationSeconds - newDisplaySeconds : newDisplaySeconds;
    onAdjustTime?.(match.id, elapsed);
    showInfo(t('meldung.zeitGesetzt', { zeit: `${Math.floor(newDisplaySeconds / 60)}:${(newDisplaySeconds % 60).toString().padStart(2, '0')}` }));
  }, [match, onAdjustTime, showInfo, settings.timerDirection, t]);

  const open = (art: EntryKind, side: Side) => () => flows.oeffne({ art, seite: side });
  const sideHandlers = (side: Side): TeamSideHandlers => ({
    onGoal: open('tor', side),
    onMinus: () => { void editing.minus(side); },
    onPenalty: open(EINTRAG_ZEITSTRAFE, side),
    onYellowCard: () => flows.oeffne({ art: 'karte', seite: side, kartenArt: 'YELLOW' }),
    onYellowRedCard: () => flows.oeffne({ art: 'karte', seite: side, kartenArt: 'YELLOW_RED' }),
    onRedCard: () => flows.oeffne({ art: 'karte', seite: side, kartenArt: 'RED' }),
    onSubstitution: open('wechsel', side),
    onFoul: () => handleFoul(side),
  });

  const openTimeAdjust = onAdjustTime ? () => setShowTimeAdjust(true) : undefined;
  const overlayHandlers: CockpitOverlayHandlers = {
    closeTimeAdjust: () => setShowTimeAdjust(false),
    confirmTimeAdjust: handleTimeAdjust,
    closeEntry: flows.schliesse,
    confirmCard: handleCardConfirm,
    confirmTimePenalty: handleTimePenaltyConfirm,
    confirmSubstitution: handleSubstitutionConfirm,
    confirmGoal: handleGoalConfirm,
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
    activePenalties: penalties.penalties,
    dialogs: {
      offen: flows.offen,
      showTimeAdjust, showEventLog, showSettings,
      // Task R2 Fixrunde 2 (H1): unter readOnly gar nicht, und nur mit beiden Strafstoß-Handlern.
      showPenaltyShootout: tiebreak.showPenaltyDialog && !readOnly && !!props.onRecordPenaltyResult && !!props.onAbortPenaltyShootout,
    },
    overlayHandlers,
    teamHandlers: { home: sideHandlers('home'), away: sideHandlers('away') },
    controls: {
      onUndo: editing.undoVisible ? () => { void editing.undo(); } : undefined,
      onStart: clock.starte,
      onPauseResume: clock.pauseOderWeiter,
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
