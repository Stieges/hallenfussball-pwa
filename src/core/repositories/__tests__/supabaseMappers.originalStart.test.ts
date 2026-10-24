/**
 * B-26: `matches.original_start` (time, NULL = nie verschoben) kommt als `Match.originalStart` in die App und geht beim
 * Voll-Speichern als Zeitplan-Spalte zurück (Voraussetzung für „ursprünglich hh:mm“, @ZP-036, @ZP-037, @ZP-010).
 */
import { describe, it, expect } from 'vitest';
import { mapMatchFromSupabase, mapMatchToScheduleUpdate, mapMatchToSupabase } from '../supabaseMappers';
import { MatchSchema } from '../../models/schemas/TournamentSchema';
import { hydrateMatch } from '../hydration';
import { createMatchRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const [NORD, SUED] = [testUuid(1), testUuid(2)];
const row = (original_start: string | null) => createMatchRow({ team_a_id: NORD, team_b_id: SUED, scheduled_start: '15:40:00', original_start });

describe('original_start ↔ originalStart', () => {
  it('liest die ursprüngliche Uhrzeit am Turniertag', () => {
    expect(mapMatchFromSupabase(row('15:30:00'), '2026-11-14').originalStart).toEqual(new Date('2026-11-14T15:30:00'));
  });

  it('Gegenbeispiel: NULL heißt nie verschoben', () => {
    expect(mapMatchFromSupabase(row(null), '2026-11-14')).not.toHaveProperty('originalStart');
  });

  it('schreibt sie beim Anlegen und als Zeitplan-Spalte beim Voll-Speichern zurück', () => {
    const match = mapMatchFromSupabase(row('15:30:00'), '2026-11-14');
    const insert = mapMatchToSupabase(match, 'tournament-1');
    expect(insert.original_start).toBe('15:30:00');
    expect(mapMatchToScheduleUpdate(insert).original_start).toBe('15:30:00');
  });

  it('ohne ursprüngliche Uhrzeit schreibt das Speichern NULL (Wiederherstellen löscht den Bezug)', () => {
    const insert = mapMatchToSupabase(mapMatchFromSupabase(row(null), '2026-11-14'), 'tournament-1');
    expect(insert.original_start).toBeNull();
    expect(mapMatchToScheduleUpdate(insert).original_start).toBeNull();
  });

  it('übersteht das lokale Laden (JSON → Zod → Date)', () => {
    const match = { ...mapMatchFromSupabase(row('15:30:00'), '2026-11-14') };
    const json = JSON.parse(JSON.stringify(match)) as unknown;
    expect(hydrateMatch(json).originalStart).toEqual(new Date('2026-11-14T15:30:00'));
    const parsed = MatchSchema.parse(json);
    expect(parsed.originalStart).toEqual(new Date('2026-11-14T15:30:00'));
  });
});
