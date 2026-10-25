/**
 * „Nach dem Ende eingetroffen“ (Plan R3-4, @LZ-039, @LZ-040, @FU-018): Einträge, die nach dem Abschluss ankamen, liegen in
 * `late_entries` (Server `20261113_003`, Lesen nur die Turnierleitung `manageLifecycle`). Hier nur der Lesepfad, ohne React:
 * `from(...).select` mit Zeitgrenze, jede Zeile per zod geprüft (eine unlesbare Zeile fällt weg, nichts bricht die Liste).
 * Namen (E8): die Mitgliederliste des Turniers (`tournament_collaborators.label` je `user_id`); fehlt ein Name, bleibt es
 * `null` und die Oberfläche zeigt „Helfer-Gerät“ – nie eine E-Mail.
 *
 * Fehlerpolitik (wirft nie): ohne Client oder bei Fehler/Zeitgrenze `{ ok: false }`, die Oberfläche behält den letzten Stand.
 */
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { withCloudReadTimeout } from './cloudAdoption';

const EventSchema = z.looseObject({
  type: z.string(),
  teamId: z.string().nullish(),
  section: z.number().nullish(),
  clockMs: z.number().nullish(),
  at: z.number().nullish(),
  payload: z.record(z.string(), z.unknown()).nullish(),
});

const RowSchema = z.object({
  id: z.number(),
  match_id: z.string(),
  event_id: z.string(),
  event: EventSchema,
  actor: z.string(),
  device_id: z.string().nullable(),
  received_at: z.string(),
});

export interface LateEntry {
  id: number;
  matchId: string;
  eventId: string;
  type: string;
  teamId: string | null;
  playerNumber: number | null;
  /** Gerätezeit des Eintrags (ms), `null` wenn unbekannt. */
  recordedAt: number | null;
  actor: string;
  /** Name aus der Mitgliederliste; `null` = unbekannt. */
  actorName: string | null;
  receivedAt: string;
}

export type LateEntriesResult = { ok: true; entries: LateEntry[] } | { ok: false };

export async function readLateEntries(client: SupabaseClient<Database> | null, tournamentId: string): Promise<LateEntriesResult> {
  if (!client) {
    return { ok: false };
  }
  try {
    const [rows, members] = await withCloudReadTimeout(Promise.all([
      Promise.resolve(client.from('late_entries').select('id, match_id, event_id, event, actor, device_id, received_at')
        .eq('tournament_id', tournamentId).order('received_at', { ascending: true }).order('id', { ascending: true })),
      Promise.resolve(client.from('tournament_collaborators').select('user_id, label').eq('tournament_id', tournamentId).not('user_id', 'is', null)),
    ]));
    if (rows.error || !rows.data) {
      return { ok: false };
    }
    const names = new Map<string, string>();
    for (const member of members.data ?? []) {
      const label = member.label?.trim() ?? '';
      if (member.user_id && label !== '' && !names.has(member.user_id)) {
        names.set(member.user_id, label);
      }
    }
    const entries: LateEntry[] = [];
    for (const raw of rows.data) {
      const parsed = RowSchema.safeParse(raw);
      if (!parsed.success) {
        continue;
      }
      const { event } = parsed.data;
      const number = event.payload?.playerNumber;
      entries.push({
        id: parsed.data.id,
        matchId: parsed.data.match_id,
        eventId: parsed.data.event_id,
        type: event.type,
        teamId: event.teamId ?? null,
        playerNumber: typeof number === 'number' ? number : null,
        recordedAt: event.at ?? null,
        actor: parsed.data.actor,
        actorName: names.get(parsed.data.actor) ?? null,
        receivedAt: parsed.data.received_at,
      });
    }
    return { ok: true, entries };
  } catch {
    return { ok: false };
  }
}
