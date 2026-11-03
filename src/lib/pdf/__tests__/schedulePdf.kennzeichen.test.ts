/**
 * B-28 C3 – Kennzeichen im Text: Abschnitte ohne Nummern (Mockup-Runde 2), Kurzkopf der Folgeseiten (G8), „Uhrzeiten
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
/** Textstücke in der Größe eines Abschnittstitels (13 pt, 11,5 pt) einer Seite. */
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

describe('Abschnitte nach den Gruppenspielen: Tabellen, Finalrunde, Platzierung ohne Nummern (@DR-002, Mockup-Runde 2)', () => {
  /** Seitenindex, auf dem der Text als eigenes Textstück vorkommt; −1, wenn er fehlt. */
  const seiteVon = (pages: LayoutPage[], text: string): number => pages.findIndex(page => strings(page).some(s => s.trim() === text));

  it('Tabellen auf einer neuen Seite, danach Finalrunde und Platzierung in dieser Reihenfolge; keine Titel „Teilnehmer“, „Gruppenphase“, „Spiele“ und keine Nummern', async () => {
    const { pages } = await layoutOf({ now: NOW });
    const alle = pages.flatMap(strings).map(s => s.trim());

    expect(strings(pages[0]).filter(s => /^\d+ (Teilnehmer|Gruppenphase|Spiele)$/.test(s))).toEqual([]);
    expect(seiteVon(pages, 'Gruppe A')).toBeGreaterThan(0);
    expect(seiteVon(pages, 'Gruppe A')).toBeLessThanOrEqual(seiteVon(pages, 'HALBFINALE'));
    expect(seiteVon(pages, 'HALBFINALE')).toBeLessThanOrEqual(seiteVon(pages, 'Platzierung'));
    expect(alle.filter(s => /^\d+ (Tabelle|Halbfinale|Platzierung|Tabellen|Finalrunde)/.test(s))).toEqual([]);
  });

  it('ohne Tabellen: Finalrunde auf einer neuen Seite, keine Tabelle, keine „Tabelle –“-Titel', async () => {
    const { pages } = await layoutOf({ now: NOW, includeStandings: false });
    const alle = pages.flatMap(strings);

    expect(seiteVon(pages, 'HALBFINALE')).toBeGreaterThan(0);
    expect(seiteVon(pages, 'Platzierung')).toBeGreaterThanOrEqual(seiteVon(pages, 'HALBFINALE'));
    expect(alle.some(s => s.includes('Tabelle –'))).toBe(false);
    expect(alle).not.toContain('Gruppe A');
  });

  it('ohne Finalrunde: Tabellen, darunter die Platzierung', async () => {
    const ohneFinale = generateFullSchedule(
      hallencupTournament({ finalsConfig: { preset: 'none' }, finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false } }),
      'de'
    );
    const { pages } = await layoutOf({ now: NOW }, ohneFinale);

    expect(seiteVon(pages, 'Gruppe A')).toBeGreaterThan(0);
    expect(seiteVon(pages, 'Platzierung')).toBe(seiteVon(pages, 'Gruppe A'));
    expect(pages.flatMap(strings).some(s => s.includes('FINALE'))).toBe(false);
  });

  it('Jeder gegen jeden: eine Tabelle „Team“, dann die Platzierung; weder „Gruppenphase“ noch „Spiele“ als Titel', async () => {
    const teams = hallencupTournament().teams.map(team => ({ ...team, group: undefined }));
    const tournament = hallencupTournament({ teams, groupSystem: 'roundRobin' });
    const { pages } = await layoutOf({ now: NOW, tournament }, generateFullSchedule(tournament, 'de'));
    const alle = pages.flatMap(page => page.texts.map(t => t.str.trim()));

    expect(alle).toContain('Team');
    expect(alle).toContain('Platzierung');
    expect(alle.some(s => s.includes('Gruppenphase'))).toBe(false);
  });
});

describe('G8 Kurzkopf der Folgeseiten: Titel · Altersklasse · Datum · Abschnittsname', () => {
  /** Untertitel des Kurzkopfs: 10,5 pt auf der Untertitel-Grundlinie unter dem einzeiligen Titel. */
  const kurzkopf = (page: LayoutPage): string | undefined => {
    const grundlinie = pageGeometry('a4', 'portrait').top + printGap.shortHeadSubBaseline;
    return page.texts.find(t => Math.abs(t.size - printType.subtitle) < 0.05 && Math.abs(t.y - grundlinie) < 0.05)?.str;
  };

  it('die Seite der Tabellen nennt ihren Abschnitt, die Seite der Finalrunde ihren (ohne Tabellen)', async () => {
    const { pages } = await layoutOf({ now: NOW });

    expect(kurzkopf(pages[1])).toBe('D-Junioren · 14.11.2026 · Tabellen');
    const ohneTabellen = await layoutOf({ now: NOW, includeStandings: false });
    expect(kurzkopf(ohneTabellen.pages[1])).toBe('D-Junioren · 14.11.2026 · Finalrunde');
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
    const hinweise = pages[1].texts.filter(t => t.str === NOTE);

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

    expect(pages[1].texts.filter(t => t.str === NOTE).length).toBeGreaterThan(0);
  });

  it('Gegenbeispiel: ein laufendes Spiel zählt nicht als abgeschlossen', async () => {
    const { pages } = await layoutOf({ now: NOW }, mitGruppenstatus(hallencupSchedule(), 'running'));

    expect(pages[1].texts.filter(t => t.str === NOTE).length).toBeGreaterThan(0);
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
      expect(pages[1].texts.some(t => t.str === NOTE)).toBe(true);
    }
  });
});
