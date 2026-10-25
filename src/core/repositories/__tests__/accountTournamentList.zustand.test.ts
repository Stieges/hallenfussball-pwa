/**
 * R3-1 (@LZ-001, @LZ-006, Befund C-STARTSEITE-OHNE-ANPFIFF-CLOUD): die Startseiten-Liste aus der Cloud kennt den gespeicherten
 * Zustand und – mit EINER Zusatzabfrage – welche festgelegten Turniere ein angepfiffenes Spiel haben („Läuft“).
 */
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readAccountTournamentList } from '../accountTournamentList';
import { lifecycleOf } from '../../services/lifecycle';
import { createTournamentRow } from '../../../../tests/factories/supabase';

const OLLI = 'olli';
type Row = ReturnType<typeof createTournamentRow>;

/** Minimaler Fake-Client: eigene Turniere, keine Mitgliedschaften, `matches` mit Spielstand je Turnier. */
function fakeClient(tournaments: Row[], startedIds: string[], matchesError = false) {
  const matchQuery = vi.fn();
  const client = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: OLLI, is_anonymous: false } } }) },
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      const result = () => {
        if (table === 'tournaments') { return { data: tournaments, error: null }; }
        if (table === 'tournament_collaborators') { return { data: [], error: null }; }
        if (matchesError) { return { data: null, error: { message: 'boom' } }; }
        return { data: startedIds.map((id) => ({ tournament_id: id })), error: null };
      };
      for (const m of ['select', 'eq', 'not', 'is', 'order']) { builder[m] = () => builder; }
      builder.in = (...args: unknown[]) => { if (table === 'matches') { matchQuery(...args); } return builder; };
      builder.then = (resolve: (r: unknown) => unknown) => resolve(result());
      return builder;
    },
  } as unknown as SupabaseClient;
  return { client, matchQuery };
}

const zeile = (id: string, zustand: string) => createTournamentRow({ id, owner_id: OLLI, status: zustand === 'draft' ? 'draft' : 'published', lifecycle_status: zustand });

describe('Startseiten-Liste aus der Cloud: Zustand und „angepfiffen“', () => {
  it('@LZ-001 der gespeicherte Zustand kommt mit; ein festgelegtes Turnier mit angepfiffenem Spiel ist „Läuft“, die anderen nicht', async () => {
    const { client } = fakeClient([zeile('fest', 'fixed'), zeile('laeuft', 'fixed'), zeile('fertig', 'finished'), zeile('entwurf', 'draft')], ['laeuft']);
    const list = await readAccountTournamentList(client);
    const zustand = Object.fromEntries(list.tournaments.map((t) => [t.id, lifecycleOf(t)]));
    expect(zustand).toEqual({ fest: 'fixed', laeuft: 'running', fertig: 'finished', entwurf: 'draft' });
    expect(list.startedError).toBeUndefined();
  });

  it('@LZ-006 Gegenbeispiel: ein abgeschlossenes Turnier mit beendeten Spielen bleibt abgeschlossen, ein festgelegtes ohne Anpfiff bleibt festgelegt', async () => {
    const { client } = fakeClient([zeile('fertig', 'finished'), zeile('fest', 'fixed')], ['fertig']);
    const list = await readAccountTournamentList(client);
    expect(list.tournaments.map(lifecycleOf)).toEqual(['finished', 'fixed']);
  });

  it('eine einzige Zusatzabfrage je Liste, nur für festgelegte Turniere (Entwurf, Abgeschlossen brauchen sie nicht)', async () => {
    const { client, matchQuery } = fakeClient([zeile('a', 'fixed'), zeile('b', 'fixed'), zeile('c', 'finished'), zeile('d', 'draft')], []);
    await readAccountTournamentList(client);
    const nachSpalte = matchQuery.mock.calls.map((call) => call[0]);
    expect(nachSpalte).toEqual(['tournament_id', 'match_status']);
    expect(matchQuery.mock.calls[0][1]).toEqual(['a', 'b']);
  });

  it('Gegenbeispiel: ohne festgelegte Turniere keine Zusatzabfrage', async () => {
    const { client, matchQuery } = fakeClient([zeile('c', 'finished'), zeile('d', 'draft')], []);
    await readAccountTournamentList(client);
    expect(matchQuery).not.toHaveBeenCalled();
  });

  it('scheitert die Zusatzabfrage, bleibt die Liste stehen (Festgelegt), der Fehler wird gemeldet', async () => {
    const { client } = fakeClient([zeile('fest', 'fixed')], [], true);
    const list = await readAccountTournamentList(client);
    expect(list.tournaments.map(lifecycleOf)).toEqual(['fixed']);
    expect(list.startedError).toBeInstanceOf(Error);
  });
});
