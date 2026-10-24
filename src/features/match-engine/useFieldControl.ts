/**
 * useFieldControl (B-49): Steuer je Feld eines Turniers aus Sicht dieses Geräts, dazu „Spielleitung übernehmen“.
 *
 * Quelle ist `field_control_state` (A-34, kein Realtime): gelesen beim Öffnen, alle 5 Sekunden (`poll`, nur sichtbar und
 * mit Netz), nach jedem Sende-Lauf des Ausgangs (eigener Anpfiff → Anspruch, NOT_CONTROLLER → fremdes Feld, @FU-030) und
 * nach einer Übernahme. Ohne Netz bleibt der zuletzt gelesene Stand gültig; Gast und ohne Supabase gibt es keinen Stand
 * (`list === null`, nichts gesperrt, @FU-034 Notübernahme ist MVP+).
 *
 * Gerätebezeichnung (@HE-049 „Feld 2: Tom (Handy)“): Der Anspruch per Anpfiff setzt keine; steuert dieses Gerät ein Feld ohne
 * Bezeichnung, trägt `take_field_control` mit der aktuellen Epoche sie nach (Server: „unchanged“, Epoche bleibt).
 *
 * Übernehmen (@FU-027, @FU-028): nur mit Netz (`navigator.onLine`, sonst ohne Aufruf `offline`) und mit der zuletzt gesehenen
 * Epoche; danach neu lesen und den Ausgang anstoßen (eigene wartende Einträge gehören jetzt zum steuernden Gerät).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDeviceId } from '../../core/device/deviceId';
import { deviceLabel } from '../../core/device/deviceLabel';
import { ownFieldsWithoutLabel } from '../../core/fieldControl/fieldControlView';
import { readFieldControlState, takeFieldControl, type FieldControlInfo, type TakeFieldControlResult } from '../../core/repositories/fieldControlRpc';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useMatchEngineContextOptional } from './useMatchEngineContext';

export const FIELD_CONTROL_POLL_MS = 5000;
const AFTER_SEND_DEBOUNCE_MS = 250;

export interface FieldControl {
  /** Stand aller Felder; `null` = unbekannt (Gast, noch nicht gelesen, nie mit Netz gelesen). */
  list: FieldControlInfo[] | null;
  /** Netz-Weg vorhanden (angemeldet, kein Gast, Supabase konfiguriert). */
  active: boolean;
  deviceId: string;
  /** Liest den Stand neu und liefert ihn (bei Fehler den bisherigen). */
  refresh: () => Promise<FieldControlInfo[] | null>;
  /** „Spielleitung übernehmen“ mit der zuletzt gesehenen Epoche. */
  takeOver: (field: number, expectedEpoch: number) => Promise<TakeFieldControlResult>;
}

function currentDeviceLabel(): string | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  return deviceLabel(navigator.userAgent, navigator.maxTouchPoints);
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

export function useFieldControl(tournamentId: string, options: { poll?: boolean } = {}): FieldControl {
  const poll = options.poll ?? true;
  const context = useMatchEngineContextOptional();
  const active = isSupabaseConfigured && supabase !== null && context !== null && context.accountId !== 'guest';
  const deviceId = useMemo(() => getDeviceId(), []);
  const [stand, setStand] = useState<{ tournamentId: string; list: FieldControlInfo[] } | null>(null);
  const list = active && stand?.tournamentId === tournamentId ? stand.list : null;
  const listRef = useRef(list);
  listRef.current = list;

  const refresh = useCallback(async (): Promise<FieldControlInfo[] | null> => {
    if (!active) {
      return null;
    }
    const next = await readFieldControlState(supabase, tournamentId, deviceId);
    if (next === null) {
      return listRef.current;
    }
    setStand({ tournamentId, list: next });
    return next;
  }, [active, tournamentId, deviceId]);

  // Lesen beim Öffnen und alle 5 Sekunden (sichtbar, mit Netz); bei Rückkehr ins Netz bzw. in den Vordergrund sofort
  useEffect(() => {
    if (!active || !poll) {
      return undefined;
    }
    const due = (): void => {
      if (document.visibilityState !== 'hidden' && !isOffline()) {
        void refresh();
      }
    };
    due();
    const timer = setInterval(due, FIELD_CONTROL_POLL_MS);
    window.addEventListener('online', due);
    document.addEventListener('visibilitychange', due);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', due);
      document.removeEventListener('visibilitychange', due);
    };
  }, [active, poll, refresh]);

  // Nach jedem Sende-Lauf neu lesen (Anspruch per Anpfiff, NOT_CONTROLLER, @FU-030)
  const sender = context?.sender ?? null;
  useEffect(() => {
    if (!active || !poll || !sender) {
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = sender.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, AFTER_SEND_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [active, poll, sender, refresh]);

  // @HE-049: Gerätebezeichnung nachtragen, einmal je Feld und Epoche
  const labelled = useRef(new Set<string>());
  useEffect(() => {
    if (!active) {
      return;
    }
    const label = currentDeviceLabel();
    for (const info of ownFieldsWithoutLabel(list)) {
      const key = `${tournamentId}:${info.field}:${info.epoch}`;
      if (label === null || labelled.current.has(key)) {
        continue;
      }
      labelled.current.add(key);
      void takeFieldControl(supabase, { tournamentId, field: info.field, deviceId, deviceLabel: label, expectedEpoch: info.epoch })
        .then((result) => (result.kind === 'unchanged' || result.kind === 'taken' ? refresh() : null));
    }
  }, [active, list, tournamentId, deviceId, refresh]);

  const takeOver = useCallback(async (field: number, expectedEpoch: number): Promise<TakeFieldControlResult> => {
    if (!active || isOffline()) {
      return { kind: 'offline' };
    }
    const result = await takeFieldControl(supabase, { tournamentId, field, deviceId, deviceLabel: currentDeviceLabel(), expectedEpoch });
    if (result.kind !== 'offline') {
      await refresh();
    }
    if ((result.kind === 'taken' || result.kind === 'unchanged') && sender) {
      void sender.kick();
    }
    return result;
  }, [active, tournamentId, deviceId, refresh, sender]);

  return { list, active, deviceId, refresh, takeOver };
}
