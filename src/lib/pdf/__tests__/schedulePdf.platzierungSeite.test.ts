/**
 * B-28 C4 – Platzierung ohne Finalrunde beginnt keine eigene Seite (Daniel 15.10., @DR-009): sie steht direkt unter
 * der Tabelle, wenn sie auf die Seite passt. Mit Finalrunde beginnt die Finalrunde weiter auf einer eigenen Seite.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { HALLENCUP_TEAMS, hallencupTournament } from './pdfFixture';
import { ohneNummer } from './pdfFixtureLayout';
import { pageGeometry } from '../layout';
import { printType } from '../../../design-tokens/print';
import { kopfPdf } from './pdfKopfSupport';
import type { LayoutPage } from './pdfjsLayout';
import type { RankEntry } from '../placement';

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

describe('@DR-009 Platzprüfung: die Platzierung bricht nie unter den Satzspiegel', () => {
  it.each([4, 5, 6, 7, 8, 9, 10, 11])('%s Teams: Überschrift, Satz und erste Zeile stehen auf einer Seite, über der Fußlinie', async count => {
    const { tournament, schedule } = jederGegenJeden(count);
    const { pages } = await kopfPdf({}, tournament, schedule);
    const geo = pageGeometry('a4', 'portrait');
    const index = pageOf(pages, 'Platzierung');
    const titel = pages[index].texts.find(t => ohneNummer(t.str) === 'Platzierung' && Math.abs(t.size - printType.h2) < 0.1);

    expect(titel).toBeDefined();
    expect(titel!.y).toBeLessThan(geo.bottom);
    const darunter = pages[index].texts.filter(t => t.y > titel!.y && t.y < geo.footRuleY);
    expect(darunter.some(t => t.str.startsWith('Die Platzierung')), 'Satz auf derselben Seite').toBe(true);
    expect(darunter.some(t => t.str.trim().startsWith('1.')), 'erste Zeile auf derselben Seite').toBe(true);
    pages[index].texts.filter(t => /^\d+\./.test(t.str.trim()) && t.y > titel!.y).forEach(t => expect(t.y, `„${t.str}“`).toBeLessThan(geo.footRuleY));
  });
});

describe('@DR-009 Abschlusstabelle bei Jeder gegen jeden in einer Gruppe ohne Finalrunde', () => {
  const heading = (pages: LayoutPage[], name: string) =>
    pages.flatMap(p => p.texts).find(t => ohneNummer(t.str) === name && Math.abs(t.size - printType.h2) < 0.1 || ohneNummer(t.str) === name && Math.abs(t.size - printType.caption) < 0.1);

  function ranking(count: number): RankEntry[] {
    const { tournament } = jederGegenJeden(count);
    return tournament.teams.map((team, i) => ({ place: count - i, team })).sort((a, b) => a.place - b.place);
  }

  it('nach dem Abschluss: „Abschlusstabelle“ mit allen Teams in Endstand-Reihenfolge, kein Block „Platzierung“', async () => {
    const { tournament, schedule } = jederGegenJeden(5);
    const { pages } = await kopfPdf({ edition: 'final', closed: true, closedAt: new Date('2026-11-14T16:40:00'), ranking: ranking(5) }, tournament, schedule);
    const texte = pages.flatMap(p => p.texts.map(t => t.str.trim()));

    expect(heading(pages, 'Abschlusstabelle')).toBeDefined();
    expect(heading(pages, 'Platzierung')).toBeUndefined();
    expect(texte.some(t => t.startsWith('Die Platzierung steht'))).toBe(false);
    const seite = pages.find(p => p.texts.some(t => ohneNummer(t.str) === 'Abschlusstabelle'));
    const tabelle = (seite?.texts ?? []).filter(t => /^Team [A-E]$/.test(t.str.trim()) && t.y > (heading(pages, 'Abschlusstabelle')?.y ?? 0));
    expect(tabelle.map(t => t.str.trim())).toEqual(['Team E', 'Team D', 'Team C', 'Team B', 'Team A']);
  });

  it('Gegenbeispiel: vor dem Abschluss bleibt der Block mit Schreiblinien, keine Abschlusstabelle', async () => {
    const { tournament, schedule } = jederGegenJeden(5);
    const { pages } = await kopfPdf({}, tournament, schedule);

    expect(heading(pages, 'Platzierung')).toBeDefined();
    expect(heading(pages, 'Abschlusstabelle')).toBeUndefined();
  });

  it('Gegenbeispiel: die Fassung zum Ausfüllen bleibt beim Block, auch mit Endstand', async () => {
    const { tournament, schedule } = jederGegenJeden(5);
    const { pages } = await kopfPdf({ edition: 'blank', closed: true, ranking: ranking(5) }, tournament, schedule);

    expect(heading(pages, 'Platzierung')).toBeDefined();
    expect(heading(pages, 'Abschlusstabelle')).toBeUndefined();
  });

  it('Gegenbeispiel: mehrere Gruppen ohne Finalrunde behalten den Block nach dem Abschluss', async () => {
    const tournament = hallencupTournament({ finalsConfig: { preset: 'none' }, finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false } });
    const rank = tournament.teams.map((team, i) => ({ place: i + 1, team }));
    const { pages } = await kopfPdf({ edition: 'final', closed: true, closedAt: new Date('2026-11-14T16:40:00'), ranking: rank }, tournament, generateFullSchedule(tournament, 'de'));

    expect(heading(pages, 'Platzierung')).toBeDefined();
    expect(heading(pages, 'Abschlusstabelle')).toBeUndefined();
  });

  it('Gegenbeispiel: mit Finalrunde bleibt der Block nach dem Abschluss', async () => {
    const rank = HALLENCUP_TEAMS.map((team, i) => ({ place: i + 1, team }));
    const { pages } = await kopfPdf({ edition: 'final', closed: true, closedAt: new Date('2026-11-14T16:40:00'), ranking: rank });

    expect(heading(pages, 'Platzierung')).toBeDefined();
    expect(heading(pages, 'Abschlusstabelle')).toBeUndefined();
  });
});
