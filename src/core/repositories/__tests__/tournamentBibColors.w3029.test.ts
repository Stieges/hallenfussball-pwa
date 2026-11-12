/**
 * @W3-029 @W3-041 Leibchenfarben des Turniers (bis zu zwei) und die Regel „Bei gleicher Farbe zieht“ reisen im `tournaments.config`-JSON in die Cloud und
 * zurück; das alte einzelne `bibColor` gilt als erste Hallenfarbe. Testwerte aus dem Gherkin (2026-09-27_wizard-turniertag-vorbereiten.md).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { bibRuleOf, hallenFarbenOf } from '../../models/kit';
import type { Tournament } from '../../models/types';
import { createTournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';

const GELB = '#FFCC00';
const ORANGE = '#FF6600';

const hallencup = (extra: Partial<Tournament>): Tournament => ({ ...mapTournamentFromSupabase(createTournamentRow({ id: testUuid(901) }), [], []), ...extra });
const rundreise = (t: Tournament): Tournament => {
  const { tournamentRow } = mapTournamentToSupabase(t, 'owner-1');
  return mapTournamentFromSupabase({ ...createTournamentRow({ id: t.id }), config: tournamentRow.config ?? null }, [], []);
};
const ausConfig = (config: object): Tournament => mapTournamentFromSupabase({ ...createTournamentRow({ id: testUuid(902) }), config }, [], []);

describe('@W3-029 Hallenfarben im config-JSON', () => {
  it('@W3-029 Gelb und Orange gespeichert → geladen: beide in der Reihenfolge der Eintragung, bibColor = erste', () => {
    const geladen = rundreise(hallencup({ bibColors: [GELB, ORANGE] }));
    expect(geladen.bibColors).toEqual([GELB, ORANGE]);
    expect(geladen.bibColor).toBe(GELB);
    expect(hallenFarbenOf(geladen)).toEqual([GELB, ORANGE]);
  });

  it('@W3-029 Orange zuerst: die Reihenfolge bleibt (erste Farbe = erste Wahl)', () => {
    expect(rundreise(hallencup({ bibColors: [ORANGE, GELB] })).bibColors).toEqual([ORANGE, GELB]);
  });

  it('@W3-029 höchstens zwei, nichts doppelt, Ungültiges entfällt, Kleinschreibung wird normalisiert', () => {
    const geladen = ausConfig({ bibColors: ['#ffcc00', '#FFCC00', 'orange', '#ff6600', '#009933'] });
    expect(geladen.bibColors).toEqual([GELB, ORANGE]);
  });

  it('@W3-029 das alte einzelne bibColor gilt als erste Hallenfarbe', () => {
    const geladen = ausConfig({ bibColor: ORANGE });
    expect(hallenFarbenOf(geladen)).toEqual([ORANGE]);
    expect(rundreise(geladen).bibColors).toEqual([ORANGE]);
  });

  it('@W3-029 Gegenbeispiel: ohne Einstellung keine Hallenfarbe (der Vorschlag nimmt Gelb) und kein Schlüssel in der Cloud', () => {
    const t = rundreise(hallencup({}));
    expect(t.bibColors).toBeUndefined();
    expect(hallenFarbenOf(t)).toEqual([]);
  });
});

describe('@W3-041 Regel „Bei gleicher Farbe zieht“', () => {
  it('@W3-041 Gast gespeichert → geladen: Gast; Gegenbeispiel: ohne Eintrag oder mit Unsinn gilt Heim', () => {
    expect(rundreise(hallencup({ bibRule: 'away' })).bibRule).toBe('away');
    expect(bibRuleOf(rundreise(hallencup({})))).toBe('home');
    expect(bibRuleOf(ausConfig({ bibRule: 'mitte' }))).toBe('home');
  });
});
