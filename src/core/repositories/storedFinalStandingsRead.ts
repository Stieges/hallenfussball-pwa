/**
 * Der beim Abschluss gespeicherte Endstand (`tournament_final_standings`, Plan R3-4 Zustand C; R3-5 liest dieselbe Zeile):
 * Lesen dürfen Turnierleitung und Helfer (`writeMatchData`, Server `20261113_003`). Die Form prüft `FinalStandingsSnapshotSchema`;
 * ein formwidriger Stand gilt als nicht lesbar – nie ein halb gelesener Endstand (@ET-045). Rein ohne React, wirft nie.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';
import { FinalStandingsSnapshotSchema } from '../models/schemas/FinalStandingsSchema';
import type { FinalStandingsSnapshot } from '../standings/finalStandings/types';
import { withCloudReadTimeout } from './cloudAdoption';

export type StoredFinalStandingsResult =
  | { status: 'ok'; snapshot: FinalStandingsSnapshot; finishedAt: string }
  /** Es gibt keine gespeicherte Zeile (nie abgeschlossen oder kein Recht). */
  | { status: 'none' }
  | { status: 'failed' };

export async function readStoredFinalStandings(client: SupabaseClient<Database> | null, tournamentId: string): Promise<StoredFinalStandingsResult> {
  if (!client) {
    return { status: 'failed' };
  }
  try {
    const response = await withCloudReadTimeout(Promise.resolve(
      client.from('tournament_final_standings').select('snapshot, finished_at').eq('tournament_id', tournamentId).maybeSingle(),
    ));
    if (response.error) {
      return { status: 'failed' };
    }
    if (!response.data) {
      return { status: 'none' };
    }
    const parsed = FinalStandingsSnapshotSchema.safeParse(response.data.snapshot);
    return parsed.success ? { status: 'ok', snapshot: parsed.data, finishedAt: response.data.finished_at } : { status: 'failed' };
  } catch {
    return { status: 'failed' };
  }
}
