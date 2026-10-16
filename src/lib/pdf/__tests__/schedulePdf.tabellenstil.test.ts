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
import { ohneNummer } from './pdfFixtureLayout';
import type { LayoutPage } from './pdfjsLayout';
import { testUuid } from '../../../test/testIds';

const EIN_PAAR = ['FC Nord', 'SV Süd', 'DJK Berg', 'TuS Tal'];
const teamsEinerGruppe = (): Team[] => EIN_PAAR.map((name, i) => ({ id: testUuid(i), name, group: 'A' }));

/** Seite 1 ab der Überschrift „Gruppenphase“ (Spieltabelle) oder „Spiele“ (jeder gegen jeden). */
function spielbereich(page: LayoutPage): { von: number } {
  const titel = page.texts.find(t => ['Gruppenphase', 'Spiele'].includes(ohneNummer(t.str)));
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

describe('C1-F S1 Zeilenlinien nicht übermalt', () => {
  it('unter der Überschrift der Spieltabelle liegt keine weiße Füllung (sie würde die untere Hälfte der Zeilenlinie überdecken)', async () => {
    const tournament = hallencupTournament();
    const [seite1] = await lesen(hallencupSchedule(tournament), tournament);
    const { von } = spielbereich(seite1);
    const weiss = seite1.rects.filter(r => r.fill === '#ffffff' && r.y > von && r.h > 1);

    expect(weiss).toEqual([]);
  });

  it('Finalseite: ebenfalls keine weiße Füllung in den Tabellen', async () => {
    const tournament = hallencupTournament();
    const pages = await lesen(hallencupSchedule(tournament), tournament);
    const finale = pages.find(page => page.texts.some(t => ohneNummer(t.str) === 'Halbfinale'));
    const titel = finale?.texts.find(t => ohneNummer(t.str) === 'Halbfinale');

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

  /**
   * Befund einer Seite: Nummern ihrer Spielzeilen, Zeilen mit nicht genau zwei Kästchen und Tabellen, deren erste Zeile
   * unter dem Spaltenkopf keine Spielnummer trägt (Rest einer geteilten Zeile von der Seite davor).
   */
  function seitenBefund(page: LayoutPage): { nummern: string[]; ohneKaesten: string[]; fortsetzungen: number } {
    const linien = zeilenLinien(page);
    const nummern = page.texts.filter(t => /^\d+$/.test(t.str.trim()) && t.x < 20 && Math.abs(t.size - printType.nr) < SIZE_TOL);
    const ohneKaesten = nummern
      .filter(nr => {
        const oben = Math.max(...linien.filter(y => y < nr.y));
        const unten = Math.min(...linien.filter(y => y > nr.y));
        return kaestchen(page, printBox.scoreField.w, printBox.scoreField.h, oben - TOL, unten + TOL).length !== 2;
      })
      .map(nr => nr.str.trim());
    const koepfe = page.texts.filter(t => t.str.trim() === 'Nr' && Math.abs(t.size - printType.head) < SIZE_TOL);
    const fortsetzungen = koepfe.filter(kopf => {
      const kopfUnten = Math.min(...linien.filter(y => y > kopf.y));
      const ersteUnten = Math.min(...linien.filter(y => y > kopfUnten + TOL));
      return !nummern.some(nr => nr.y > kopfUnten && nr.y < ersteUnten);
    }).length;
    return { nummern: koepfe.length > 0 ? nummern.map(nr => nr.str.trim()) : [], ohneKaesten, fortsetzungen };
  }

  // Ob eine Zeile am Seitenende geteilt würde, hängt von der Lage der Seitengrenze ab (autoTable teilt Zeilen mit mehreren
  // Textzeilen, wenn ihre Mindesthöhe noch passt). Darum mehrere Größen: ohne `rowPageBreak: 'avoid'` trifft es mehrere.
  it.each([10, 12, 14, 16, 20])('%i Teams mit dreizeiligen Namen: jede Tabelle beginnt mit einer ganzen Zeile, jede Zeile hat ihre zwei Kästchen, jede Nummer einmal', async anzahl => {
    const tournament = langesTurnier(anzahl);
    const pages = await lesen(generateFullSchedule(tournament, 'de'), tournament);
    const befunde = pages.map(seitenBefund);
    const nummern = befunde.flatMap(b => b.nummern);

    expect(pages.length, 'läuft über mehrere Seiten').toBeGreaterThan(2);
    expect(befunde.map((b, i) => (b.fortsetzungen > 0 ? `Seite ${i + 1} beginnt mit dem Rest einer geteilten Zeile` : '')).filter(Boolean)).toEqual([]);
    expect(befunde.flatMap(b => b.ohneKaesten), 'Zeilen ohne zwei ganze Kästchen').toEqual([]);
    expect(new Set(nummern).size, 'jede Spielnummer genau einmal').toBe(nummern.length);
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
    // Die Platzierung steht seit C4 auf derselben Seite unter den Spielen; ihre Platznummern „1.“ zählen hier nicht
    const platzierung = seite1.texts.filter(t => /^(\d+ )?Platzierung$/.test(t.str.trim())).at(-1);
    const texte = seite1.texts.filter(t => !platzierung || t.y < platzierung.y).map(t => t.str.trim());

    expect(texte).toEqual(expect.arrayContaining(['A1', 'A2', 'A3', 'A4']));
    expect(texte).not.toContain('1.');
    expect(texte).not.toContain('Gr');
  });
});
