/**
 * w1 — `rulebook` reist durch den config-JSONB-Mapper hin und zurück.
 *
 * @DR-016 Das Regelwerk bleibt über das Speichern und Neuladen erhalten.
 * @DR-006 Der Spielplan-Kopf liest genau dieses Feld.
 *
 * Der Round-Trip läuft über eine echte JSON-Grenze (wie der Supabase-Client es sendet).
 */
import { describe, it, expect } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { createTournamentRow, type TournamentRow } from '../../../../tests/factories/supabase';

function wireRoundTrip(rulebook: string | undefined) {
  const base = mapTournamentFromSupabase(createTournamentRow({ config: {} }), [], []);
  const tournament = { ...base, rulebook };
  const { tournamentRow } = mapTournamentToSupabase(tournament, 'user-1');
  const wire = JSON.parse(JSON.stringify(tournamentRow)) as Pick<TournamentRow, 'config'>;
  return mapTournamentFromSupabase(createTournamentRow({ config: wire.config }), [], []);
}

describe('supabaseMappers — rulebook', () => {
  it('@DR-016 Rundlauf speichern → laden: gleicher Text', () => {
    const text = 'BFV-Richtlinien für Futsal und private Hallenturniere';

    expect(wireRoundTrip(text).rulebook).toBe(text);
  });

  it('@DR-007 Gegenbeispiel: ohne Regelwerk bleibt rulebook undefined (nicht "")', () => {
    expect(wireRoundTrip(undefined).rulebook).toBeUndefined();
  });
});
