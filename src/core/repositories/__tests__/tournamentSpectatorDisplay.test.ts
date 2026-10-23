/**
 * Aufgabe 2.1 (Spielanzeige): Einstellung „Anzeige für Zuschauer“ im `tournaments.config`-JSONB (@ZM-152, @ZM-153, RF1).
 * Gherkin: docs/anforderungen/2026-10-02_zuschauer-und-monitor.md (@ZM-152 Vorbelegung, @ZM-153 Hinweis, speichern geht).
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import type { Tournament } from '../../models/types';
import { createTeamRow, createTournamentRow } from '../../../../tests/factories/supabase';
import { testUuid } from '../../../test/testIds';
import {
  DEFAULT_SPECTATOR_DISPLAY,
  parseSpectatorDisplay,
  standardColorsTooSimilar,
  type SpectatorDisplaySettings,
} from '../../models/spectatorDisplay';
import { spectatorDisplayFromConfig, spectatorDisplayToConfig } from '../tournamentSpectatorDisplay';
import { palette } from '../../../design-tokens/colors/palette';

const BLAU = palette.kit.blue;
const ROT = palette.kit.red;
const NAVY = palette.kit.navy;

describe('@ZM-152 Vorbelegung der Anzeige für Zuschauer', () => {
  it('@ZM-152 ohne Eintrag in config: Teamfarben an, Heim Blau #1565C0, Gast Rot #C62828', () => {
    const read = spectatorDisplayFromConfig({ bibColor: '#FFCC00' });
    expect(read).toEqual({});
    expect(parseSpectatorDisplay(read.spectatorDisplay)).toEqual({ teamColors: true, homeColor: BLAU, awayColor: ROT });
  });

  it('@ZM-152 Gegenbeispiel: eine gespeicherte Einstellung überstimmt die Vorbelegung', () => {
    const stored = { teamColors: false, homeColor: NAVY, awayColor: ROT };
    expect(spectatorDisplayFromConfig({ spectatorDisplay: stored })).toEqual({ spectatorDisplay: stored });
  });

  it('@ZM-152 Hin- und Rückweg über config verliert nichts', () => {
    const settings: SpectatorDisplaySettings = { teamColors: false, homeColor: NAVY, awayColor: palette.neutral[0] };
    const config = { ...spectatorDisplayToConfig({ spectatorDisplay: settings }) };
    expect(config).toEqual({ spectatorDisplay: settings });
    expect(spectatorDisplayFromConfig(JSON.parse(JSON.stringify(config)) as object)).toEqual({ spectatorDisplay: settings });
  });

  it('@ZM-152 ohne Einstellung schreibt der Rückweg nichts in config', () => {
    expect(spectatorDisplayToConfig({})).toEqual({});
  });
});

/** Speichern (Mapper → Zeile) und aus der Cloud laden (Zeile → Mapper), wie ein zweites Gerät. */
function rundreise(spectatorDisplay?: SpectatorDisplaySettings): Tournament {
  const base = mapTournamentFromSupabase(createTournamentRow({ id: testUuid(900) }), [], []);
  const t: Tournament = { ...base, bibColor: '#FF6600', ...(spectatorDisplay === undefined ? {} : { spectatorDisplay }) };
  const { tournamentRow } = mapTournamentToSupabase(t, 'owner-1');
  return mapTournamentFromSupabase({ ...createTournamentRow({ id: t.id }), config: tournamentRow.config ?? null }, [], []);
}

/** K1: alle config-Felder zusammen über die JSON-Grenze (Teams als Zeilen, damit die Markierung nicht als verwaist fällt). */
const TEAM_A = testUuid(901);
const TEAM_B = testUuid(902);
const TEAM_ROWS = [
  createTeamRow({ id: TEAM_A, name: 'TSV Waging rot', sort_order: 0 }),
  createTeamRow({ id: TEAM_B, name: 'TSV Waging blau', sort_order: 1 }),
];

function rundreiseAlle(fields: Partial<Tournament>): Tournament {
  const base = mapTournamentFromSupabase(createTournamentRow({ id: testUuid(900) }), TEAM_ROWS, []);
  const { tournamentRow } = mapTournamentToSupabase({ ...base, ...fields }, 'owner-1');
  const wire = JSON.parse(JSON.stringify(tournamentRow)) as { config: unknown };
  return mapTournamentFromSupabase({ ...createTournamentRow({ id: base.id }), config: wire.config as never }, TEAM_ROWS, []);
}

describe('K1 config-Felder zusammen über die Cloud (Mapper)', () => {
  it('@ZM-152 spectatorDisplay, hostTeamIds, openingMode und bibColor überleben Hin- und Rückweg gemeinsam, keines verdrängt ein anderes', () => {
    const settings: SpectatorDisplaySettings = { teamColors: false, homeColor: NAVY, awayColor: ROT };
    const geladen = rundreiseAlle({ spectatorDisplay: settings, hostTeamIds: [TEAM_A, TEAM_B], openingMode: 'club-derby', bibColor: '#FF6600' });
    expect(geladen.spectatorDisplay).toEqual(settings);
    expect(geladen.hostTeamIds).toEqual([TEAM_A, TEAM_B]);
    expect(geladen.openingMode).toBe('club-derby');
    expect(geladen.bibColor).toBe('#FF6600');
  });

  it('K1 Gegenbeispiel: nur bibColor gesetzt, die übrigen drei Felder kommen nicht aus der Cloud zurück', () => {
    const geladen = rundreiseAlle({ bibColor: '#FF6600' });
    expect(geladen.bibColor).toBe('#FF6600');
    expect(geladen).not.toHaveProperty('spectatorDisplay');
    expect(geladen).not.toHaveProperty('hostTeamIds');
    expect(geladen).not.toHaveProperty('openingMode');
  });
});

describe('@ZM-152 Einstellung über die Cloud (Mapper)', () => {
  it('@ZM-152 Hin- und Rückweg über die Cloud-Zeile verliert nichts, die Leibchenfarbe daneben bleibt', () => {
    const settings: SpectatorDisplaySettings = { teamColors: false, homeColor: NAVY, awayColor: ROT };
    const geladen = rundreise(settings);
    expect(geladen.spectatorDisplay).toEqual(settings);
    expect(geladen.bibColor).toBe('#FF6600');
  });

  it('@ZM-152 Gegenbeispiel: ohne Einstellung kommt keine aus der Cloud zurück (Ansicht nimmt die Vorbelegung)', () => {
    expect(rundreise()).not.toHaveProperty('spectatorDisplay');
  });
});

describe('RF1 ungültige oder abweichend geschriebene Einstellung', () => {
  it('RF1 #fff und #1565c0 werden normalisiert, „blau“ fällt auf die Vorgabe zurück, teamColors "ja" → true', () => {
    expect(parseSpectatorDisplay({ teamColors: 'ja', homeColor: '#1565c0', awayColor: '#fff' })).toEqual({
      teamColors: true,
      homeColor: BLAU,
      awayColor: palette.neutral[0],
    });
    expect(parseSpectatorDisplay({ teamColors: false, homeColor: 'blau', awayColor: '' })).toEqual({
      teamColors: false,
      homeColor: DEFAULT_SPECTATOR_DISPLAY.homeColor,
      awayColor: DEFAULT_SPECTATOR_DISPLAY.awayColor,
    });
  });

  it('RF1 kein Objekt (Text, Zahl, null, Liste) → Vorbelegung, kein Absturz', () => {
    for (const raw of ['an', 7, null, [], undefined]) {
      expect(parseSpectatorDisplay(raw)).toEqual(DEFAULT_SPECTATOR_DISPLAY);
    }
  });

  it('RF1 config mit kaputtem Eintrag: Lesen liefert die je Schlüssel reparierte Einstellung', () => {
    expect(spectatorDisplayFromConfig({ spectatorDisplay: { homeColor: '#fff', extra: 1 } })).toEqual({
      spectatorDisplay: { teamColors: true, homeColor: palette.neutral[0], awayColor: ROT },
    });
  });

  it('RF1 Schreiben normalisiert ebenfalls (keine Kurzform, keine Kleinbuchstaben in config)', () => {
    const written = spectatorDisplayToConfig({ spectatorDisplay: { teamColors: true, homeColor: '#0d1b4c', awayColor: '#fff' } });
    expect(written).toEqual({ spectatorDisplay: { teamColors: true, homeColor: NAVY, awayColor: palette.neutral[0] } });
  });
});

describe('@ZM-153 zu ähnliche Standardfarben', () => {
  it('@ZM-153 Blau/Rot: kein Hinweis; Blau/Navy: Hinweis „zu ähnlich“', () => {
    expect(standardColorsTooSimilar({ teamColors: true, homeColor: BLAU, awayColor: ROT })).toBe(false);
    expect(standardColorsTooSimilar({ teamColors: true, homeColor: BLAU, awayColor: NAVY })).toBe(true);
  });

  it('RF2 Blau/Blau: Hinweis, gespeichert wird trotzdem unverändert', () => {
    const same: SpectatorDisplaySettings = { teamColors: false, homeColor: BLAU, awayColor: BLAU };
    expect(standardColorsTooSimilar(same)).toBe(true);
    expect(spectatorDisplayToConfig({ spectatorDisplay: same })).toEqual({ spectatorDisplay: same });
  });
});
