/**
 * B-28 C4 – Platzierung ohne Finalrunde beginnt keine eigene Seite (Daniel 15.10., @DR-009): sie steht direkt unter
 * der Tabelle, wenn sie auf die Seite passt. Mit Finalrunde beginnt die Finalrunde weiter auf einer eigenen Seite.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { HALLENCUP_TEAMS, hallencupTournament } from './pdfFixture';
import { ohneNummer } from './pdfFixtureLayout';
import { kopfPdf } from './pdfKopfSupport';
import type { LayoutPage } from './pdfjsLayout';

/** Seite der Überschrift (die letzte mit dem Wort als eigenem Textstück; „Platzierung“ steht auch als Bezeichnung im Kopf). */
const pageOf = (pages: LayoutPage[], title: string): number => pages.map(p => p.texts.some(t => ohneNummer(t.str) === title)).lastIndexOf(true);

function jederGegenJeden(count: number) {
  const teams: Team[] = Array.from({ length: count }, (_, i) => ({ id: `t${i}`, name: `Team ${String.fromCharCode(65 + i)}`, group: undefined }));
  const tournament = hallencupTournament({ teams, numberOfTeams: count, groupSystem: 'roundRobin', numberOfGroups: 1 });
  return { tournament, schedule: generateFullSchedule(tournament, 'de') };
}

describe('@DR-009 Platzierung unter der Tabelle', () => {
  it('Jeder gegen jeden mit 5 Teams: Spiele und Platzierung auf derselben Seite, ein Blatt', async () => {
    const { tournament, schedule } = jederGegenJeden(5);
    const { pages } = await kopfPdf({}, tournament, schedule);

    expect(pageOf(pages, 'Platzierung')).toBe(pageOf(pages, 'Spiele'));
    expect(pages).toHaveLength(1);
  });

  it('Gruppen ohne Finalrunde (preset none): Platzierung direkt unter den Tabellen, nicht auf einer eigenen Seite', async () => {
    const tournament = hallencupTournament({
      finalsConfig: { preset: 'none' },
      finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    });
    const { pages } = await kopfPdf({}, tournament, generateFullSchedule(tournament, 'de'));
    const tabellen = pages.map((p, i) => (p.texts.some(t => ohneNummer(t.str).startsWith('Tabelle')) ? i : -1)).filter(i => i >= 0);

    expect(pageOf(pages, 'Platzierung')).toBe(Math.max(...tabellen));
  });

  it('Gegenbeispiel: passt die Platzierung nicht mehr auf die Seite, folgt sie auf der nächsten', async () => {
    const { tournament, schedule } = jederGegenJeden(12);
    const { pages } = await kopfPdf({}, tournament, schedule);
    expect(pageOf(pages, 'Platzierung')).toBeGreaterThan(pageOf(pages, 'Spiele'));
  });

  it('Gegenbeispiel: mit Finalrunde beginnt die Finalrunde auf einer eigenen Seite, die Platzierung folgt dort', async () => {
    const { pages } = await kopfPdf();
    const finale = pageOf(pages, 'Halbfinale');

    expect(finale).toBeGreaterThan(pageOf(pages, 'Gruppenphase'));
    expect(pages[finale].texts.some(t => ohneNummer(t.str) === 'Gruppenphase')).toBe(false);
    expect(pageOf(pages, 'Platzierung')).toBe(finale);
    expect(HALLENCUP_TEAMS.length).toBeGreaterThan(0);
  });
});
