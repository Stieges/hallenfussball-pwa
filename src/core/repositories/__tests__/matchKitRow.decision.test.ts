/**
 * Leibchen Schritt 2a (@SL-220, Migration 20261124_002_leibchen_schritt2.sql): die Spalte `kit_decision` (NULL offen, none = Keine Leibchen,
 * bib = bestätigt) wird nach `Match.kitDecision` GELESEN und nie gesendet (Wächter matches_guard_kit_columns, HF003).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureFeatureError = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/sentry', () => ({ captureFeatureError }));

import { mapMatchFromSupabase, mapMatchToScheduleUpdate, mapMatchToSupabase, mapMatchUpdateToSupabase } from '../supabaseMappers';
import { teamSlot } from '../../models/matchSlot';
import { MatchSchema } from '../../models/schemas/TournamentSchema';
import type { Match } from '../../models/types';
import { createMatchRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const NORD = testUuid(1);
const SUED = testUuid(2);
type Row = Parameters<typeof mapMatchFromSupabase>[0];

function row(extra: Record<string, unknown>): Row {
  return { ...createMatchRow({ id: testUuid(301), team_a_id: NORD, team_b_id: SUED }), ...extra };
}

beforeEach(() => captureFeatureError.mockClear());

describe('@SL-220 Mapper liest den Zustand der Wahl', () => {
  it.each([
    ['bib', 'bib'],
    ['none', 'none'],
  ])('@SL-220 kit_decision %s → Match.kitDecision %s', (roh, erwartet) => {
    expect(mapMatchFromSupabase(row({ kit_decision: roh }), '2026-01-15').kitDecision).toBe(erwartet);
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('@SL-220 NULL = offen: das Spiel trägt kein kitDecision (nicht „none“)', () => {
    expect(mapMatchFromSupabase(row({ kit_decision: null }), '2026-01-15')).not.toHaveProperty('kitDecision');
  });

  it('@SL-220 Gegenbeispiel: Zeile ohne die Spalte (vor dem Einspielen) bleibt lesbar, ohne Meldung', () => {
    const mapped = mapMatchFromSupabase(createMatchRow({ id: testUuid(301), team_a_id: NORD, team_b_id: SUED }), '2026-01-15');
    expect(mapped).not.toHaveProperty('kitDecision');
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('@SL-220 Fehlerpolitik: unbekannter Wert → offen, genau eine Meldung', () => {
    const mapped = mapMatchFromSupabase(row({ kit_decision: 'maybe' }), '2026-01-15');
    expect(mapped).not.toHaveProperty('kitDecision');
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
  });

  it('@SL-220 der Zustand ist unabhängig von den Farbspalten (bestätigt vor dem Anpfiff: nur die Leibchen-Seite hat eine Farbe)', () => {
    const mapped = mapMatchFromSupabase(row({ kit_decision: 'bib', bib_side: 'b', kit_color_a: null, kit_color_b: '#FF6600' }), '2026-01-15');
    expect(mapped.kitDecision).toBe('bib');
    expect(mapped.kit).toEqual({ b: '#FF6600', bibSide: 'b' });
  });
});

describe('@SL-220 Schreibwege senden kit_decision nie', () => {
  const match: Match = { id: testUuid(301), round: 1, field: 1, slotA: teamSlot(NORD), slotB: teamSlot(SUED), kitDecision: 'bib' };
  it('Anlegen, Ändern und Spielplan-Update tragen die Spalte nicht (sonst HF003)', () => {
    const insert = mapMatchToSupabase(match, 'tournament-1');
    expect(insert).not.toHaveProperty('kit_decision');
    expect(mapMatchUpdateToSupabase({ id: match.id, kitDecision: match.kitDecision, slotA: match.slotA })).not.toHaveProperty('kit_decision');
    expect(mapMatchToScheduleUpdate(insert)).not.toHaveProperty('kit_decision');
  });

  it('übersteht das lokale Laden: das Schema kennt kitDecision und lehnt Fremdwerte ab', () => {
    expect(MatchSchema.safeParse({ ...match }).success).toBe(true);
    expect(MatchSchema.safeParse({ ...match, kitDecision: 'maybe' }).success).toBe(false);
  });
});
