/**
 * B-28 C3 – Kennzeichen im Text: Abschnittsnummern (Daniel 15.10.), Kurzkopf der Folgeseiten (G8), „Uhrzeiten
 * voraussichtlich“ (W7, @DR-001 Zustand „voraussichtlich“). Nachweise am echten PDF (pdfjs).
 * Szenarien: @BM-052 (Kopf/Abschnitte), @DR-002 (Folgeseiten), @DR-001.
 */
import { describe, expect, it } from 'vitest';
import { generateFullSchedule, type GeneratedSchedule } from '../../../core/generators';
import { printGap, printLimits, printType } from '../../../design-tokens/print';
import { pageGeometry } from '../layout';
import type { MatchStatus } from '../../../types/tournament';
import type { StatefulMatch, StatefulSchedule } from '../tournamentState';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { dreissigSchedule, layoutOf, pageText } from './pdfFixtureLayout';
import type { LayoutPage } from './pdfjsLayout';

const NOW = new Date(2026, 10, 14, 15, 7);

const strings = (page: LayoutPage): string[] => page.texts.map(t => t.str);
/** Abschnittstitel (13 pt fett) einer Seite. */
const titel = (page: LayoutPage): string[] => page.texts.filter(t => Math.abs(t.size - printType.h2) < 0.05 || Math.abs(t.size - printType.caption) < 0.05).map(t => t.str);

/** Plan, dessen Gruppenspiele alle (oder keines) im Zustand `status` stehen, wie der Dialog sie einmischt. */
function mitGruppenstatus(schedule: GeneratedSchedule, status: MatchStatus | undefined, nur?: number): StatefulSchedule {
  const merge = <M extends { phase?: string; matchNumber: number }>(m: M): M =>
    m.phase === 'groupStage' && status !== undefined && (nur === undefined || m.matchNumber <= nur)
      ? { ...m, matchStatus: status, scoreA: 1, scoreB: 0 }
      : m;
  return {
    ...schedule,
    allMatches: schedule.allMatches.map(merge),
    phases: schedule.phases.map(p => ({ ...p, matches: p.matches.map(merge) })),
  };
}

describe('Abschnittsnummern: fortlaufend über die vorhandenen Abschnitte', () => {
  it('alle fünf Abschnitte: 1 Teilnehmer, 2 Gruppenphase, 3 Tabellen, 4 Finalrunde, 5 Platzierung', async () => {
    const { pages } = await layoutOf({ now: NOW });

    expect(strings(pages[0])).toEqual(expect.arrayContaining(['1 Teilnehmer', '2 Gruppenphase']));
    expect(strings(pages[1])).toContain('3 Tabelle – Gruppe A');
    // nur der erste Titel eines Abschnitts trägt die Nummer
    expect(strings(pages[1])).toContain('Tabelle – Gruppe B');
    expect(strings(pages[2])).toEqual(expect.arrayContaining(['4 Halbfinale', 'Spiel um Platz 3', 'Finale', '5 Platzierung']));
  });

  it('ein Abschnitt fehlt (keine Tabellen): die Zählung rückt auf, ohne Lücke', async () => {
    const { pages } = await layoutOf({ now: NOW, includeStandings: false });
    const alle = pages.flatMap(strings);

    expect(alle).toEqual(expect.arrayContaining(['1 Teilnehmer', '2 Gruppenphase', '3 Halbfinale', '4 Platzierung']));
    expect(alle.some(s => s.startsWith('5 '))).toBe(false);
    expect(alle.some(s => s.startsWith('3 Tabelle'))).toBe(false);
  });

  it('ein Abschnitt fehlt (keine Finalrunde): Tabellen sind 3, Platzierung 4', async () => {
    const ohneFinale = generateFullSchedule(
      hallencupTournament({ finalsConfig: { preset: 'none' }, finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false } }),
      'de'
    );
    const alle = (await layoutOf({ now: NOW }, ohneFinale)).pages.flatMap(strings);

    expect(alle).toEqual(expect.arrayContaining(['1 Teilnehmer', '2 Gruppenphase', '3 Tabelle – Gruppe A', '4 Platzierung']));
    expect(alle.some(s => /^[56] /.test(s))).toBe(false);
  });

  it('Jeder gegen jeden: Abschnitt „Spiele“ trägt die Nummer 2, „Gruppenphase“ kommt nicht vor', async () => {
    const teams = hallencupTournament().teams.map(team => ({ ...team, group: undefined }));
    const tournament = hallencupTournament({ teams, groupSystem: 'roundRobin' });
    const alle = (await layoutOf({ now: NOW, tournament }, generateFullSchedule(tournament, 'de'))).pages.flatMap(page => page.texts.map(t => t.str.trim()));

    expect(alle).toEqual(expect.arrayContaining(['1 Teilnehmer', '2 Spiele']));
    expect(alle.some(s => s.includes('Gruppenphase'))).toBe(false);
  });

  it('Gegenbeispiel: ein Titel trägt die Nummer genau einmal (keine „3 3 …“, keine Nummer an Folgetiteln)', async () => {
    const { pages } = await layoutOf({ now: NOW });
    const alle = pages.flatMap(strings);

    expect(alle.filter(s => /^\d+ \d+ /.test(s))).toEqual([]);
    const titel2 = pages.flatMap(titel);
    expect(titel2.filter(s => s === 'Teilnehmer' || s === 'Gruppenphase' || s === 'Platzierung')).toEqual([]);
  });
});

describe('G8 Kurzkopf der Folgeseiten: Titel · Altersklasse · Datum · Abschnittsname', () => {
  /** Untertitel des Kurzkopfs: 10,5 pt auf der Untertitel-Grundlinie unter dem einzeiligen Titel. */
  const kurzkopf = (page: LayoutPage): string | undefined => {
    const grundlinie = pageGeometry('a4', 'portrait').top + printGap.shortHeadSubBaseline;
    return page.texts.find(t => Math.abs(t.size - printType.subtitle) < 0.05 && Math.abs(t.y - grundlinie) < 0.05)?.str;
  };

  it('Tabellen- und Finalseite nennen ihren Abschnitt', async () => {
    const { pages } = await layoutOf({ now: NOW });

    expect(kurzkopf(pages[1])).toBe('D-Junioren · 14.11.2026 · Tabellen');
    expect(kurzkopf(pages[2])).toBe('D-Junioren · 14.11.2026 · Finalrunde');
  });

  it('Seite 1 trägt keinen Kurzkopf; die Folgeseite einer langen Spieltabelle nennt die Gruppenphase', async () => {
    const { pages } = await layoutOf({ now: NOW }, dreissigSchedule());

    expect(kurzkopf(pages[0])).toBeUndefined();
    expect(kurzkopf(pages[1])).toBe('D-Junioren · 14.11.2026 · Gruppenphase');
  });

  it('Gegenbeispiel: ohne Datum und ohne Altersklasse bleibt nur der Abschnitt, ohne leere Trenner', async () => {
    const tournament = hallencupTournament({ date: '', ageClass: '' });
    const { pages } = await layoutOf({ now: NOW, tournament }, generateFullSchedule(tournament, 'de'));

    expect(kurzkopf(pages[1])).toBe('Tabellen');
  });
});

describe('W7 „Uhrzeiten voraussichtlich“ in der Finalrunde, solange die Gruppenphase läuft', () => {
  const NOTE = 'Uhrzeiten voraussichtlich';

  it('Gruppenphase offen: jede Runden-Überschrift trägt den Hinweis, mindestens 7,5 pt', async () => {
    const { pages } = await layoutOf({ now: NOW }, mitGruppenstatus(hallencupSchedule(), undefined));
    const hinweise = pages[2].texts.filter(t => t.str === NOTE);

    expect(hinweise).toHaveLength(3);
    hinweise.forEach(t => expect(t.size).toBeGreaterThanOrEqual(printLimits.minFontPt));
  });

  it('Gruppenphase abgeschlossen (alle beendet): kein Hinweis auf keiner Seite', async () => {
    const { pages } = await layoutOf({ now: NOW }, mitGruppenstatus(hallencupSchedule(), 'finished'));

    pages.forEach(page => expect(pageText(page)).not.toContain(NOTE));
  });

  it('Gruppenphase abgeschlossen, ein Spiel ausgefallen: kein Hinweis (es wird nicht mehr gespielt)', async () => {
    const plan = mitGruppenstatus(hallencupSchedule(), 'finished');
    plan.phases.forEach(p => (p.matches as StatefulMatch[]).forEach(m => { if (m.matchNumber === 5) { m.matchStatus = 'skipped'; } }));
    const { pages } = await layoutOf({ now: NOW }, plan);

    pages.forEach(page => expect(pageText(page)).not.toContain(NOTE));
  });

  it('Gegenbeispiel: ein Gruppenspiel fehlt noch (11 von 12 beendet) → Hinweis steht', async () => {
    const { pages } = await layoutOf({ now: NOW }, mitGruppenstatus(hallencupSchedule(), 'finished', 11));

    expect(pages[2].texts.filter(t => t.str === NOTE).length).toBeGreaterThan(0);
  });

  it('Gegenbeispiel: ein laufendes Spiel zählt nicht als abgeschlossen', async () => {
    const { pages } = await layoutOf({ now: NOW }, mitGruppenstatus(hallencupSchedule(), 'running'));

    expect(pages[2].texts.filter(t => t.str === NOTE).length).toBeGreaterThan(0);
  });

  it('Gegenbeispiel: die Gruppenphase selbst und die Titel der Gruppenspiele tragen den Hinweis nie', async () => {
    const { pages } = await layoutOf({ now: NOW }, mitGruppenstatus(hallencupSchedule(), undefined));

    expect(titel(pages[0])).not.toContain(NOTE);
    expect(pageText(pages[0])).not.toContain(NOTE);
  });

  it('F2 Fassung final und abgeschlossenes Turnier: kein Hinweis, auch wenn Gruppenspiele keinen Status tragen', async () => {
    const offen = mitGruppenstatus(hallencupSchedule(), undefined);
    for (const extra of [{ edition: 'final' as const }, { closed: true }]) {
      const { pages } = await layoutOf({ now: NOW, ...extra }, offen);
      pages.forEach(page => expect(pageText(page)).not.toContain(NOTE));
    }
  });

  it('F2 Gegenbeispiel: Fassung Spielplan und zum Ausfüllen mit offener Gruppenphase tragen den Hinweis weiter', async () => {
    for (const edition of ['plan', 'blank'] as const) {
      const { pages } = await layoutOf({ now: NOW, edition }, mitGruppenstatus(hallencupSchedule(), undefined));
      expect(pages[2].texts.some(t => t.str === NOTE)).toBe(true);
    }
  });
});
