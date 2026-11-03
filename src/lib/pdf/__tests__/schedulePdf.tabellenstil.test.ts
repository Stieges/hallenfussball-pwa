/**
 * B-28 C1 (G1, W10, Kennungs-Schema): Spieltabellen mit Zeilenlinien statt Vollgitter, keine Spielzeile über einem
 * Seitenumbruch, Kennungen A1… und keine Spalte „Gr“ bei einer Gruppe. Gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @BM-022, @DR-001, @DR-002.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printType } from '../../../design-tokens/print';
import { printWriteLine } from '../../../design-tokens/print-sheet';
import type { Team } from '../../../types/tournament';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { lesen, SIZE_TOL, TOL, waagerecht } from './pdfScoreSupport';
import { ohneNummer } from './pdfFixtureLayout';
import type { LayoutPage } from './pdfjsLayout';
import { testUuid } from '../../../test/testIds';

const EIN_PAAR = ['FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal'];
const teamsEinerGruppe = (): Team[] => EIN_PAAR.map((name, i) => ({ id: testUuid(i), name, group: 'A' }));

describe('C1-F S1 Zeilenlinien nicht übermalt', () => {
  it('Finalseite: ebenfalls keine weiße Füllung in den Tabellen', async () => {
    const tournament = hallencupTournament();
    const pages = await lesen(hallencupSchedule(tournament), tournament);
    const istHalbfinale = (str: string): boolean => ohneNummer(str).toLocaleLowerCase('de') === 'halbfinale';
    const finale = pages.find(page => page.texts.some(t => istHalbfinale(t.str)));
    const titel = finale?.texts.find(t => istHalbfinale(t.str));

    const platzierung = finale?.texts.find(t => ohneNummer(t.str) === 'Platzierung');

    // Die Platzierung darunter ist keine Spieltabelle und bleibt außer Betracht
    expect(finale?.rects.filter(r => r.fill === '#ffffff' && r.y > (titel?.y ?? 0) && r.y < (platzierung?.y ?? 0) && r.h > 1)).toEqual([]);
  });
});

describe('C1-F S3b Spiele nach Anstoßzeit, unabhängig von der Reihenfolge im Plan', () => {
  it('Jeder gegen jeden mit „Teams pfeifen“ und zwei Feldern: die Uhrzeiten laufen von oben nach unten nicht zurück', async () => {
    const teams = teamsEinerGruppe().concat([{ id: testUuid(901), name: 'SC Ost', group: 'A' }, { id: testUuid(902), name: 'FC Mitte', group: 'A' }]).map(t => ({ ...t, group: undefined }));
    const tournament = hallencupTournament({ teams, numberOfTeams: 6, groupSystem: 'roundRobin', refereeConfig: { mode: 'teams' } });
    const pages = await lesen(generateFullSchedule(tournament, 'de'), tournament);
    const zeiten = pages.flatMap(page => page.texts
      .filter(t => /^\d{2}:\d{2}$/.test(t.str.trim()) && Math.abs(t.size - printType.time) < SIZE_TOL)
      .sort((a, b) => a.y - b.y)
      .map(t => t.str.trim()));

    expect(zeiten.length).toBeGreaterThan(10);
    expect(zeiten).toEqual([...zeiten].sort());
  });

  it('Gegenbeispiel Plan in Zeitfolge: Gruppen + Finale mit zwei Feldern bleibt in Zeitfolge', async () => {
    const tournament = hallencupTournament();
    const [seite1] = await lesen(hallencupSchedule(tournament), tournament);
    const zeiten = seite1.texts.filter(t => /^\d{2}:\d{2}$/.test(t.str.trim()) && Math.abs(t.size - printType.time) < SIZE_TOL).sort((a, b) => a.y - b.y).map(t => t.str.trim());

    expect(zeiten).toEqual([...zeiten].sort());
  });
});

describe('W10 / @BM-022 keine Spielzeile über zwei Seiten', () => {
  /** Teams mit Namen, die auf drei Zeilen umbrechen: hohe Zeilen, die am Seitenende geteilt werden könnten. */
  const langesTurnier = (anzahl: number) => {
    const lang = (i: number) => `Sportverein Hallenfußball Nordstadt ${i} Jugend e. V. Abteilung Ost`;
    const teams: Team[] = Array.from({ length: anzahl }, (_, i) => ({ id: testUuid(i), name: lang(i), group: i < anzahl / 2 ? 'A' : 'B' }));
    return hallencupTournament({ teams, numberOfTeams: teams.length });
  };

  /** Spielnummern einer Seite: Textstücke in der Nummernspalte (Schrift `printType.nr`). */
  const nummernVon = (page: LayoutPage): string[] =>
    page.texts.filter(t => /^\d+$/.test(t.str.trim()) && t.x < 20 && Math.abs(t.size - printType.nr) < SIZE_TOL).map(t => t.str.trim());

  // Das Seitenmodell bricht nur zwischen Zeilen um (@DR-002, @DR-033): jede Zeile steht ganz auf genau einer Seite.
  it.each([10, 12, 14, 16, 20])('%i Teams mit dreizeiligen Namen: jede Spielnummer genau einmal, lückenlos, jede Zeile mit ihren zwei Ergebnislinien', async anzahl => {
    const tournament = langesTurnier(anzahl);
    const pages = await lesen(generateFullSchedule(tournament, 'de'), tournament);
    const nummern = pages.flatMap(nummernVon).map(Number);
    const gruppenspiele = (anzahl / 2) * (anzahl / 2 - 1); // zwei Gruppen, jeder gegen jeden
    const linien = pages.flatMap(page => page.lines.filter(l => waagerecht(l) && Math.abs(l.width - printWriteLine.stroke) <= TOL && Math.abs(l.x2 - l.x1) >= printWriteLine.resultNarrow - TOL));

    expect(pages.length, 'läuft über mehrere Seiten').toBeGreaterThan(2);
    expect(new Set(nummern).size, 'jede Spielnummer genau einmal').toBe(nummern.length);
    expect(nummern.slice(0, gruppenspiele)).toEqual(Array.from({ length: gruppenspiele }, (_, i) => i + 1));
    expect(linien.length, 'zwei Linien je Gruppenspiel').toBeGreaterThanOrEqual(2 * gruppenspiele);
  });
});

describe('@DR-032 Namen ausgeschrieben, Spalte „Gr.“ nur bei mehr als einer Gruppe', () => {
  it('eine Gruppe: Namen statt Kennungen A1…, keine Spalte „Gr.“; Gegenbeispiel zwei Gruppen hat sie', async () => {
    const eine = hallencupTournament({ teams: teamsEinerGruppe(), numberOfTeams: 4, numberOfGroups: 1, finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false }, finalsConfig: { preset: 'none' } });
    const [seite1] = await lesen(generateFullSchedule(eine, 'de'), eine);
    const texte = seite1.texts.map(t => t.str.trim());

    expect(texte).toContain('FC Nord');
    expect(texte).not.toEqual(expect.arrayContaining(['A1', 'A2']));
    expect(texte).not.toContain('Gr.');

    const zwei = hallencupTournament();
    const [mitGruppen] = await lesen(hallencupSchedule(zwei), zwei);
    expect(mitGruppen.texts.map(t => t.str.trim())).toContain('Gr.');
  });

  it('Jeder gegen jeden (ohne Gruppen): Namen, keine Spalte „Gr.“', async () => {
    const teams = teamsEinerGruppe().map(team => ({ ...team, group: undefined }));
    const tournament = hallencupTournament({ teams, numberOfTeams: 4, groupSystem: 'roundRobin' });
    const [seite1] = await lesen(generateFullSchedule(tournament, 'de'), tournament);
    const texte = seite1.texts.map(t => t.str.trim());

    expect(texte).toContain('FC Nord');
    expect(texte).not.toContain('Gr.');
  });
});
