/**
 * Realtime-Bindungen der Server-Tabellen zu „Gruppe abschließen“ (GA4 A-13b-C, Migration `20261110_006` § 6): Abschlüsse,
 * Folgen-Hinweise und Klärungen eines Turniers laufen im selben Kanal wie die Spiele (`tournament-<id>`). Ändert sich eine
 * Zeile (etwa ein anderes Gerät schließt eine Gruppe ab), lädt die App den Stand neu – die Zeilen selbst werden nicht
 * ausgewertet, die Quelle ist der frisch gelesene Stand.
 *
 * Wichtig (A-08f3b2): Eine Bindung auf eine Tabelle, die NICHT in der Publikation `supabase_realtime` steht, lässt den Server
 * den GANZEN Kanal ablehnen. Deshalb darf diese App erst nach `_006` ausgeliefert werden (PR hängt am DB-Fenster).
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { RealtimeServerTable } from './types';

/** Tabellen, deren Änderungen die Turnierverwaltung neu laden lassen. */
export const SERVER_TABLES: readonly RealtimeServerTable[] = ['group_completions', 'bracket_notices', 'clarifications'];

export function bindServerTables(
  channel: RealtimeChannel,
  tournamentId: string,
  onChange: ((table: RealtimeServerTable, raw: { eventType: string; new: unknown; old: unknown }) => void) | undefined,
): void {
  if (!onChange) {
    return;
  }
  for (const table of SERVER_TABLES) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `tournament_id=eq.${tournamentId}` },
      (payload) => { onChange(table, payload); },
    );
  }
}
