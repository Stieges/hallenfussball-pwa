/**
 * @W4-034 / @W4-048 Der Import übernimmt die Mannschaften des Veranstalters und die Art der Eröffnung
 * (Befund C-VERANSTALTER-MARKIERUNG-OHNE-OBERFLAECHE). Echter Weg: JSON-Text → `validateAndParseTournamentImport`.
 * Die Team-Kennungen der Datei werden auf neue Kennungen umgesetzt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateAndParseTournamentImport } from '../tournamentImporter';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/nikolaus');
type FileTournament = { title: string; teams: Array<{ id: string; name: string }> } & Record<string, unknown>;
const lade = (): FileTournament => JSON.parse(readFileSync(path.join(dir, 'f2.json'), 'utf8')) as FileTournament;
const importiere = (datei: FileTournament) => validateAndParseTournamentImport(JSON.stringify(datei), 'json');

describe('@W4-034 Import: Mannschaften des Veranstalters', () => {
  it('übernimmt die Markierung und setzt die alten Team-Kennungen auf die neuen um', () => {
    const datei = lade();
    datei.hostTeamIds = [datei.teams[4].id, datei.teams[5].id];
    datei.openingMode = 'both-home';
    const result = importiere(datei);

    expect(result.isValid).toBe(true);
    const t = result.tournament;
    const neu = t?.teams ?? [];
    expect(t?.hostTeamIds).toEqual([neu[4].id, neu[5].id]);
    expect(neu[4].id).not.toBe(datei.teams[4].id);
    expect(t?.openingMode).toBe('both-home');
  });

  it('Gegenbeispiel: ohne Angaben in der Datei bleibt das Turnier ohne Markierung', () => {
    const t = importiere(lade()).tournament;

    expect(t?.hostTeamIds).toBeUndefined();
    expect(t?.openingMode).toBeUndefined();
  });

  it('unbekannte Kennungen und unbekannte Werte werden ignoriert, die Datei bleibt lesbar', () => {
    const datei = lade();
    datei.hostTeamIds = [datei.teams[0].id, 'gibt-es-nicht', 42];
    datei.openingMode = 'irgendwas';
    const result = importiere(datei);

    expect(result.isValid).toBe(true);
    expect(result.tournament?.hostTeamIds).toEqual([result.tournament?.teams[0].id]);
    expect(result.tournament?.openingMode).toBeUndefined();
  });

  it('alle Kennungen unbekannt: keine Markierung', () => {
    const datei = lade();
    datei.hostTeamIds = ['x', 'y'];

    expect(importiere(datei).tournament?.hostTeamIds).toBeUndefined();
  });
});
