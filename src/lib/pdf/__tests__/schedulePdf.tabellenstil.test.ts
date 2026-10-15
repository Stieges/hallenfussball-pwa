/**
 * B-28 C1 (G1, W10, Kennungs-Schema): Spieltabellen mit Zeilenlinien statt Vollgitter, keine Spielzeile über einem
 * Seitenumbruch, Kennungen A1… und keine Spalte „Gr“ bei einer Gruppe. Gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @BM-022, @DR-001, @DR-002.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { printBox, printStroke, printType } from '../../../design-tokens/print';
import type { Team } from '../../../types/tournament';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { kaestchen, lesen, senkrecht, SIZE_TOL, TOL, waagerecht, zeilenLinien } from './pdfScoreSupport';
import type { LayoutPage } from './pdfjsLayout';

const EIN_PAAR = ['FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal'];
const teamsEinerGruppe = (): Team[] => EIN_PAAR.map((name, i) => ({ id: `team-${i}`, name, group: 'A' }));

/** Seite 1 ab der Überschrift „Gruppenphase“ (Spieltabelle) oder „Spiele“ (jeder gegen jeden). */
function spielbereich(page: LayoutPage): { von: number } {
  const titel = page.texts.find(t => ['Gruppenphase', 'Spiele'].includes(t.str.trim()));
  if (!titel) {throw new Error('Überschrift der Spieltabelle fehlt');}
  return { von: titel.y };
}

describe('G1 Zeilenlinien statt Vollgitter', () => {
  it('in der Spieltabelle gibt es waagerechte Zeilenlinien und keine senkrechte Linie außer den Rändern der Kästchen', async () => {
    const tournament = hallencupTournament();
    const [seite1] = await lesen(hallencupSchedule(tournament), tournament);
    const { von } = spielbereich(seite1);
    const senkrechte = seite1.lines.filter(l => senkrecht(l) && l.y1 > von && l.y2 > von);
    const erlaubt = [printBox.scoreField.h, printBox.cancel.h, printBox.penField.h, printBox.refereeFieldH];

    expect(senkrechte.length, 'Kästchen haben senkrechte Kanten').toBeGreaterThan(0);
    for (const linie of senkrechte) {
      const laenge = Math.abs(linie.y2 - linie.y1);
      expect(erlaubt.some(h => Math.abs(h - laenge) <= TOL), `senkrechte Linie der Länge ${laenge.toFixed(2)} mm ist kein Kästchenrand`).toBe(true);
    }
    const zeilenlinien = seite1.lines.filter(l => waagerecht(l) && l.y1 > von && Math.abs(l.width - printStroke.row) <= TOL);
    expect(zeilenlinien.length, 'Zeilenlinien 0,25 mm').toBeGreaterThanOrEqual(12);
  });

  it('der Tabellenkopf hat Linien oben und unten in printStroke.thead', async () => {
    const tournament = hallencupTournament();
    const [seite1] = await lesen(hallencupSchedule(tournament), tournament);
    const { von } = spielbereich(seite1);
    const kopf = seite1.lines.filter(l => waagerecht(l) && l.y1 > von && Math.abs(l.width - printStroke.thead) <= TOL);

    expect(new Set(kopf.map(l => Math.round(l.y1 * 10))).size).toBeGreaterThanOrEqual(2);
  });
});

describe('W10 / @BM-022 keine Spielzeile über zwei Seiten', () => {
  /** Teams mit Namen, die auf drei Zeilen umbrechen: hohe Zeilen, die am Seitenende geteilt werden könnten. */
  const langesTurnier = (anzahl: number) => {
    const lang = (i: number) => `Sportverein Hallenfußball Nordstadt ${i} Jugend e. V. Abteilung Ost`;
    const teams: Team[] = Array.from({ length: anzahl }, (_, i) => ({ id: `t${i}`, name: lang(i), group: i < anzahl / 2 ? 'A' : 'B' }));
    return hallencupTournament({ teams, numberOfTeams: teams.length });
  };

  /** Je Spielzeile: Seite, Spielnummer, Anzahl ganzer Kästchen zwischen den Zeilenlinien ihrer Zeile. */
  async function zeilenBefund(anzahl: number) {
    const tournament = langesTurnier(anzahl);
    const pages = await lesen(generateFullSchedule(tournament, 'de'), tournament);
    const befund: Array<{ seite: number; nr: string; kaesten: number }> = [];
    pages.forEach((page, seite) => {
      const linien = zeilenLinien(page);
      const nummern = page.texts.filter(t => /^\d+$/.test(t.str.trim()) && t.x < 20 && Math.abs(t.size - printType.nr) < SIZE_TOL);
      for (const nr of nummern) {
        const oben = Math.max(...linien.filter(y => y < nr.y));
        const unten = Math.min(...linien.filter(y => y > nr.y));
        const kaesten = kaestchen(page, printBox.scoreField.w, printBox.scoreField.h, oben - TOL, unten + TOL);
        befund.push({ seite, nr: nr.str.trim(), kaesten: kaesten.length });
      }
    });
    return { befund, seiten: pages.length };
  }

  it.each([10, 12, 14, 16])('%i Teams mit dreizeiligen Namen: jede Zeile trägt ihre zwei Kästchen ganz zwischen ihren Linien, jede Nummer einmal', async anzahl => {
    const { befund, seiten } = await zeilenBefund(anzahl);

    expect(seiten, 'läuft über mehrere Seiten').toBeGreaterThan(2);
    expect(befund.filter(z => z.kaesten !== 2).map(z => `Spiel ${z.nr} auf Seite ${z.seite + 1}: ${z.kaesten} Kästchen`)).toEqual([]);
    expect(new Set(befund.map(z => z.nr)).size, 'jede Spielnummer genau einmal').toBe(befund.length);
  });
});

describe('Kennungs-Schema: eine Gruppe', () => {
  it('Teilnehmer heißen A1…, die Spieltabelle hat keine Spalte „Gr“, Gegenbeispiel zwei Gruppen hat sie', async () => {
    const eine = hallencupTournament({ teams: teamsEinerGruppe(), numberOfTeams: 4, numberOfGroups: 1, finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false }, finalsConfig: { preset: 'none' } });
    const [seite1] = await lesen(generateFullSchedule(eine, 'de'), eine);
    const texte = seite1.texts.map(t => t.str.trim());

    expect(texte).toEqual(expect.arrayContaining(['A1', 'A2', 'A3', 'A4']));
    expect(texte).not.toContain('Gr');

    const zwei = hallencupTournament();
    const [mitGruppen] = await lesen(hallencupSchedule(zwei), zwei);
    expect(mitGruppen.texts.map(t => t.str.trim())).toContain('Gr');
  });

  it('Jeder gegen jeden (ohne Gruppen): Kennungen A1… statt „1.“, keine Spalte „Gr“', async () => {
    const teams = teamsEinerGruppe().map(team => ({ ...team, group: undefined }));
    const tournament = hallencupTournament({ teams, numberOfTeams: 4, groupSystem: 'roundRobin' });
    const [seite1] = await lesen(generateFullSchedule(tournament, 'de'), tournament);
    const texte = seite1.texts.map(t => t.str.trim());

    expect(texte).toEqual(expect.arrayContaining(['A1', 'A2', 'A3', 'A4']));
    expect(texte).not.toContain('1.');
    expect(texte).not.toContain('Gr');
  });
});
