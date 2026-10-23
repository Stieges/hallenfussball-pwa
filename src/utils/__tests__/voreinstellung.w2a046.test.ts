/**
 * Paket TB, Task TB-2: Voreinstellung BFV privat (Record `2026-09-27_wizard-regelinhalte`, @W2A-046 Kern) und
 * Befund C-WERTUNG-LEER (Turnier ohne gespeicherte Reihenfolge sortiert seine Tabelle nicht).
 * Erwartet: „Punkte, direkter Vergleich, Tordifferenz, erzielte Tore“, alle aktiv – in Service, Import und Vorlage;
 * eine fehlende oder leere Liste aus Cloud oder lokalem Speicher gilt als diese Voreinstellung.
 */
import { describe, expect, it } from 'vitest';
import { TournamentCreationService } from '../../core/services/TournamentCreationService';
import type { ITournamentRepository } from '../../core/repositories/ITournamentRepository';
import { mapTournamentFromSupabase } from '../../core/repositories/supabaseMappers';
import { hydrateTournament } from '../../core/repositories/hydration';
import { validateAndParseTournamentImport } from '../tournamentImporter';
import { JSON_TEMPLATE } from '../../components/dialogs/ImportTemplates';
import { calculateStandings } from '../calculations';
import type { PlacementCriterion } from '../../types/tournament';
import { createTournamentRow } from '../../../tests/factories/supabase';
import { DATA, league, names, NAME } from '../../core/standings/__tests__/fixtures';

const BFV_PRIVAT = [
  { id: 'points', enabled: true },
  { id: 'directComparison', enabled: true },
  { id: 'goalDifference', enabled: true },
  { id: 'goalsFor', enabled: true },
];
const kern = (list: readonly PlacementCriterion[] | undefined) => (list ?? []).map(({ id, enabled }) => ({ id, enabled }));
const repository = { save: () => Promise.resolve() } as unknown as ITournamentRepository;

describe('TB-2 Voreinstellung BFV privat', () => {
  it('@W2A-046 ein neues Turnier aus dem Assistenten-Dienst hat „Punkte, direkter Vergleich, Tordifferenz, erzielte Tore“, alle aktiv', () => {
    const draft = new TournamentCreationService(repository).createDraft();

    expect(kern(draft.placementLogic)).toEqual(BFV_PRIVAT);
    // Gegenbeispiel: der direkte Vergleich steht an Stelle 2 und ist an (bisher: an Stelle 4, aus).
    expect(draft.placementLogic.findIndex((c) => c.id === 'directComparison')).toBe(1);
    expect(draft.placementLogic.every((c) => c.enabled)).toBe(true);
    // Eine vom Nutzer gewählte Reihenfolge bleibt erhalten.
    const eigene: PlacementCriterion[] = [{ id: 'points', enabled: true }, { id: 'goalDifference', enabled: true }];
    expect(kern(new TournamentCreationService(repository).createDraft({ placementLogic: eigene }).placementLogic)).toEqual(eigene);
  });

  it('@W2A-046 Import (CSV, JSON ohne Reihenfolge) und Importvorlage sind gleich vorbelegt', () => {
    const csv = validateAndParseTournamentImport('Team;Gruppe\nTSV Waging rot;A\nDJK Kammer;A', 'csv');
    expect(csv.isValid).toBe(true);
    expect(kern(csv.tournament?.placementLogic)).toEqual(BFV_PRIVAT);

    const json = validateAndParseTournamentImport(JSON.stringify({ title: 'Nikolaus', teams: [{ name: 'TSV Waging rot' }, { name: 'DJK Kammer' }] }), 'json');
    expect(kern(json.tournament?.placementLogic)).toEqual(BFV_PRIVAT);

    expect(kern(JSON_TEMPLATE.placementLogic)).toEqual(BFV_PRIVAT);
    // Gegenbeispiel: eine im JSON gespeicherte Reihenfolge wird übernommen, nicht überschrieben.
    const eigene = validateAndParseTournamentImport(JSON.stringify({
      title: 'Nikolaus', teams: [{ name: 'A' }, { name: 'B' }], placementLogic: [{ id: 'points', label: 'Punkte', enabled: true }],
    }), 'json');
    expect(kern(eigene.tournament?.placementLogic)).toEqual([{ id: 'points', enabled: true }]);
  });

  it.each([
    { quelle: 'Cloud-Zeile ohne placementLogic', config: {} },
    { quelle: 'Cloud-Zeile mit leerer placementLogic', config: { placementLogic: [] } },
  ])('@W2A-046 C-WERTUNG-LEER $quelle: Voreinstellung, Tabelle der @ET-056-Daten hat Kammer vor Waging rot', ({ config }) => {
    const mapped = mapTournamentFromSupabase(createTournamentRow({ config }), [], []);
    expect(kern(mapped.placementLogic)).toEqual(BFV_PRIVAT);

    const fx = league('RKMUNO', DATA.ET_056);
    const rows = calculateStandings(fx.teams, fx.matches, { ...fx.tournament, placementLogic: mapped.placementLogic });
    expect(names(rows).slice(0, 2)).toEqual([NAME.K, NAME.R]);
    // Gegenbeispiel: nicht die Eingabereihenfolge (dort stünde Waging rot vorn).
    expect(fx.teams[0].name).toBe(NAME.R);
    // Eine gespeicherte Liste bleibt unverändert.
    const gespeichert = mapTournamentFromSupabase(createTournamentRow({ config: { placementLogic: [{ id: 'points', enabled: true }] } }), [], []);
    expect(kern(gespeichert.placementLogic)).toEqual([{ id: 'points', enabled: true }]);
  });

  it('@W2A-046 C-WERTUNG-LEER lokal gespeichertes Turnier mit leerer Reihenfolge bekommt die Voreinstellung', () => {
    const fx = league('RKMUNO', DATA.ET_056);
    const leer = hydrateTournament(JSON.parse(JSON.stringify({ ...fx.tournament, placementLogic: [] })));
    expect(kern(leer.placementLogic)).toEqual(BFV_PRIVAT);
    const ohne = hydrateTournament(JSON.parse(JSON.stringify({ ...fx.tournament, placementLogic: undefined })));
    expect(kern(ohne.placementLogic)).toEqual(BFV_PRIVAT);
    // Gegenbeispiel: eine gespeicherte Reihenfolge bleibt.
    const eigene = hydrateTournament(JSON.parse(JSON.stringify(fx.tournament)));
    expect(kern(eigene.placementLogic)).toEqual(BFV_PRIVAT.map((c) => ({ ...c })));
    const umgestellt = hydrateTournament(JSON.parse(JSON.stringify({ ...fx.tournament, placementLogic: [{ id: 'goalDifference', enabled: true }] })));
    expect(kern(umgestellt.placementLogic)).toEqual([{ id: 'goalDifference', enabled: true }]);
  });
});
