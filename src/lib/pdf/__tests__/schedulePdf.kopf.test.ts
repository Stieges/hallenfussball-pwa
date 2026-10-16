/**
 * B-28a3-3b: Kopf Seite 1 mit Regelzeilen, Kurzkopf auf jeder Folgeseite (K3), K.-o.-Zeile über der Finalrunde,
 * Teilnehmer als Zeilen, Teamnamen mindestens 12 pt, keine Schiedsrichter-Spalte. Gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @DR-001, @DR-002, @DR-006, @DR-007, @DR-015, @DR-020, @BM-009, @BM-021, @BM-052.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import { printColumns, printLimits, printType } from '../../../design-tokens/print';
import { printHeader } from '../../../design-tokens/print-header';
import type { PlacementCriterion, Team, Tournament } from '../../../types/tournament';
import { HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { bboxOf, expectedMatrix, qrRects } from './pdfKopfSupport';
import { layoutOf, ohneNummer } from './pdfFixtureLayout';
import { pageGeometry } from '../layout';
import type { LayoutPage, LayoutText } from './pdfjsLayout';
import { squash } from './pdfjsText';
import { fettMap } from './pdfSchnitt';
import { testUuid } from '../../../test/testIds';

const BFV = 'BFV-Richtlinien für Futsal und private Hallenturniere';
const LONG_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
/** Toleranz für die Größe, die pdfjs aus der Textmatrix liest. */
const SIZE_TOL = 0.05;
/** Kopfangaben (Bezeichnungen und Werte) in 10,5 pt (Daniel 15.10., bewusste Abweichung von v7.2 mit 9,5 pt). Literal, damit der Test den Wert festhält. */
const KOPF_PT = 10.5;
/** Beschriftung unter dem Zuschauer-QR (C4); sie gehört nicht zur Angabentabelle. */
const QR_CAPTION = 'Live-Ergebnisse';

const PLACEMENT: PlacementCriterion[] = [
  { id: 'points', enabled: true },
  { id: 'goalDifference', enabled: true },
  { id: 'goalsFor', enabled: true },
  { id: 'directComparison', enabled: true },
];

/** Hallencup Nord mit Regelwerk und Platzierung wie im Beispiel. */
function hallencupMitRegelwerk(overrides: Partial<Tournament> = {}): Tournament {
  return Object.assign(hallencupTournament({ placementLogic: PLACEMENT, ...overrides }), { rulebook: BFV });
}

/** 32 Teams in acht Gruppen à vier: die Gruppentabellen laufen über eine Seite, die Finalrunde ebenfalls. */
const GROSS_TEAMS: Team[] = Array.from({ length: 32 }, (_, i) => ({
  id: testUuid(i + 1),
  name: `Verein ${String(i + 1).padStart(2, '0')}`,
  group: 'ABCDEFGH'[Math.floor(i / 4)],
}));

function grossesTurnier(): { tournament: Tournament; schedule: GeneratedSchedule } {
  const tournament = hallencupTournament({
    teams: GROSS_TEAMS,
    numberOfTeams: GROSS_TEAMS.length,
    numberOfGroups: 8,
    finalsConfig: { preset: 'top-16', tiebreaker: 'shootout' },
  });
  return { tournament, schedule: generateFullSchedule(tournament, 'de') };
}

/** Eine Textstelle im Seitenkopf, ohne Leerzeichen am Rand. */
const trimmed = (text: LayoutText): string => text.str.trim();

function findPage(pages: LayoutPage[], text: string): number {
  return pages.findIndex(page => page.texts.some(t => ohneNummer(t.str) === text));
}

const LANGER_TITEL = 'Internationaler Hallenfußball-Wintercup der Sportgemeinschaft Nordheim 2026';

describe('W1 Kurzkopf: langer Turniername bricht um und bleibt im Rand', () => {
  it.each([
    ['hoch', {}],
    ['quer', { orientation: 'landscape' as const }],
  ])('jede Textstelle hat mindestens 15 mm Abstand zum rechten Rand, %s', async (_name, extra) => {
    const tournament = hallencupMitRegelwerk({ title: LANGER_TITEL });
    const { pages, width } = await layoutOf({ tournament, ...extra }, hallencupSchedule(tournament));

    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (const page of pages) {
      for (const t of page.texts) {
        expect(t.x + t.w, `„${t.str}“`).toBeLessThanOrEqual(width - 15 + SIZE_TOL);
      }
    }
  });

  it('der Kurzkopf-Titel steht auf Folgeseiten in zwei Zeilen (16 pt)', async () => {
    const tournament = hallencupMitRegelwerk({ title: LANGER_TITEL });
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const zeilen = new Set(
      pages[1].texts
        .filter(t => Math.abs(t.size - 16) <= SIZE_TOL)
        .map(t => Math.round(t.y * 10)),
    );

    expect(zeilen.size).toBe(2);
  });
});

describe('@DR-006 Kopf Seite 1: Regeln in der Angabentabelle unter den Turnierdaten', () => {
  it('Modus, Wertung, Spielzeit und Regelwerk stehen als Bezeichnungen in dieser Reihenfolge, untereinander', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const bezeichnungen = ['Modus', 'Wertung', 'Spielzeit', 'Regelwerk'];
    const stellen = bezeichnungen.map(name => pages[0].texts.find(t => trimmed(t) === name));
    stellen.forEach((t, i) => expect(t, bezeichnungen[i]).toBeDefined());
    const ys = stellen.map(t => t?.y ?? 0);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    expect(pages[0].texts.map(trimmed)).toEqual(expect.arrayContaining(['Gruppen + Finalrunde', 'Spielzeit']));
    expect(pages[0].texts.map(trimmed)).toContain(BFV);
  });

  it('@DR-007 Gegenbeispiel: ohne eingetragenes Regelwerk erscheint keine Bezeichnung „Regelwerk“', async () => {
    const tournament = hallencupTournament({ title: 'Hallencup Ost', placementLogic: PLACEMENT });
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));

    expect(pages[0].texts.map(trimmed)).not.toContain('Regelwerk');
  });
});

describe('@DR-015 K.-o.-Zeile über der Finalrunde', () => {
  it('Die Entscheidung im K.-o.-Spiel steht als eine Zeile auf der Finalseite, vor den Finalspielen', async () => {
    const tournament = hallencupMitRegelwerk({ finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' } });
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const seite = findPage(pages, 'Halbfinale');
    expect(seite, 'Finalseite').toBeGreaterThan(0);

    const ko = pages[seite].texts.find(t => trimmed(t) === 'K.-o.: bei Gleichstand Strafstoßschießen, 5 Schützen je Team');
    const titel = pages[seite].texts.find(t => ohneNummer(t.str) === 'Halbfinale');
    expect(ko, 'K.-o.-Zeile auf der Finalseite').toBeDefined();
    expect(ko && titel ? ko.y : 0).toBeLessThan(titel?.y ?? 0);
  });
});

describe('Kopf: Titel und Angaben überlappen sich nicht', () => {
  it('die erste Angabe steht mindestens 5,5 mm unter der Grundlinie des Titels (Unterlängen frei)', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const titel = pages[0].texts.find(t => trimmed(t) === 'Hallencup Nord');
    const angabe = pages[0].texts.find(t => trimmed(t) === 'Veranstalter');

    expect(titel && angabe, 'Titel und Angabe gefunden').toBeDefined();
    expect((angabe?.y ?? 0) - (titel?.y ?? 0)).toBeGreaterThanOrEqual(5.5);
  });
});

describe('K3 – Kurzkopf auf jeder Folgeseite', () => {
  it('Seite 2 und 3 tragen den Kurzkopf mit dem Turniernamen in 16 pt', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));

    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (let p = 1; p < pages.length; p++) {
      const kopf = pages[p].texts.find(t => trimmed(t) === 'Hallencup Nord');
      expect(kopf, `Kurzkopf auf Seite ${p + 1}`).toBeDefined();
      expect(Math.abs((kopf?.size ?? 0) - 16)).toBeLessThanOrEqual(SIZE_TOL);
      expect(kopf?.y ?? 99).toBeLessThan(30);
    }
  });

  it('K3: Umbruch der Gruppentabellen und der Finalrunde (32 Teams): jede Folgeseite trägt den Kurzkopf', async () => {
    const { tournament, schedule } = grossesTurnier();
    const { pages } = await layoutOf({ tournament }, schedule);

    expect(pages.length, 'Fixture läuft über mehrere Seiten').toBeGreaterThanOrEqual(5);
    for (let p = 1; p < pages.length; p++) {
      const kopf = pages[p].texts.find(t => trimmed(t) === 'Hallencup Nord' && t.y < 30);
      expect(kopf, `Kurzkopf auf Seite ${p + 1} von ${pages.length}`).toBeDefined();
    }
  });
});

describe('@DR-001 Teamnamen mindestens 12 pt, überall', () => {
  const NAMEN = HALLENCUP_TEAMS.map(team => team.name);

  it.each([
    ['hoch', {}],
    ['quer', { orientation: 'landscape' as const }],
  ])('jede Fundstelle eines Teamnamens (Teilnehmer, Spielzeilen, Tabellen) ist mindestens 12 pt groß, %s', async (_name, extra) => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament, ...extra }, hallencupSchedule(tournament));

    const fundstellen = pages.flatMap(page => page.texts).filter(t => {
      const text = trimmed(t);
      return text.length >= 3 && NAMEN.some(name => text.includes(name) || name.includes(text));
    });
    expect(fundstellen.length).toBeGreaterThan(0);
    for (const t of fundstellen) {
      expect(t.size, `„${t.str}“`).toBeGreaterThanOrEqual(printLimits.teamPt - SIZE_TOL);
    }
  });

  it('@BM-021 50-Zeichen-Name steht vollständig im PDF, Wort für Wort, nichts abgeschnitten', async () => {
    const teams = HALLENCUP_TEAMS.map((team, i) => (i === 0 ? { ...team, name: LONG_50 } : team));
    const tournament = hallencupMitRegelwerk({ teams });
    const { pages } = await layoutOf({ tournament }, generateFullSchedule(tournament, 'de'));
    const text = squash(pages.flatMap(page => page.texts.map(trimmed)).join(''));

    expect(text).toContain(squash(LONG_50));
  });

  it('@BM-021 in der Gruppentabelle umbricht der 50-Zeichen-Name auf höchstens drei Zeilen', async () => {
    const teams = HALLENCUP_TEAMS.map((team, i) => (i === 0 ? { ...team, name: LONG_50 } : team));
    const tournament = hallencupMitRegelwerk({ teams });
    const { pages } = await layoutOf({ tournament }, generateFullSchedule(tournament, 'de'));
    const tabelle = pages.find(page => page.texts.some(t => ohneNummer(t.str) === 'Tabelle – Gruppe A'));
    expect(tabelle, 'Seite mit Tabelle Gruppe A').toBeDefined();

    // Teamspalte: Rest der Breite zwischen Platz- und Zahlenspalten (Tokens, keine Zahl im Test)
    const geo = pageGeometry('a4', 'portrait');
    const zahlenspalten = Object.values(printColumns.standings).reduce((summe, breite) => summe + breite, 0);
    const teamBreite = geo.contentWidth - zahlenspalten;
    const teamLeft = geo.left + printColumns.standings.pos;
    const zeilen = new Set(
      (tabelle?.texts ?? [])
        .filter(t => {
          const text = trimmed(t);
          return text.length >= 2 && LONG_50.includes(text) && Math.abs(t.size - printLimits.teamPt) <= SIZE_TOL
            && t.x >= teamLeft - SIZE_TOL && t.x < teamLeft + teamBreite;
        })
        .map(t => Math.round(t.y * 10)),
    );
    expect(zeilen.size).toBeGreaterThanOrEqual(1);
    expect(zeilen.size).toBeLessThanOrEqual(3);
  });
});

describe('Teilnehmer und Schiedsrichter', () => {
  it('Teilnehmer stehen als Zeilen je Gruppe: „A1 FC Nord“ und die weiteren Kennungen folgen im selben Abschnitt', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const seite1 = squash(pages[0].texts.map(trimmed).join(' '));

    expect(seite1).toContain(squash('Gruppe A'));
    expect(seite1).toContain(squash('A1 FC Nord'));
    expect(seite1).toContain(squash('A3 DJK Berg'));
    expect(seite1).toContain(squash('B4 SV Hof'));
  });

  it('W4 ohne Gruppen steht vor jedem Namen die Kennung A1… (B-28 C1: immer Buchstabe und Nummer)', async () => {
    const teams = HALLENCUP_TEAMS.map(team => ({ ...team, group: undefined }));
    const tournament = hallencupMitRegelwerk({ teams, groupSystem: 'roundRobin' });
    const { pages } = await layoutOf({ tournament }, generateFullSchedule(tournament, 'de'));
    const seite1 = squash(pages[0].texts.map(trimmed).join(' '));

    expect(seite1).toContain(squash('A1 FC Nord'));
    expect(seite1).toContain(squash('A8 SV Hof'));
    expect(seite1).not.toContain(squash('1. FC Nord'));
  });

  it('W2 die Teilnehmerzeile auf Seite 1 hat mindestens 12 pt', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const zeile = pages[0].texts.find(t => trimmed(t).includes('DJK Berg'));

    expect(zeile, 'Teilnehmerzeile gefunden').toBeDefined();
    expect(zeile?.size ?? 0).toBeGreaterThanOrEqual(printLimits.teamPt - SIZE_TOL);
  });

  it('@DR-025 die Spalte trägt „SR“, das Wort „Schiedsrichter“ steht nirgends (Spalte mit Nummer oder leerem Feld)', async () => {
    const tournament = hallencupMitRegelwerk({ refereeConfig: { mode: 'organizer', numberOfReferees: 2 } });
    const schedule = hallencupSchedule(tournament);
    expect(schedule.allMatches.some(m => m.referee !== undefined), 'Schiedsrichter sind eingeteilt').toBe(true);

    const { pages } = await layoutOf({ tournament }, schedule);
    expect(pages[0].texts.some(t => trimmed(t) === 'SR'), 'Spaltenkopf').toBe(true);
    for (const page of pages) {
      for (const t of page.texts) {
        expect(trimmed(t)).not.toContain('Schiedsrichter');
      }
    }
  });
});

describe('@BM-052 Kicker: „Spielplan“ bzw. „Spielplan zum Ausfüllen“ (G57)', () => {
  it('Fassung „blank“ steht als „Spielplan zum Ausfüllen“ im Kopf, Fassung „plan“ als „Spielplan“, nie beides', async () => {
    const tournament = hallencupMitRegelwerk();
    const schedule = hallencupSchedule(tournament);

    const leer = await layoutOf({ tournament, edition: 'blank' }, schedule);
    expect(leer.pages[0].texts.map(trimmed)).toContain('Spielplan zum Ausfüllen');

    const mit = await layoutOf({ tournament, edition: 'plan' }, schedule);
    expect(mit.pages[0].texts.map(trimmed)).toContain('Spielplan');
    expect(mit.pages[0].texts.map(trimmed)).not.toContain('Spielplan zum Ausfüllen');
    expect(leer.pages[0].texts.map(trimmed)).not.toContain('Spielplan');
  });

  it('W3 ohne Wahl der Fassung und ohne Ergebnisse bleibt es beim „Spielplan“, die Vorlage kommt nur auf ausdrückliche Wahl', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament, includeScores: false }, hallencupSchedule(tournament));

    expect(pages[0].texts.map(trimmed)).toContain('Spielplan');
    expect(pages[0].texts.map(trimmed)).not.toContain('Spielplan zum Ausfüllen');
  });
});

describe('Punkt 5 Kopf nach v7.2 (Daniel 15.10.)', () => {
  it('Angabentabelle: Bezeichnungen und Werte stehen in 10,5 pt (B-28a3-4G Punkt 1)', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const bezeichnungen = ['Veranstalter', 'Altersklasse', 'Halle', 'Termin', 'Modus', 'Wertung', 'Spielzeit', 'Regelwerk'];
    const kopf = pages[0].texts.filter(t => t.y < 90 && t.str.trim() !== '');
    const stellen = [...bezeichnungen, 'D-Junioren'].map(name => kopf.find(t => trimmed(t) === name));
    stellen.forEach((t, i) => expect(t, `Fundstelle ${i}`).toBeDefined());
    for (const t of kopf.filter(z => bezeichnungen.includes(trimmed(z)) || trimmed(z) === 'D-Junioren')) {
      expect(Math.abs(t.size - KOPF_PT), `„${t.str}“`).toBeLessThanOrEqual(SIZE_TOL);
    }
  });

  it('(b) der Turniername steht zentriert über die volle Seitenbreite (± 1 mm), jede Zeile', async () => {
    const tournament = hallencupMitRegelwerk({ title: LANGER_TITEL });
    const { pages, width } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const titelZeilen = pages[0].texts.filter(t => Math.abs(t.size - printType.title) <= SIZE_TOL);

    expect(titelZeilen.length).toBeGreaterThanOrEqual(1);
    for (const zeile of titelZeilen) {
      expect(Math.abs(zeile.x + zeile.w / 2 - width / 2), `„${zeile.str}“`).toBeLessThanOrEqual(1);
    }
  });

  it('(c) die Altersklasse steht als eigene Zeile „Altersklasse“ in der Angabentabelle, nicht neben dem Titel', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const bezeichnung = pages[0].texts.find(t => trimmed(t) === 'Altersklasse');
    const wert = pages[0].texts.find(t => trimmed(t) === 'D-Junioren');

    expect(bezeichnung, 'Bezeichnung Altersklasse').toBeDefined();
    expect(wert, 'Wert Altersklasse').toBeDefined();
    expect(Math.abs((wert?.y ?? 0) - (bezeichnung?.y ?? 0))).toBeLessThan(0.5);
    expect(Math.abs((bezeichnung?.size ?? 0) - KOPF_PT)).toBeLessThanOrEqual(SIZE_TOL);
  });

  it('Tabelle: Bezeichnungen fett, Werte normal, eine Schriftgröße, alle Werte in derselben Spalte', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const bezeichnungen = ['Veranstalter', 'Altersklasse', 'Halle', 'Termin', 'Modus', 'Wertung', 'Spielzeit', 'Regelwerk'];
    const kopf = pages[0].texts.filter(t => t.y < 90);
    const fett = await fettMap(kopf);
    const labels = bezeichnungen.map(name => kopf.find(t => trimmed(t) === name));
    labels.forEach((t, i) => {
      expect(t, bezeichnungen[i]).toBeDefined();
      expect(fett.get(t!), `„${bezeichnungen[i]}“ fett`).toBe(true);
      expect(Math.abs((t?.size ?? 0) - KOPF_PT)).toBeLessThanOrEqual(SIZE_TOL);
    });
    const unterkante = pages[0].texts.find(t => ohneNummer(t.str) === 'Teilnehmer')?.y ?? 90;
    const werte = kopf.filter(t => t.x > 30 && t.y < unterkante && t.str.trim() !== '' && !fett.get(t) && t.y > (labels[0]?.y ?? 0) && t.str.trim() !== QR_CAPTION);
    const linksKanten = new Set(werte.map(t => Math.round(t.x * 10)));
    expect(linksKanten.size, 'alle Werte beginnen in einer Spalte').toBe(1);
    werte.forEach(t => expect(Math.abs(t.size - KOPF_PT), `„${t.str}“`).toBeLessThanOrEqual(SIZE_TOL));
  });

  it('(d) die Angabentabelle bleibt links, die QR-Spalte rechts ist frei (auch bei umbrochenem Wert)', async () => {
    const tournament = hallencupMitRegelwerk();
    const langer = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921 e. V., Abteilung Hallenfußball mit Jugendmannschaften';
    const { pages } = await layoutOf({ tournament, organizerName: langer }, hallencupSchedule(tournament));
    expect(pages[0].texts.map(trimmed).filter(z => z.startsWith('Sportgemeinschaft') || z.includes('Jugendmannschaften')).length, 'Wert umbricht').toBeGreaterThanOrEqual(2);
    // Die QR-Spalte ist seit C4 Symbol plus Ruhezone (4 Module); die Angaben enden einen Spaltenabstand davor
    const qr = bboxOf(qrRects(pages[0]));
    const grenze = qr.x - (qr.w / expectedMatrix('ABC123').length) * printHeader.qrQuietModules - printHeader.qrColumnGap;
    const fett = await fettMap(pages[0].texts);
    const werte = pages[0].texts.filter(t => t.y > 25 && t.y < 90 && !fett.get(t) && t.str.trim() !== '' && t.size <= KOPF_PT + SIZE_TOL && t.str.trim() !== QR_CAPTION);

    expect(werte.length).toBeGreaterThan(0);
    werte.forEach(t => expect(t.x + t.w, `„${t.str}“`).toBeLessThanOrEqual(grenze + SIZE_TOL));
  });
});
