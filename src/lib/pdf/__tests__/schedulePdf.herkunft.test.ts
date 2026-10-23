/**
 * B-28 C4 – Herkunft offener Plätze wird nie roh gedruckt (Befund Zuschauer-Zuordnung Punkt 2; @DR-001 Ausnahmeliste,
 * @BM-032): „group-a-2nd“ wird „Zweiter Gruppe A“, „semi1-winner“ wird „Sieger Halbfinale 1“, in der Sprache des Dokuments.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { sideLabel } from '../matchSides';
import { originLabel } from '../origin';
import { buildPdfTexts } from '../translations';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { kopfPdf } from './pdfKopfSupport';
import { translatorFor } from './pdfText';
import { squash } from './pdfjsText';
import { testUuid } from '../../../test/testIds';
import { storedSchedule } from './storedSchedule';

const de = buildPdfTexts(translatorFor('de'), 'de');
const en = buildPdfTexts(translatorFor('en'), 'en');
const RAW = /group-|-winner|-loser|\bsemi\d|\bqf\d|\br16-|winner-|loser-/i;

/** Setzt die Seiten der Finalspiele auf Rohschlüssel (so kommen sie ohne die Übersetzung des Generators an). */
function mitRohschluesseln(schedule: GeneratedSchedule, keys: Array<[string, string]>): GeneratedSchedule {
  const finals = schedule.phases.filter(p => p.name !== 'groupStage').flatMap(p => p.matches);
  finals.forEach((match, i) => {
    const [home, away] = keys[i % keys.length];
    match.homeTeam = home;
    match.awayTeam = away;
    match.originalTeamA = home;
    match.originalTeamB = away;
  });
  return schedule;
}

describe('originLabel (rein)', () => {
  it.each([
    ['group-a-1st', 'Erster Gruppe A'],
    ['group-b-2nd', 'Zweiter Gruppe B'],
    ['GROUP-C-3RD', 'Dritter Gruppe C'],
    ['Group-d-4th', 'Vierter Gruppe D'],
    ['semi1-winner', 'Sieger Halbfinale 1'],
    ['semi2-loser', 'Verlierer Halbfinale 2'],
    ['qf3-winner', 'Sieger Viertelfinale 3'],
    ['qf4-loser', 'Verlierer Viertelfinale 4'],
    ['r16-5-winner', 'Sieger Achtelfinale 5'],
    ['winner-sf-1', 'Sieger Halbfinale 1'],
    ['loser-qf-2', 'Verlierer Viertelfinale 2'],
  ])('DE: %s → %s', (raw, label) => {
    expect(originLabel(raw, de)).toBe(label);
  });

  it.each([
    ['group-a-2nd', '2nd in Group A'],
    ['semi1-winner', 'Winner Semi-final 1'],
  ])('EN: %s → %s', (raw, label) => {
    expect(originLabel(raw, en)).toBe(label);
  });

  it('jeder Schlüssel der Generator-Muster ergibt Klartext ohne Rohbestandteil', () => {
    const keys = [
      ...'abcdefgh'.split('').flatMap(g => ['1st', '2nd', '3rd', '4th'].map(p => `group-${g}-${p}`)),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => `r16-${n}-winner`),
      ...[1, 2, 3, 4].flatMap(n => [`qf${n}-winner`, `qf${n}-loser`]),
      ...[1, 2].flatMap(n => [`semi${n}-winner`, `semi${n}-loser`]),
    ];

    keys.forEach(key => {
      expect(originLabel(key, de), key).not.toMatch(RAW);
      expect(originLabel(key, en), key).not.toMatch(RAW);
    });
  });

  it('Gegenbeispiel: Teamnamen und Nicht-Schlüssel bleiben unverändert', () => {
    for (const name of ['FC Nord', 'SV Süd 1921', 'group-a', 'semi-winner-club']) {
      expect(originLabel(name, de), name).toBe(name);
    }
  });
});

describe('Herkunft im PDF', () => {
  it('rohe Schlüssel der Finalspiele erscheinen als Klartext, nie roh', async () => {
    const schedule = mitRohschluesseln(hallencupSchedule(), [['group-a-1st', 'group-B-2nd'], ['semi1-winner', 'semi2-winner'], ['semi1-loser', 'semi2-loser']]);
    const { pages } = await kopfPdf({}, hallencupTournament(), schedule);
    const text = squash(pages.flatMap(p => p.texts.map(t => t.str)).join(' '));

    expect(text).toContain(squash('Erster Gruppe A'));
    expect(text).toContain(squash('Zweiter Gruppe B'));
    expect(text).toContain(squash('Sieger Halbfinale 1'));
    expect(text).toContain(squash('Verlierer Halbfinale 2'));
    expect(text).not.toMatch(/group-|-winner|-loser/i);
  });

  it('EN-Dokument: englischer Klartext', async () => {
    const schedule = mitRohschluesseln(hallencupSchedule(), [['group-a-1st', 'group-b-2nd'], ['semi1-winner', 'semi2-winner']]);
    const { pages } = await kopfPdf({ locale: 'en', translate: translatorFor('en') }, hallencupTournament(), schedule);
    const text = squash(pages.flatMap(p => p.texts.map(t => t.str)).join(' '));

    expect(text).toContain(squash('1st in Group A'));
    expect(text).toContain(squash('Winner Semi-final 1'));
    expect(text).not.toMatch(/group-|-winner|-loser/i);
  });

  it.each([
    ['top-4', 8],
    ['top-8', 16],
    ['top-16', 32],
  ])('Muster %s: kein Rohschlüssel im ganzen Dokument', async (preset, teamCount) => {
    const groups = teamCount / 4;
    const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({ id: testUuid(i), name: `Verein ${String(i + 1).padStart(2, '0')}`, group: 'ABCDEFGH'[Math.floor(i / 4)] }));
    const tournament = hallencupTournament({ teams, numberOfTeams: teamCount, numberOfGroups: groups, finalsConfig: { preset, tiebreaker: 'shootout' } as never });
    // ab 3 Gruppen seit A-12a nur noch als gespeichertes Turnier (Lesepfad), der Generator legt es nicht mehr an
    const schedule = groups > 2 ? storedSchedule(tournament, 'de') : generateFullSchedule(tournament, 'de');
    const { pages } = await kopfPdf({}, tournament, schedule);
    const text = pages.flatMap(p => p.texts.map(t => t.str)).join(' ');

    expect(text).not.toMatch(/group-|-winner|-loser|\bsemi\d|\bqf\d|\br16-/i);
  });
});

describe('@DR-022 @DR-001 echter Generator: Herkunft aus dem Rohschlüssel, in der Sprache des Dokuments', () => {
  it('DE: „Erster Gruppe A“, „Sieger Halbfinale 1“; kein „Gruppe A - 2. Platz“, kein „HF“', async () => {
    const tournament = hallencupTournament();
    const { pages } = await kopfPdf({}, tournament, generateFullSchedule(tournament));
    const text = pages.flatMap(p => p.texts.map(t => t.str)).join(' ');

    expect(squash(text)).toContain(squash('Erster Gruppe A'));
    expect(squash(text)).toContain(squash('Zweiter Gruppe B'));
    expect(squash(text)).toContain(squash('Sieger Halbfinale 1'));
    expect(squash(text)).toContain(squash('Verlierer Halbfinale 2'));
    expect(text).not.toMatch(/Gruppe [A-Z] - \d\. Platz/);
    expect(text).not.toMatch(/\bHF\b/);
  });

  it('EN: englische Herkunft, kein deutsches Wort, kein „HF“', async () => {
    const tournament = hallencupTournament();
    const { pages } = await kopfPdf({ locale: 'en', translate: translatorFor('en') }, tournament, generateFullSchedule(tournament));
    const text = pages.flatMap(p => p.texts.map(t => t.str)).join(' ');

    expect(squash(text)).toContain(squash('1st in Group A'));
    expect(squash(text)).toContain(squash('Winner Semi-final 1'));
    expect(text).not.toMatch(/Gruppe|Sieger|Verlierer|\bHF\b|Platz\b/);
  });

  it('eigene Gruppennamen bleiben erhalten: „Erster Löwen“', async () => {
    const tournament = hallencupTournament({ groups: [{ id: 'A', customName: 'Löwen' }, { id: 'B', customName: 'Tiger' }] });
    const { pages } = await kopfPdf({}, tournament, generateFullSchedule(tournament));
    const text = squash(pages.flatMap(p => p.texts.map(t => t.str)).join(' '));

    expect(text).toContain(squash('Erster Löwen'));
    expect(text).toContain(squash('Zweiter Tiger'));
  });

  it('Gegenbeispiel: ein besetztes Spiel zeigt den Teamnamen, nicht die Herkunft', () => {
    const match = hallencupSchedule().allMatches.find(m => m.originA?.kind === 'groupRank' && m.originA.group === 'A' && m.originA.rank === 1);
    expect(match).toBeDefined();
    const besetzt = { ...match!, homeTeam: 'FC Nord' };

    expect(sideLabel(besetzt, 'A', { t: de, isTeam: name => name === 'FC Nord' })).toBe('FC Nord');
    expect(sideLabel(match!, 'A', { t: de, isTeam: name => name === 'FC Nord' })).toBe('Erster Gruppe A');
  });
});
