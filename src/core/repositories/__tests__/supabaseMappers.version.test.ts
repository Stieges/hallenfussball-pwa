/**
 * BP-1 – Befund C-TURNIER-VERSION-NULL (Regel „nichts still überschreiben“, `plattform/2026-09-24_fundament-gemeinsamer-stand`).
 *
 * `tournaments.version` ist in der Datenbank nullable. Der Schreib-Mapper schrieb `?? null`, so entstanden (z. B. über die
 * Saat) Zeilen ohne Version – auf ihnen haben `save()` und `updateMatches` ohne Basis keinen Konfliktschutz. Ab jetzt
 * schreibt der Mapper ohne Version die Startversion 1. Backfill und `SET NOT NULL` gehören ins DB-Fenster (Daniel).
 */
import { describe, it, expect } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { createTournamentRow } from '../../../../tests/factories/supabase';

describe('supabaseMappers — Turnier-Version nie NULL (Befund C-TURNIER-VERSION-NULL)', () => {
  it('C-TURNIER-VERSION-NULL: Turnier ohne Version (neu, aus dem Assistenten oder der Saat) wird mit Version 1 geschrieben', () => {
    const neu = { ...mapTournamentFromSupabase(createTournamentRow({ version: null }), [], []), version: undefined };

    expect(mapTournamentToSupabase(neu, 'olli').tournamentRow.version).toBe(1);
  });

  it('C-TURNIER-VERSION-NULL Gegenbeispiel: eine vorhandene Version wird unverändert geschrieben', () => {
    const vorhanden = mapTournamentFromSupabase(createTournamentRow({ version: 7 }), [], []);

    expect(mapTournamentToSupabase(vorhanden, 'olli').tournamentRow.version).toBe(7);
  });
});
