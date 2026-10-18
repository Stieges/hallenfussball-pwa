/**
 * A-30a Fixrunde 1 (Review B2, @W3-029): die Leibchenfarbe des Turniers reist im `tournaments.config`-JSON in die
 * Cloud und zurück. Sonst belegt ein anderes Gerät beim Anpfiff Gelb vor statt der eingestellten Farbe.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { DEFAULT_BIB_COLOR, defaultKit } from '../../models/kit';
import { teamSlot } from '../../models/matchSlot';
import type { Tournament } from '../../models/types';
import { createTournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const SV_SUED = testUuid(1);
const FC_NORD = testUuid(2);
const ROT = '#C62828';
const ORANGE = '#FF6600';

function hallencup(bibColor?: string): Tournament {
  const base = mapTournamentFromSupabase(createTournamentRow({ id: testUuid(900) }), [], []);
  return { ...base, ...(bibColor !== undefined ? { bibColor } : {}) };
}

/** Speichern (Mapper → Zeile) und aus der Cloud laden (Zeile → Mapper), wie ein zweites Gerät. */
function rundreise(t: Tournament): Tournament {
  const { tournamentRow } = mapTournamentToSupabase(t, 'owner-1');
  return mapTournamentFromSupabase({ ...createTournamentRow({ id: t.id }), config: tournamentRow.config ?? null }, [], []);
}

const teams = [
  { id: SV_SUED, name: 'SV Süd', colors: { primary: ROT } },
  { id: FC_NORD, name: 'FC Nord', colors: { primary: ROT } },
];
const spiel12 = { slotA: teamSlot(SV_SUED), slotB: teamSlot(FC_NORD) };

describe('A-30a @W3-029 Leibchenfarbe über die Cloud', () => {
  it('@W3-029 Orange gespeichert → aus der Cloud geladen → Orange in jedem Spiel vorbelegt', () => {
    const geladen = rundreise(hallencup(ORANGE));
    expect(geladen.bibColor).toBe(ORANGE);
    expect(defaultKit(spiel12, teams, geladen)).toEqual({ a: ORANGE, b: ROT, bibSide: 'a' });
  });

  it('@W3-029 Kleinschreibung wird beim Speichern normalisiert', () => {
    expect(rundreise(hallencup('#ff6600')).bibColor).toBe(ORANGE);
  });

  it('@W3-029 Gegenbeispiel: ohne Einstellung ist nach dem Laden Gelb vorbelegt', () => {
    const geladen = rundreise(hallencup());
    expect(geladen).not.toHaveProperty('bibColor');
    expect(defaultKit(spiel12, teams, geladen).a).toBe(DEFAULT_BIB_COLOR);
  });

  it('@W3-029 Gegenbeispiel: ungültiger Wert in der Cloud wird weggelassen (Vorgabe Gelb)', () => {
    const geladen = mapTournamentFromSupabase({ ...createTournamentRow({ id: testUuid(900) }), config: { bibColor: 'orange' } }, [], []);
    expect(geladen).not.toHaveProperty('bibColor');
    expect(defaultKit(spiel12, teams, geladen).a).toBe(DEFAULT_BIB_COLOR);
  });
});
