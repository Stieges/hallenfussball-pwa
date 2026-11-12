/**
 * @W1-043 Der Import übernimmt die Trikotfarben der Teams (docs/anforderungen/2026-09-27_wizard-einstieg-und-fuehrung.md).
 * Befund C-IMPORT-OHNE-TRIKOTFARBEN. Echter Weg: JSON-Text (echte Vorlagen des Nikolaus-Wochenendes) →
 * `validateAndParseTournamentImport`. Ein Team ohne Farbe hat KEIN `colors`-Feld, wie im Assistenten angelegt (Step4_Teams).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateAndParseTournamentImport } from '../tournamentImporter';
import { DEFAULT_BIB_COLOR } from '../../core/models/kit';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/nikolaus');
type FileTeam = { id: string; name: string; colors?: unknown };
type FileTournament = { title: string; teams: FileTeam[] } & Record<string, unknown>;

const lade = (name: string): FileTournament => JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8')) as FileTournament;
const importiere = (datei: FileTournament) => validateAndParseTournamentImport(JSON.stringify(datei), 'json');
const mitTeam6 = (colors: unknown, entfernen = false): FileTournament => {
  const datei = lade('f2');
  datei.teams = datei.teams.map((t, i) => {
    if (i !== 5) { return t; }
    const rest: FileTeam = { id: t.id, name: t.name };
    return entfernen ? rest : { ...rest, colors };
  });
  return datei;
};

describe('@W1-043 Import übernimmt die Trikotfarben', () => {
  it('Team 1 trägt Blau, Team 5 Weiß, Team 6 ohne Farbe bleibt ohne Farbe (kein colors-Feld)', () => {
    const datei = mitTeam6(undefined, true);
    datei.teams[0].colors = { primary: '#1565C0' };
    datei.teams[4].colors = { primary: '#FFFFFF' };
    const result = importiere(datei);

    expect(result.isValid).toBe(true);
    const teams = result.tournament?.teams ?? [];
    expect(teams[0].colors).toEqual({ primary: '#1565C0' });
    expect(teams[4].colors).toEqual({ primary: '#FFFFFF' });
    expect(teams[5].colors).toBeUndefined();
    expect('colors' in teams[5]).toBe(false);
  });

  it.each(['d', 'e1', 'e2', 'f1', 'f2', 'g'])('Vorlage %s: alle 6 Teams tragen genau die Farbe der Datei', (name) => {
    const datei = lade(name);
    const result = importiere(datei);

    expect(result.isValid).toBe(true);
    const teams = result.tournament?.teams ?? [];
    expect(teams).toHaveLength(6);
    expect(teams.map((t) => t.name)).toEqual(datei.teams.map((t) => t.name));
    expect(teams.map((t) => t.colors)).toEqual(datei.teams.map((t) => t.colors));
  });

  it('Gegenbeispiel: Datei ohne colors, colors ohne primary, leerer Text, null – kein colors-Feld, kein Fehler', () => {
    for (const colors of [undefined, {}, { primary: '' }, { primary: '   ' }, { primary: null }, null]) {
      const result = importiere(mitTeam6(colors));
      expect(result.isValid).toBe(true);
      expect(result.tournament?.teams[5].colors).toBeUndefined();
    }
    expect(importiere(mitTeam6(undefined, true)).tournament?.teams[5].colors).toBeUndefined();
  });

  it('Kleinschreibung und Kurzform werden normalisiert (wie die Leibchen-Prüfung)', () => {
    const result = importiere(mitTeam6({ primary: '#1565c0' }));
    expect(result.tournament?.teams[5].colors).toEqual({ primary: '#1565C0' });
    expect(importiere(mitTeam6({ primary: ' #fff ' })).tournament?.teams[5].colors).toEqual({ primary: '#FFFFFF' });
  });

  it('zweite Trikotfarbe (secondary) wird übernommen, wenn gültig', () => {
    const result = importiere(mitTeam6({ primary: '#1565C0', secondary: '#ffffff' }));
    expect(result.tournament?.teams[5].colors).toEqual({ primary: '#1565C0', secondary: '#FFFFFF' });
  });

  it.each([
    { art: 'Farbname', wert: 'blau' },
    { art: 'zu kurz', wert: '#12' },
    { art: 'keine Hex-Ziffern', wert: '#GGGGGG' },
    { art: 'ohne Raute', wert: '1565C0' },
    { art: 'Zahl', wert: 255 },
  ])('ungültige Farbe ($art): Klartext-Fehler mit Team und Angabe, kein Turnier', ({ wert }) => {
    const result = importiere(mitTeam6({ primary: wert }));

    expect(result.isValid).toBe(false);
    expect(result.tournament).toBeUndefined();
    expect(result.errors).toEqual([
      expect.objectContaining({
        code: 'INVALID_TEAM_COLOR',
        field: 'teams[5].colors.primary',
        message: expect.stringContaining(`„SG Taching/Tengling“: „${String(wert)}“ ist keine gültige Farbangabe`),
      }),
    ]);
  });

  it('ungültige secondary und colors, das kein Objekt ist, werden ebenfalls genannt', () => {
    expect(importiere(mitTeam6({ primary: '#1565C0', secondary: 'weiß' })).errors[0]).toEqual(
      expect.objectContaining({ code: 'INVALID_TEAM_COLOR', field: 'teams[5].colors.secondary' }),
    );
    expect(importiere(mitTeam6('blau')).errors[0]).toEqual(
      expect.objectContaining({ code: 'INVALID_TEAM_COLOR', field: 'teams[5].colors' }),
    );
  });

  it('mehrere ungültige Farben: jede wird genannt', () => {
    const datei = lade('f2');
    datei.teams[0].colors = { primary: 'rot' };
    datei.teams[1].colors = { primary: '#12' };
    expect(importiere(datei).errors.map((e) => e.field)).toEqual(['teams[0].colors.primary', 'teams[1].colors.primary']);
  });

  it('Leibchenfarbe und Regel setzt der Import nicht (Vorbelegung bleibt)', () => {
    const tournament = importiere(lade('f2')).tournament;

    expect(tournament).toBeDefined();
    expect(tournament?.bibColor).toBeUndefined();
    expect(tournament?.matches.every((m) => m.kit === undefined)).toBe(true);
    expect(DEFAULT_BIB_COLOR).toBe('#FFCC00');
  });
});
