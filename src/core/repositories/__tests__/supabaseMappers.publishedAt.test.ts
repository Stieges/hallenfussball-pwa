/**
 * Task 3 — `publishedAt` als Freigabe-Marker.
 *
 * `publishedAt` reist im `config`-JSONB mit (keine eigene DB-Spalte). Der Round-Trip wird
 * bewusst über eine echte JSON-Grenze (JSON.parse(JSON.stringify(...))) geführt: ein Test,
 * der dieselbe Objektreferenz durch beide Mapper schickt, beweist nichts — dieser Fehler ist
 * in diesem Projekt schon einmal ausgeliefert worden.
 */
import { describe, it, expect } from 'vitest';
import {
  mapTournamentFromSupabase,
  mapTournamentToSupabase,
} from '../supabaseMappers';
import {
  createTournamentRow,
  type TournamentRow,
} from '../../../../tests/factories/supabase';

const RELEASE_ISO = '2026-02-01T10:00:00.000Z';

describe('supabaseMappers — publishedAt', () => {
  it('liest publishedAt aus config', () => {
    const row = createTournamentRow({ config: { publishedAt: RELEASE_ISO } });

    expect(mapTournamentFromSupabase(row, [], []).publishedAt).toBe(RELEASE_ISO);
  });

  it('Round-Trip über eine echte JSON-Grenze erhält publishedAt', () => {
    const tournament = mapTournamentFromSupabase(
      createTournamentRow({ config: { publishedAt: RELEASE_ISO } }),
      [],
      []
    );

    const { tournamentRow } = mapTournamentToSupabase(tournament, 'user-1');
    // Echte Serialisierung: genau das, was der Supabase-Client über die Leitung schickt.
    const wire = JSON.parse(JSON.stringify(tournamentRow)) as Pick<TournamentRow, 'config'>;

    const roundTripped = mapTournamentFromSupabase(
      createTournamentRow({ config: wire.config, status: 'draft' }),
      [],
      []
    );

    expect(roundTripped.publishedAt).toBe(RELEASE_ISO);
  });

  it('Backfill: status "published" ohne config.publishedAt erbt created_at', () => {
    const row = createTournamentRow({
      status: 'published',
      config: {},
      created_at: '2025-11-03T08:30:00Z',
    });

    expect(mapTournamentFromSupabase(row, [], []).publishedAt).toBe('2025-11-03T08:30:00Z');
  });

  it('Backfill greift nicht bei einem echten Entwurf', () => {
    const row = createTournamentRow({ status: 'draft', config: {} });

    expect(mapTournamentFromSupabase(row, [], []).publishedAt).toBeUndefined();
  });

  // Fix 1 (Review 2026-09-21): is_public/share_code beweisen NICHTS über eine vergangene
  // Freigabe — beide waren unter dem alten Code der DEFAULT für jedes neu angelegte Turnier
  // (createDraft() setzte isPublic:true, die Sichtbarkeits-Seite generierte beim Mounten
  // automatisch einen share_code). Ein Bestandsentwurf von vor diesem Branch trägt die
  // Altwerte noch, ohne je freigegeben worden zu sein. Der frühere (breitere) Backfill hätte
  // ihn hier fälschlich als "released" markiert — sobald irgendein Save läuft, wird das
  // fabrizierte publishedAt persistiert und der Entwurf ist irreversibel "freigegeben".
  it('Backfill greift NICHT bei status "draft" mit is_public=true (alter Default, kein Freigabe-Beleg)', () => {
    const row = createTournamentRow({
      status: 'draft',
      is_public: true,
      config: {},
      created_at: '2025-11-03T08:30:00Z',
    });

    expect(mapTournamentFromSupabase(row, [], []).publishedAt).toBeUndefined();
  });

  it('Backfill greift NICHT bei status "draft" mit share_code (alter Default, kein Freigabe-Beleg)', () => {
    const row = createTournamentRow({
      status: 'draft',
      share_code: 'ABC123',
      config: {},
      created_at: '2025-11-03T08:30:00Z',
    });

    expect(mapTournamentFromSupabase(row, [], []).publishedAt).toBeUndefined();
  });

  it('Backfill greift NICHT bei status "draft" ohne is_public und ohne share_code (echter Entwurf)', () => {
    const row = createTournamentRow({
      status: 'draft',
      is_public: false,
      share_code: null,
      config: {},
    });

    expect(mapTournamentFromSupabase(row, [], []).publishedAt).toBeUndefined();
  });

  it('config.publishedAt schlägt den Backfill', () => {
    const row = createTournamentRow({
      status: 'published',
      config: { publishedAt: RELEASE_ISO },
      created_at: '2025-11-03T08:30:00Z',
    });

    expect(mapTournamentFromSupabase(row, [], []).publishedAt).toBe(RELEASE_ISO);
  });
});
