/**
 * R3-1: der Turnier-Zustand kommt vom Server (@LZ-001, @LZ-006). Der Lese-Mapper gibt `lifecycle_status` und `finished_at`
 * weiter; der Schreib-Mapper schreibt weder den Zustand (nur der Server) noch die Alt-Haken (manuallyCompleted,
 * completedAt/completed_at, dashboardStatus, statsSnapshot).
 */
import { describe, it, expect } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { createTournamentRow } from '../../../../tests/factories/supabase';
import { createMockTournament } from '../../../test/factories';

describe('@LZ-001 Lese-Mapper: Zustand aus der Server-Zeile', () => {
  it.each(['draft', 'fixed', 'finished', 'cancelled'] as const)('lifecycle_status %s kommt als lifecycleStatus an', (zustand) => {
    expect(mapTournamentFromSupabase(createTournamentRow({ lifecycle_status: zustand }), [], []).lifecycleStatus).toBe(zustand);
  });

  it('finished_at kommt als finishedAt an; leer bleibt leer', () => {
    expect(mapTournamentFromSupabase(createTournamentRow({ lifecycle_status: 'finished', finished_at: '2026-10-23T10:00:00Z' }), [], []).finishedAt).toBe('2026-10-23T10:00:00Z');
    expect(mapTournamentFromSupabase(createTournamentRow({ lifecycle_status: 'fixed', finished_at: null }), [], []).finishedAt).toBeUndefined();
  });

  it('Gegenbeispiel: ein unbekannter Wert (Altbestand, Fremdwert) wird nicht übernommen', () => {
    expect(mapTournamentFromSupabase(createTournamentRow({ lifecycle_status: 'completed' }), [], []).lifecycleStatus).toBeUndefined();
  });

  it('@LZ-006 Gegenbeispiel: die Alt-Haken in der Konfiguration (und completed_at) werden nicht gelesen', () => {
    const t = mapTournamentFromSupabase(createTournamentRow({
      lifecycle_status: 'fixed', completed_at: '2026-10-01T00:00:00Z',
      config: { manuallyCompleted: true, dashboardStatus: 'finished', statsSnapshot: { teamCount: 4 } },
    }), [], []) as unknown as Record<string, unknown>;
    expect(t.manuallyCompleted).toBeUndefined();
    expect(t.completedAt).toBeUndefined();
    expect(t.dashboardStatus).toBeUndefined();
    expect(t.statsSnapshot).toBeUndefined();
  });
});

describe('Schreib-Mapper: Zustand gehört dem Server, Alt-Haken werden nicht mehr geschrieben', () => {
  const mitAltHaken = {
    ...createMockTournament({ id: 'abc', status: 'published' }),
    lifecycleStatus: 'finished', finishedAt: '2026-10-23T10:00:00Z', anyMatchStarted: true,
    manuallyCompleted: true, completedAt: '2026-10-01T00:00:00Z', dashboardStatus: 'finished', statsSnapshot: { teamCount: 4 },
  } as unknown as Parameters<typeof mapTournamentToSupabase>[0];

  it('die Zeile trägt weder lifecycle_status noch finished_at noch completed_at', () => {
    const { tournamentRow } = mapTournamentToSupabase(mitAltHaken, 'owner-1');
    const row = tournamentRow as unknown as Record<string, unknown>;
    expect('lifecycle_status' in row).toBe(false);
    expect('finished_at' in row).toBe(false);
    expect('completed_at' in row).toBe(false);
  });

  it('die Konfiguration trägt weder Zustand noch Alt-Haken noch die Listen-Markierung', () => {
    const config = mapTournamentToSupabase(mitAltHaken, 'owner-1').tournamentRow.config as Record<string, unknown>;
    for (const key of ['manuallyCompleted', 'dashboardStatus', 'statsSnapshot', 'completedAt', 'lifecycleStatus', 'finishedAt', 'anyMatchStarted']) {
      expect(key in config, key).toBe(false);
    }
  });
});
