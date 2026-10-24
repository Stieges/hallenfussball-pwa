/**
 * B-26 „Zeiten verschieben“: Zustand von Dialog, Vorschau, Wiederherstellen und Streifen. Die Regeln stehen rein in
 * `core/services/scheduleShift.ts`; hier nur Bedienung und Speichern über den Voll-Speicherweg des Turniers (wie der Tausch).
 *
 * - Vor dem ersten Anpfiff gilt „Übernehmen“ sofort (@ZP-019, @ZP-089), danach erst nach Vorschau und Bestätigung (@ZP-017).
 * - Ohne Bestätigung ändert sich nichts (@ZP-018): gespeichert wird nur in `confirm`.
 * - Beim Bestätigen rechnet der Plan auf dem aktuellen Stand neu: ein inzwischen angepfiffenes Spiel bleibt draußen.
 * - „Jetzt“ ist die Serverzeit (Uhr der Spiel-Engine, Zone 1), ohne Engine die Geräteuhr – als Wanduhr der Turnier-Zeitzone;
 *   die Anpfiffe liegen am Turnierdatum (`onTournamentDay`), damit Kopien mit neuem Datum und fremde Gerätezeitzonen stimmen.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  hasRestorableTimes,
  isTournamentKickedOff,
  planRestore,
  planShift,
} from '../../../core/services/ScheduleService';
import type { ShiftPlan, ShiftRequest } from '../../../core/services/scheduleShift';
import { actualKickoffWallClock, onTournamentDay, tournamentWallClock } from '../../../core/services/scheduleShiftClock';
import { viewStatus, type TournamentView, type ViewMatchStatus } from '../../../core/view';
import type { Match, Tournament } from '../../../types/tournament';
import { useMatchEngineContextOptional } from '../../match-engine/useMatchEngineContext';
import { clockText } from './timeShiftText';

export type ShiftDirection = 'later' | 'earlier';
export type ShiftFromMode = 'time' | 'match';
export type TimeShiftStep = 'closed' | 'form' | 'preview' | 'restore';

export interface ShiftForm {
  direction: ShiftDirection;
  mode: ShiftFromMode;
  /** „hh:mm“ */
  time: string;
  matchId: string | undefined;
  minutes: number;
  /** Aus „Ab hier verschieben“ übernommen */
  presetMatchId?: string;
}

export interface ShiftStrip {
  direction: ShiftDirection;
  minutes: number;
  end: Date | undefined;
}

/** Abfrage-Parameter, mit dem die Einstellungen den Dialog im Spielplan öffnen (@ZP-095). */
export const SHIFT_QUERY = 'verschieben';
const NOW_TICK_MS = 15_000;

function sameDayAt(reference: Date | undefined, hhmm: string): Date | undefined {
  const found = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (reference === undefined || found === null) {
    return undefined;
  }
  const at = new Date(reference);
  at.setHours(Number(found[1]), Number(found[2]), 0, 0);
  return at;
}

function firstOpen(matches: readonly Match[], statusOf: (m: Match) => ViewMatchStatus): Match | undefined {
  return [...matches]
    .filter((m) => m.scheduledTime !== undefined && statusOf(m) === 'scheduled')
    .sort((a, b) => new Date(a.scheduledTime ?? 0).getTime() - new Date(b.scheduledTime ?? 0).getTime() || a.field - b.field)[0];
}

export interface UseTimeShiftArgs {
  tournament: Tournament;
  view: TournamentView;
  onTournamentUpdate: (tournament: Tournament, regenerateSchedule?: boolean) => void;
  showSuccess: (message: string) => void;
}

export function useTimeShift({ tournament, view, onTournamentUpdate, showSuccess }: UseTimeShiftArgs) {
  const { t } = useTranslation('tournament');
  const clock = useMatchEngineContextOptional()?.clock;
  const serverNow = useCallback(() => tournamentWallClock(new Date(clock ? clock.serverNow() : Date.now())), [clock]);
  const [step, setStep] = useState<TimeShiftStep>('closed');
  const [form, setForm] = useState<ShiftForm>({ direction: 'later', mode: 'time', time: '', matchId: undefined, minutes: 10 });
  const [strip, setStrip] = useState<ShiftStrip | null>(null);
  const [now, setNow] = useState<Date>(serverNow);
  const [searchParams, setSearchParams] = useSearchParams();

  const day = tournament.startDate ?? tournament.date;
  const matches = useMemo(() => onTournamentDay(tournament.matches, day), [tournament.matches, day]);
  const statusOf = useCallback((m: Match): ViewMatchStatus => view.byId.get(m.id)?.status ?? viewStatus(m), [view]);
  const rules = tournament;
  const kickedOff = useMemo(() => isTournamentKickedOff(matches, { statusOf }), [matches, statusOf]);
  const restorable = useMemo(() => kickedOff && hasRestorableTimes(matches, { statusOf }), [kickedOff, matches, statusOf]);

  // „Jetzt“ läuft weiter, solange ein Dialog offen ist (Grenze Vergangenheit, „beginnt in X Minuten“)
  useEffect(() => {
    if (step === 'closed') {
      return undefined;
    }
    setNow(serverNow());
    const id = window.setInterval(() => setNow(serverNow()), NOW_TICK_MS);
    return () => window.clearInterval(id);
  }, [step, serverNow]);

  const open = useCallback((presetMatchId?: string) => {
    const first = firstOpen(matches, statusOf);
    const preset = presetMatchId === undefined ? undefined : matches.find((m) => m.id === presetMatchId);
    setForm({
      direction: 'later',
      mode: preset ? 'match' : 'time',
      time: clockText(preset?.scheduledTime ?? first?.scheduledTime) ?? '',
      matchId: preset?.id ?? first?.id,
      minutes: 10,
      ...(preset ? { presetMatchId: preset.id } : {}),
    });
    setStep('form');
  }, [matches, statusOf]);

  // Einstieg aus den Einstellungen (Schloss → „Zeiten verschieben“): ?verschieben=1 öffnet den Dialog einmal
  useEffect(() => {
    if (searchParams.get(SHIFT_QUERY) === null) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete(SHIFT_QUERY);
    setSearchParams(next, { replace: true });
    open();
  }, [searchParams, setSearchParams, open]);

  const requestOf = useCallback((f: ShiftForm, list: readonly Match[]): ShiftRequest | undefined => {
    const signed = f.direction === 'later' ? f.minutes : -f.minutes;
    if (f.mode === 'match') {
      return f.matchId === undefined ? undefined : { from: { kind: 'match', matchId: f.matchId }, minutes: signed };
    }
    const reference = firstOpen(list, statusOf)?.scheduledTime ?? list.find((m) => m.scheduledTime)?.scheduledTime;
    const at = sameDayAt(reference === undefined ? undefined : new Date(reference), f.time);
    return at === undefined ? undefined : { from: { kind: 'time', at }, minutes: signed };
  }, [statusOf]);

  const plan: ShiftPlan | undefined = useMemo(() => {
    const request = requestOf(form, matches);
    return request === undefined ? undefined : planShift(matches, request, rules, { now, statusOf, actualStartOf: actualKickoffWallClock });
  }, [form, matches, rules, now, statusOf, requestOf]);

  const restorePlan: ShiftPlan | undefined = useMemo(
    () => (step === 'restore' ? planRestore(matches, rules, { now, statusOf, actualStartOf: actualKickoffWallClock }) : undefined),
    [step, matches, rules, now, statusOf],
  );

  const close = useCallback(() => setStep('closed'), []);

  const save = useCallback((next: Match[]) => {
    onTournamentUpdate({ ...tournament, matches: next, updatedAt: new Date().toISOString() }, false);
  }, [onTournamentUpdate, tournament]);

  /** Speichert die Verschiebung (vor dem ersten Anpfiff aus dem Dialog, danach aus der Vorschau). */
  const confirm = useCallback(() => {
    const request = requestOf(form, matches);
    if (request === undefined) {
      return;
    }
    const fresh = planShift(matches, request, rules, { now: serverNow(), statusOf, actualStartOf: actualKickoffWallClock });
    if (fresh.error !== undefined || fresh.changes.length === 0) {
      setNow(serverNow());
      setStep('form');
      return;
    }
    save(fresh.matches);
    const count = fresh.changes.length;
    const minutes = form.minutes;
    const message = kickedOff
      ? t(form.direction === 'later' ? 'timeShift.toastLater' : 'timeShift.toastEarlier', { count, minutes })
      : t(form.direction === 'later' ? 'timeShift.toastPlanLater' : 'timeShift.toastPlanEarlier', { minutes });
    showSuccess(message);
    setStrip({ direction: form.direction, minutes, end: fresh.newEnd });
    setStep('closed');
  }, [requestOf, form, matches, rules, serverNow, statusOf, save, kickedOff, t, showSuccess]);

  /** Weiter: vor dem ersten Anpfiff sofort, danach zur Vorschau. */
  const proceed = useCallback(() => {
    if (kickedOff) {
      setStep('preview');
    } else {
      confirm();
    }
  }, [kickedOff, confirm]);

  const openRestore = useCallback(() => setStep('restore'), []);

  const confirmRestore = useCallback(() => {
    const fresh = planRestore(matches, rules, { now: serverNow(), statusOf, actualStartOf: actualKickoffWallClock });
    if (fresh.changes.length > 0) {
      save(fresh.matches);
      showSuccess(t('timeShift.toastRestored'));
    }
    setStrip(null);
    setStep('closed');
  }, [matches, rules, serverNow, statusOf, save, showSuccess, t]);

  const dismissStrip = useCallback(() => setStrip(null), []);

  return {
    step, form, setForm, plan, restorePlan, kickedOff, restorable, now, strip,
    open, close, proceed, confirm, openRestore, confirmRestore, dismissStrip, backToForm: () => setStep('form'), statusOf,
  };
}

export type TimeShiftState = ReturnType<typeof useTimeShift>;
