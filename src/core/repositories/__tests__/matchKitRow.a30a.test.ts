/**
 * A-30a Schritt 3 (@W3-028, @ZM-140): die Spalten `kit_color_a/kit_color_b/bib_side` (Migration
 * 20261028_004_match_kit_colors.sql) schreibt nur der Server beim Anpfiff. Der Mapper LIEST sie nach
 * `Match.kit` und SENDET sie nie (weder Insert noch Update) – sonst schlägt der Schutz an (HF003).
 * Fehlerpolitik: ungültige Farbe aus der Cloud → „keine Farbe“, einmal melden.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureFeatureError = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/sentry', () => ({ captureFeatureError }));

import {
  mapMatchFromSupabase,
  mapMatchToScheduleUpdate,
  mapMatchToSupabase,
  mapMatchUpdateToSupabase,
} from '../supabaseMappers';
import { KIT_COLUMNS_SERVER_ONLY_CODE, RepositoryError, isTransientMutationError } from '../../errors';
import { teamSlot } from '../../models/matchSlot';
import { MatchSchema } from '../../models/schemas/TournamentSchema';
import { wornColors } from '../../models/kit';
import type { Match } from '../../models/types';
import { createMatchRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const NORD = testUuid(1);
const SUED = testUuid(2);
type Row = Parameters<typeof mapMatchFromSupabase>[0];

function row(kit: Record<string, unknown>): Row {
  return { ...createMatchRow({ id: testUuid(301), team_a_id: NORD, team_b_id: SUED }), ...kit };
}

function match(overrides: Partial<Match> = {}): Match {
  return { id: testUuid(301), round: 1, field: 1, slotA: teamSlot(NORD), slotB: teamSlot(SUED), ...overrides };
}

const KIT_KEYS = ['kit_color_a', 'kit_color_b', 'bib_side'];

beforeEach(() => {
  captureFeatureError.mockClear();
});

describe('A-30a Mapper liest die getragenen Farben', () => {
  it('@ZM-140 Spalten → Match.kit (Leibchen Gelb für die Heimseite)', () => {
    const mapped = mapMatchFromSupabase(row({ kit_color_a: '#FFCC00', kit_color_b: '#C62828', bib_side: 'a' }));
    expect(mapped.kit).toEqual({ a: '#FFCC00', b: '#C62828', bibSide: 'a' });
    expect(captureFeatureError).not.toHaveBeenCalled();
  });

  it('@W3-028 alle drei Spalten NULL → kein kit am Spiel', () => {
    const mapped = mapMatchFromSupabase(row({ kit_color_a: null, kit_color_b: null, bib_side: null }));
    expect(mapped).not.toHaveProperty('kit');
  });

  it('@ZM-140 eine Seite ohne Farbe bleibt ohne Farbe (Anzeige: Vorgabe)', () => {
    expect(mapMatchFromSupabase(row({ kit_color_a: null, kit_color_b: '#000000', bib_side: null })).kit).toEqual({ b: '#000000' });
  });

  it('@ZM-140 Fehlerpolitik: ungültige Farbe aus der Cloud → Seite ohne Farbe, genau eine Meldung', () => {
    const mapped = mapMatchFromSupabase(row({ kit_color_a: 'gelb', kit_color_b: '#C62828', bib_side: 'x' }));
    expect(mapped.kit).toEqual({ b: '#C62828' });
    expect(captureFeatureError).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: Zeile ohne die neuen Spalten (vor dem Einspielen) bleibt lesbar, ohne kit', () => {
    const mapped = mapMatchFromSupabase(createMatchRow({ id: testUuid(301), team_a_id: NORD, team_b_id: SUED }));
    expect(mapped).not.toHaveProperty('kit');
    expect(captureFeatureError).not.toHaveBeenCalled();
  });
});

describe('A-30a Fixrunde 1 (Review B1): Spiel in der Halbzeit aus der Cloud', () => {
  it('@W3-028 ein Spiel in der Halbzeit (Cloud paused) behält die Farbe, mit der es angepfiffen wurde', () => {
    const mapped = mapMatchFromSupabase(row({ match_status: 'paused', kit_color_a: '#000000', kit_color_b: '#FFFFFF', bib_side: null }));
    const rot = [{ id: NORD, name: 'FC Nord', colors: { primary: '#C62828' } }, { id: SUED, name: 'SV Süd', colors: { primary: '#C62828' } }];
    expect(wornColors(mapped, rot)).toEqual({ a: '#000000', b: '#FFFFFF' });
  });
});

describe('A-30a Mapper sendet die getragenen Farben nie', () => {
  const withKit = match({ kit: { a: '#FFCC00', b: '#C62828', bibSide: 'a' } });

  it('@W3-028 Insert (mapMatchToSupabase) enthält keine kit-Spalte', () => {
    const insert = mapMatchToSupabase(withKit, 'tournament-1');
    for (const key of KIT_KEYS) {
      expect(insert).not.toHaveProperty(key);
    }
  });

  it('@W3-028 Spielplan-Update (mapMatchToScheduleUpdate) enthält keine kit-Spalte', () => {
    const update = mapMatchToScheduleUpdate(mapMatchToSupabase(withKit, 'tournament-1'));
    for (const key of KIT_KEYS) {
      expect(update).not.toHaveProperty(key);
    }
  });

  it('@W3-028 Einzel-Update (mapMatchUpdateToSupabase) enthält keine kit-Spalte, auch wenn kit mitkommt', () => {
    const update = mapMatchUpdateToSupabase({ id: withKit.id, kit: withKit.kit, slotA: withKit.slotA });
    for (const key of KIT_KEYS) {
      expect(update).not.toHaveProperty(key);
    }
  });
});

describe('A-30a lokale Kopie behält die getragenen Farben (MatchSchema)', () => {
  it('@W3-028 kit übersteht das Laden der lokalen Kopie', () => {
    const parsed = MatchSchema.safeParse({ ...match(), matchStatus: 'running', kit: { a: '#000000', bibSide: 'b', b: '#FFCC00' } });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.kit).toEqual({ a: '#000000', b: '#FFCC00', bibSide: 'b' });
  });

  it('Gegenbeispiel: ein Spiel ohne kit bleibt gültig', () => {
    const parsed = MatchSchema.safeParse(match());
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).not.toHaveProperty('kit');
  });
});

describe('A-30a Fehlercode HF003 (getragene Farbe nur vom Anpfiff) ist nicht transient', () => {
  it('Fehlercode-Liste: HF003 = getragene Farbe', () => {
    expect(KIT_COLUMNS_SERVER_ONLY_CODE).toBe('HF003');
  });

  it('@W3-028 HF003 aus der Cloud wird nicht wiederholt – auch eingewickelt und mit netzähnlicher Meldung', () => {
    const postgrest = { message: 'Failed to fetch: Getragene Farben setzt nur der Anpfiff (Spiel m1)', code: 'HF003' };
    expect(isTransientMutationError(postgrest)).toBe(false);
    expect(isTransientMutationError(new RepositoryError('updateMatches', 'Fehler', [postgrest]))).toBe(false);
  });

  it('Gegenbeispiel: ein echter Netzfehler bleibt transient', () => {
    expect(isTransientMutationError(new TypeError('Failed to fetch'))).toBe(true);
  });
});
