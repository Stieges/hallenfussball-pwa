/**
 * B-28a3-3b: Kopf Seite 1 mit Regelzeilen, Kurzkopf auf jeder Folgeseite (K3), K.-o.-Zeile über der Finalrunde,
 * Teilnehmer als Zeilen, Teamnamen mindestens 12 pt, keine Schiedsrichter-Spalte. Gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @DR-001, @DR-002, @DR-006, @DR-007, @DR-015, @DR-020, @BM-009, @BM-021, @BM-052.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import { printColumns, printLimits } from '../../../design-tokens/print';
import type { PlacementCriterion, Team, Tournament } from '../../../types/tournament';
import { HALLENCUP_TEAMS, hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf } from './pdfFixtureLayout';
import { pageGeometry } from '../layout';
import type { LayoutPage, LayoutText } from './pdfjsLayout';
import { squash } from './pdfjsText';

const BFV = 'BFV-Richtlinien für Futsal und private Hallenturniere';
const LONG_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
/** Toleranz für die Größe, die pdfjs aus der Textmatrix liest. */
const SIZE_TOL = 0.05;

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
  id: `team-${i + 1}`,
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
  return pages.findIndex(page => page.texts.some(t => trimmed(t) === text));
}

describe('@DR-006 Kopf Seite 1: Regelzeilen unter den Turnierdaten', () => {
  it('Modus, Platzierung, Spielzeit und Regelwerk stehen auf Seite 1 in dieser Reihenfolge', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const zeilen = pages[0].texts.map(trimmed);

    const reihe = [
      'Modus: Gruppen + Finals',
      'Platzierung: Punkte – Tordifferenz – Tore – direkter Vergleich',
      'Spielzeit: 10 Min. · Zeitstrafe 2 Min.',
      `Regelwerk: ${BFV}`,
    ];
    const stellen = reihe.map(zeile => zeilen.indexOf(zeile));
    stellen.forEach((stelle, i) => expect(stelle, reihe[i]).toBeGreaterThanOrEqual(0));
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen);
  });

  it('@DR-007 Gegenbeispiel: ohne eingetragenes Regelwerk erscheint keine Zeile „Regelwerk“', async () => {
    const tournament = hallencupTournament({ title: 'Hallencup Ost', placementLogic: PLACEMENT });
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));

    expect(pages[0].texts.map(trimmed).some(zeile => zeile.startsWith('Regelwerk'))).toBe(false);
  });
});

describe('@DR-015 K.-o.-Zeile über der Finalrunde', () => {
  it('Die Entscheidung im K.-o.-Spiel steht als eine Zeile auf der Finalseite, vor den Finalspielen', async () => {
    const tournament = hallencupMitRegelwerk({ finalsConfig: { preset: 'top-4', tiebreaker: 'shootout' } });
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const seite = findPage(pages, 'Finalspiele');
    expect(seite, 'Finalseite').toBeGreaterThan(0);

    const ko = pages[seite].texts.find(t => trimmed(t) === 'K.-o.: bei Gleichstand Strafstoßschießen, 5 Schützen');
    const titel = pages[seite].texts.find(t => trimmed(t) === 'Finalspiele');
    expect(ko, 'K.-o.-Zeile auf der Finalseite').toBeDefined();
    expect(ko && titel ? ko.y : 0).toBeLessThan(titel?.y ?? 0);
  });
});

describe('Kopf: Titel und Angaben überlappen sich nicht', () => {
  it('die erste Angabe steht mindestens 5,5 mm unter der Grundlinie des Titels (Unterlängen frei)', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const titel = pages[0].texts.find(t => trimmed(t) === 'Hallencup Nord');
    const angabe = pages[0].texts.find(t => trimmed(t) === 'Veranstalter:');

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
      return text.length >= 3 && NAMEN.some(name => name.includes(text));
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
    const tabelle = pages.find(page => page.texts.some(t => trimmed(t) === 'Tabelle – Gruppe A'));
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
  it('Teilnehmer stehen als Zeilen je Gruppe: „1. DJK Berg“ und die weiteren Namen folgen im selben Abschnitt', async () => {
    const tournament = hallencupMitRegelwerk();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const seite1 = squash(pages[0].texts.map(trimmed).join(' '));

    expect(seite1).toContain(squash('Gruppe A'));
    expect(seite1).toContain(squash('1. DJK Berg'));
    expect(seite1).toContain(squash('2. FC Nord'));
  });

  it('keine Spalte und kein Text „Schiedsrichter“ oder „SR“, auch wenn Schiedsrichter eingeteilt sind', async () => {
    const tournament = hallencupMitRegelwerk({ refereeConfig: { mode: 'organizer', numberOfReferees: 2 } });
    const schedule = hallencupSchedule(tournament);
    expect(schedule.allMatches.some(m => m.referee !== undefined), 'Schiedsrichter sind eingeteilt').toBe(true);

    const { pages } = await layoutOf({ tournament }, schedule);
    for (const page of pages) {
      for (const t of page.texts) {
        expect(trimmed(t)).not.toMatch(/^SR\d*$/);
        expect(trimmed(t)).not.toContain('Schiedsrichter');
      }
    }
  });
});

describe('@BM-052 Kicker', () => {
  it('ohne Ergebnisse steht „Spielplan zum Ausfüllen“ im Kopf, mit Ergebnissen „Spielplan“', async () => {
    const tournament = hallencupMitRegelwerk();
    const schedule = hallencupSchedule(tournament);

    const leer = await layoutOf({ tournament, includeScores: false }, schedule);
    expect(leer.pages[0].texts.map(trimmed)).toContain('Spielplan zum Ausfüllen');

    const mit = await layoutOf({ tournament, includeScores: true }, schedule);
    expect(mit.pages[0].texts.map(trimmed)).toContain('Spielplan');
  });
});
