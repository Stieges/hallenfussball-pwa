/**
 * @LZ-005 (Hinweis „Turnier läuft noch“ auf der Startseite): die Liste aus der Cloud trägt je laufendem Turnier das Ende des letzten
 * Spiels – aber nur, wenn jedes Spiel entschieden ist (beendet oder ausgefallen). Scheitert die Abfrage, fehlt nur der Hinweis.
 */
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAccountTournamentList } from '../accountTournamentList';
import { createTournamentRow } from '../../../../tests/factories/supabase';

const OLLI = 'olli';
interface MatchRow { tournament_id: string; match_status: string; actual_end: string | null }

function client(matches: MatchRow[], endsFail = false): SupabaseClient {
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: OLLI, is_anonymous: false } } }) },
    from: (table: string) => {
      let columns = '';
      const builder: Record<string, unknown> = {};
      for (const m of ['eq', 'not', 'is', 'order']) { builder[m] = () => builder; }
      builder.select = (c: string) => { columns = c; return builder; };
      builder.in = () => builder;
      builder.then = (resolve: (r: unknown) => unknown) => {
        if (table === 'tournaments') { return resolve({ data: [createTournamentRow({ id: 'lauf', owner_id: OLLI, status: 'published', lifecycle_status: 'fixed' })], error: null }); }
        if (table === 'tournament_collaborators') { return resolve({ data: [], error: null }); }
        if (columns.includes('actual_end')) { return resolve(endsFail ? { data: null, error: { message: 'x' } } : { data: matches, error: null }); }
        return resolve({ data: matches.filter((m) => m.match_status !== 'scheduled').map((m) => ({ tournament_id: m.tournament_id })), error: null });
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const spiel = (status: string, end: string | null): MatchRow => ({ tournament_id: 'lauf', match_status: status, actual_end: end });

describe('@LZ-005 Ende des letzten Spiels in der Startseiten-Liste', () => {
  it('alle Spiele entschieden: das späteste Ende steht an der Karte, das Turnier ist weiter „Läuft“', async () => {
    const list = await readAccountTournamentList(client([spiel('finished', '2026-10-12T15:00:00+00:00'), spiel('finished', '2026-10-12T16:00:00+00:00'), spiel('skipped', null)]));
    expect(list.tournaments[0].lastMatchEndedAt).toBe('2026-10-12T16:00:00+00:00');
    expect(list.tournaments[0].anyMatchStarted).toBe(true);
  });

  it('Gegenbeispiel: ein Spiel ist noch offen → kein Ende (es läuft ja wirklich noch)', async () => {
    const list = await readAccountTournamentList(client([spiel('finished', '2026-10-12T16:00:00+00:00'), spiel('scheduled', null)]));
    expect(list.tournaments[0].lastMatchEndedAt).toBeUndefined();
  });

  it('Gegenbeispiel: die Abfrage scheitert → Liste bleibt, nur ohne Ende', async () => {
    const list = await readAccountTournamentList(client([spiel('finished', '2026-10-12T16:00:00+00:00')], true));
    expect(list.tournaments).toHaveLength(1);
    expect(list.tournaments[0].anyMatchStarted).toBe(true);
    expect(list.tournaments[0].lastMatchEndedAt).toBeUndefined();
  });
});
