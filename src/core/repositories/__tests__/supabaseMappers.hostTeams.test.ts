/**
 * Markierung des Veranstalters und Eröffnungswahl reisen im `config`-JSONB (keine Migration).
 * Record docs/anforderungen/2026-09-27_wizard-zeitrahmen-fairness.md: @W4-034 (über die Cloud übertragbar),
 * @W4-044 (verwaiste IDs werden ignoriert und beim Speichern entfernt).
 * Round-Trip über eine echte JSON-Grenze, wie supabaseMappers.publishedAt.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { createTeamRow, createTournamentRow, type TournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const ROT = testUuid(1);
const BLAU = testUuid(2);
const GAST = testUuid(3);
const teamRows = [
  createTeamRow({ id: ROT, name: 'TSV Waging rot', sort_order: 0 }),
  createTeamRow({ id: BLAU, name: 'TSV Waging blau', sort_order: 1 }),
  createTeamRow({ id: GAST, name: 'Gast', sort_order: 2 }),
];

function roundTrip(config: TournamentRow['config'], rows = teamRows): ReturnType<typeof mapTournamentFromSupabase> {
  const tournament = mapTournamentFromSupabase(createTournamentRow({ config }), rows, []);
  const { tournamentRow } = mapTournamentToSupabase(tournament, 'user-1');
  const wire = JSON.parse(JSON.stringify(tournamentRow)) as Pick<TournamentRow, 'config'>;
  return mapTournamentFromSupabase(createTournamentRow({ config: wire.config }), rows, []);
}

describe('supabaseMappers — hostTeamIds und openingMode (@W4-034, @W4-044)', () => {
  it('hostTeamIds und openingMode überleben Hin- und Rückweg', () => {
    const back = roundTrip({ hostTeamIds: [ROT, BLAU], openingMode: 'club-derby' });

    expect(back.hostTeamIds).toEqual([ROT, BLAU]);
    expect(back.openingMode).toBe('club-derby');
  });

  it('ohne Markierung bleibt das Feld leer (kein erfundener Wert)', () => {
    const back = roundTrip({});

    expect(back.hostTeamIds).toBeUndefined();
    expect(back.openingMode).toBeUndefined();
  });

  it('eine verwaiste ID (Team gelöscht) wird beim Lesen ignoriert', () => {
    const read = mapTournamentFromSupabase(createTournamentRow({ config: { hostTeamIds: [ROT, testUuid(99)] } }), teamRows, []);

    expect(read.hostTeamIds).toEqual([ROT]);
  });

  it('eine verwaiste ID wird beim Speichern entfernt', () => {
    const read = mapTournamentFromSupabase(createTournamentRow({ config: { hostTeamIds: [ROT, BLAU] } }), teamRows, []);
    const ohneBlau = { ...read, teams: read.teams.filter((t) => t.id !== BLAU) };
    const { tournamentRow } = mapTournamentToSupabase(ohneBlau, 'user-1');

    expect((tournamentRow.config as { hostTeamIds?: string[] }).hostTeamIds).toEqual([ROT]);
  });

  it('eine unbekannte Eröffnungswahl wird nicht übernommen', () => {
    const read = mapTournamentFromSupabase(createTournamentRow({ config: { openingMode: 'irgendwas' } }), teamRows, []);

    expect(read.openingMode).toBeUndefined();
  });
});
