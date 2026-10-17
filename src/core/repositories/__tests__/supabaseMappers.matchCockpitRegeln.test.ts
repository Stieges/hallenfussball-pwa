/**
 * ZA-0 – Mapper-Rundlauf (lokal → Cloud → lokal) für die Regel-Felder „Spiel leiten“.
 *
 * Der Round-Trip läuft über eine echte JSON-Grenze (wie der Supabase-Client), damit
 * keine Objektreferenz den Fehler verdeckt. Werte aus den Gherkin-Szenarien
 * (@SL-002, @SL-024, @SL-101, @W2A-013, @W2A-017, @W2A-035, @W2A-037).
 */
import { describe, it, expect } from 'vitest';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { createTournamentRow, type TournamentRow } from '../../../../tests/factories/supabase';
import {
  DEFAULT_MATCH_COCKPIT_SETTINGS,
  type MatchCockpitSettings,
} from '../../../types/tournament';
import { TournamentCreationService } from '../../services/TournamentCreationService';
import type { ITournamentRepository } from '../ITournamentRepository';

const service = new TournamentCreationService({} as ITournamentRepository);

/** Regeln, die von den Vorgaben abweichen – jedes Feld ist anders als der Standard. */
const GEAENDERT: MatchCockpitSettings = {
  ...DEFAULT_MATCH_COCKPIT_SETTINGS,
  clockMode: 'immer-angehalten',
  foulLimit: null,
  enabledCards: { yellow: true, yellowRed: false, red: true, timePenalty: false },
  penaltyEndsOnGoal: false,
  shortHandedSeconds: 60,
};

/** Schickt ein Turnier durch lokal → Cloud → lokal, mit echter JSON-Grenze. */
function rundlauf(settings: MatchCockpitSettings | undefined) {
  const tournament = { ...service.createDraft({ title: 'Rundlauf' }), matchCockpitSettings: settings };
  const { tournamentRow } = mapTournamentToSupabase(tournament, 'user-1');
  const wire = JSON.parse(JSON.stringify(tournamentRow)) as Pick<TournamentRow, 'config'>;
  return mapTournamentFromSupabase(
    createTournamentRow({ config: wire.config, status: 'draft' }),
    [],
    []
  );
}

describe('Mapper-Rundlauf der Regel-Felder', () => {
  it('erhält alle geänderten Regel-Felder verlustfrei', () => {
    expect(rundlauf(GEAENDERT).matchCockpitSettings).toEqual(GEAENDERT);
  });

  it('erhält die Vorgaben eines neuen Turniers verlustfrei', () => {
    expect(rundlauf(DEFAULT_MATCH_COCKPIT_SETTINGS).matchCockpitSettings).toEqual(DEFAULT_MATCH_COCKPIT_SETTINGS);
  });

  it('@SL-101 Gegenbeispiel: die ausgeschaltete Foul-Grenze (null) bleibt null, wird nicht zur 5', () => {
    expect(rundlauf(GEAENDERT).matchCockpitSettings?.foulLimit).toBeNull();
  });

  it('@SL-024 Gegenbeispiel: eine ausgeschaltete Kartenart bleibt aus', () => {
    expect(rundlauf(GEAENDERT).matchCockpitSettings?.enabledCards.timePenalty).toBe(false);
  });
});

describe('Gegenbeispiel: alte Konfiguration ohne die neuen Felder', () => {
  it('liest eine alte Konfiguration und ergänzt die Vorgaben, ohne zu werfen', () => {
    const row = createTournamentRow({
      config: { matchCockpitSettings: { penaltyShootersPerTeam: 5 } },
    });
    const tournament = mapTournamentFromSupabase(row, [], []);
    expect(tournament.matchCockpitSettings?.penaltyShootersPerTeam).toBe(5);
    expect(tournament.matchCockpitSettings?.clockMode).toBe('durchlaufend-letzte-minute-angehalten');
    expect(tournament.matchCockpitSettings?.foulLimit).toBe(5);
    expect(tournament.matchCockpitSettings?.shortHandedSeconds).toBe(120);
  });

  it('ohne Cockpit-Konfiguration bleibt das Turnier ohne Einstellungen (keine neuen Werte erfunden)', () => {
    const row = createTournamentRow({ config: {} });
    expect(mapTournamentFromSupabase(row, [], []).matchCockpitSettings).toBeUndefined();
  });
});
