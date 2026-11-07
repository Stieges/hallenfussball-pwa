/**
 * Abfragen des Feldstands (H3b-2a): Spielplan, Sammelabfrage der Ereignisse und Konto-Prüfung, je mit Abbruch nach 3 s.
 *
 * - Spielplan: `tournaments` (Datum, Lebenszyklus) und `matches` des Turniers, nur die nötigen Spalten.
 * - Ereignisse: eine Abfrage `match_events` mit `match_id IN (…)` für alle aktuellen Spiele, gleiche Filter wie
 *   `makeFetchConfirmed` (`event_format` gesetzt, `review_state` leer). `seq` ist eine Spalte über alle Spiele (IDENTITY),
 *   abgefragt wird ab dem kleinsten Wasserstand, und je Spiel zählt nur, was über seinem eigenen Wasserstand liegt.
 *   Umrechnung mit `rowToEngineEvent`; nichts geht in IndexedDB, an andere Tabs oder in die Engine.
 * - Fehlerbild als Ergebnisart, nie ein Wurf: `netz` (auch Abbruch), `turnierBeendet` (SQLSTATE 55000).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';
import { rowToEngineEvent, type EngineEventWithSeq } from '../../../core/match/client';
import { TOURNAMENT_FINISHED_CODE } from '../../../core/errors';
import type { Zeitgeber } from './zeitgeber';

export type FeldStandClient = SupabaseClient<Database>;

/** Abbruch jeder Abfrage nach 3 s (Plan „Datenweg“); die Antwort altert dann. */
export const ABFRAGE_ABBRUCH_MS = 3000;
const SEITE = 500;

export type AbfrageErgebnis<T> = { ok: true; wert: T } | { ok: false; grund: 'netz' | 'turnierBeendet' };

export interface SpielplanZeile {
  id: string;
  field: number;
  slot: number | null;
  match_number: number | null;
  round: number;
  scheduled_start: string | null;
  match_status: string | null;
  score_a: number | null;
  score_b: number | null;
  team_a_id: string | null;
  team_b_id: string | null;
}

export interface Spielplan {
  datum: string;
  /** `lifecycle_status` `finished`/`cancelled` (wie `tournament_is_closed`). */
  abgeschlossen: boolean;
  spiele: SpielplanZeile[];
}

const SPIELPLAN_SPALTEN = 'id, field, slot, match_number, round, scheduled_start, match_status, score_a, score_b, team_a_id, team_b_id';
const EREIGNIS_SPALTEN =
  'id, match_id, type, client_time, recorded_at, section, clock_ms, team_id, target_event_id, payload, seq, event_format, review_state';

function istTurnierBeendet(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === TOURNAMENT_FINISHED_CODE;
}

/**
 * Führt `abfrage` mit einem Signal aus, das nach 3 s abbricht. Auch ein Client, der das Signal überhört, hält den Ablauf
 * nicht auf: Nach 3 s gilt die Abfrage als gescheitert.
 */
async function mitAbbruch<T>(zeitgeber: Zeitgeber, abfrage: (signal: AbortSignal) => Promise<T>): Promise<AbfrageErgebnis<T>> {
  const steuerung = new AbortController();
  let stoppeUhr: () => void = () => undefined;
  const abbruch = new Promise<AbfrageErgebnis<T>>((resolve) => {
    stoppeUhr = zeitgeber.spaeter(() => {
      steuerung.abort();
      resolve({ ok: false, grund: 'netz' });
    }, ABFRAGE_ABBRUCH_MS);
  });
  const lauf = abfrage(steuerung.signal).then(
    (wert): AbfrageErgebnis<T> => ({ ok: true, wert }),
    (error: unknown): AbfrageErgebnis<T> => ({ ok: false, grund: istTurnierBeendet(error) ? 'turnierBeendet' : 'netz' }),
  );
  try {
    return await Promise.race([lauf, abbruch]);
  } finally {
    stoppeUhr();
  }
}

/** `is_real_account()`: Gast oder Gerätesitzung ohne Konto → `false`. */
export function pruefeEchtesKonto(client: FeldStandClient, zeitgeber: Zeitgeber): Promise<AbfrageErgebnis<boolean>> {
  return mitAbbruch(zeitgeber, async (signal) => {
    const { data, error } = await client.rpc('is_real_account').abortSignal(signal);
    if (error) {
      throw error;
    }
    return data;
  });
}

export function ladeSpielplan(client: FeldStandClient, turnierId: string, zeitgeber: Zeitgeber): Promise<AbfrageErgebnis<Spielplan>> {
  return mitAbbruch(zeitgeber, async (signal) => {
    const turnier = await client.from('tournaments').select('date, lifecycle_status').eq('id', turnierId).abortSignal(signal).maybeSingle();
    if (turnier.error || !turnier.data) {
      throw turnier.error ?? new Error('Turnier nicht lesbar');
    }
    const spiele = await client.from('matches').select(SPIELPLAN_SPALTEN).eq('tournament_id', turnierId).abortSignal(signal);
    if (spiele.error) {
      throw spiele.error;
    }
    const status = turnier.data.lifecycle_status;
    return { datum: turnier.data.date, abgeschlossen: status === 'finished' || status === 'cancelled', spiele: spiele.data ?? [] };
  });
}

/**
 * Neue bestätigte Ereignisse je Spiel über seinem Wasserstand (`wasserstaende`: Spiel-ID klein → höchste bekannte `seq`).
 * Ergebnis je Spiel in `seq`-Folge; Spiele ohne neue Ereignisse fehlen.
 */
export function ladeEreignisse(
  client: FeldStandClient,
  wasserstaende: ReadonlyMap<string, number>,
  zeitgeber: Zeitgeber,
): Promise<AbfrageErgebnis<Map<string, EngineEventWithSeq[]>>> {
  return mitAbbruch(zeitgeber, async (signal) => {
    const neu = new Map<string, EngineEventWithSeq[]>();
    const ids = [...wasserstaende.keys()];
    let ab = Math.min(...wasserstaende.values());
    for (;;) {
      const seite = await client
        .from('match_events')
        .select(EREIGNIS_SPALTEN)
        .in('match_id', ids)
        .not('event_format', 'is', null)
        .is('review_state', null)
        .gt('seq', ab)
        .order('seq', { ascending: true })
        .limit(SEITE)
        .abortSignal(signal);
      if (seite.error) {
        throw seite.error;
      }
      const zeilen = seite.data ?? [];
      for (const zeile of zeilen) {
        ab = Math.max(ab, zeile.seq);
        const matchId = zeile.match_id.toLowerCase();
        if (zeile.seq <= (wasserstaende.get(matchId) ?? Number.POSITIVE_INFINITY)) {
          continue;
        }
        const payload = zeile.payload !== null && typeof zeile.payload === 'object' && !Array.isArray(zeile.payload) ? zeile.payload : {};
        const liste = neu.get(matchId) ?? [];
        liste.push(rowToEngineEvent({ ...zeile, payload }));
        neu.set(matchId, liste);
      }
      if (zeilen.length < SEITE) {
        return neu;
      }
    }
  });
}
