/**
 * B-28 C4 – Herkunft offener Plätze wird nie roh gedruckt (Befund Zuschauer-Zuordnung Punkt 2; @DR-001 Ausnahmeliste,
 * @BM-032): „group-a-2nd“ wird „Zweiter Gruppe A“, „semi1-winner“ wird „Sieger Halbfinale 1“, in der Sprache des Dokuments.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { originLabel } from '../origin';
import { buildPdfTexts } from '../translations';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { kopfPdf } from './pdfKopfSupport';
import { translatorFor } from './pdfText';
import { squash } from './pdfjsText';

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

  it('Gegenbeispiel: Teamnamen und bereits übersetzte Herkunft bleiben unverändert', () => {
    for (const name of ['FC Nord', 'SV Süd 1921', 'Gruppe A - 2. Platz', 'Sieger HF 1', 'group-a', 'semi-winner-club']) {
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
    const teams: Team[] = Array.from({ length: teamCount }, (_, i) => ({ id: `t${i}`, name: `Verein ${String(i + 1).padStart(2, '0')}`, group: 'ABCDEFGH'[Math.floor(i / 4)] }));
    const tournament = hallencupTournament({ teams, numberOfTeams: teamCount, numberOfGroups: groups, finalsConfig: { preset, tiebreaker: 'shootout' } as never });
    const { pages } = await kopfPdf({}, tournament, generateFullSchedule(tournament, 'de'));
    const text = pages.flatMap(p => p.texts.map(t => t.str)).join(' ');

    expect(text).not.toMatch(/group-|-winner|-loser|\bsemi\d|\bqf\d|\br16-/i);
  });
});
