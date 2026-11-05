/**
 * Fixrunde 2 zu PR #444: Auch im Spielplan mit Ergebnissen haben die Tabellen das graue Raster mit senkrechten Trennlinien zwischen
 * den Spalten, vor dem ersten Ergebnis wie danach; die Werte stehen in den Kästchen. Gemessen am fertigen PDF (pdfjs), Fall a (eine
 * Tabelle „Team“ auf Seite 2), deutsch.
 * Szenario: @DR-035 („Und auch im Spielplan mit Ergebnissen haben die Tabellen dieses graue Raster …“).
 */
import { describe, expect, it } from 'vitest';
import { printTableGrid } from '../../../design-tokens/print-sheet';
import { FALL_A, FALL_B, mitStandA, type HandzettelFall } from './fixtures/handzettelFaelle';
import { calculateStandingsPerGroup } from '../../../utils/calculations';
import { fallTournament } from './fixtures/handzettelTurnier';
import { handzettelPdf } from './handzettelPdf';
import type { LayoutLine, LayoutPage } from './pdfjsLayout';

const GRAU = `#${printTableGrid.color.map(v => v.toString(16).padStart(2, '0')).join('')}`;
/** Zahl der Spalten der Tabelle: Platz, Team, Spiele, S, U, N, Tore, Diff., Pkt. */
const SPALTEN = 9;

/** Senkrechte Linien in Rasterstärke und Grau, nach x sortiert. */
function senkrechte(page: LayoutPage): LayoutLine[] {
  return page.lines
    .filter(l => Math.abs(l.x1 - l.x2) < 0.05 && Math.abs(l.y2 - l.y1) > 5 && Math.abs(l.width - printTableGrid.stroke) < 0.02)
    .sort((a, b) => a.x1 - b.x1);
}

/** Waagerechte Linien in Rasterstärke von `links` bis `rechts` (ganze Tabellenbreite), nach y sortiert. */
function waagerechte(page: LayoutPage, links: number, rechts: number): LayoutLine[] {
  return page.lines
    .filter(l => Math.abs(l.y1 - l.y2) < 0.05 && Math.abs(l.width - printTableGrid.stroke) < 0.02
      && Math.abs(Math.min(l.x1, l.x2) - links) < 0.1 && Math.abs(Math.max(l.x1, l.x2) - rechts) < 0.1)
    .sort((a, b) => a.y1 - b.y1);
}

/** Inhalt der Kästchen einer Teamzeile, Spalte für Spalte (#, Team, Sp., S, U, N, Tore, Diff., Pkt.); leeres Kästchen = ''. */
function zeile(page: LayoutPage, team: string): string[] {
  const xs = senkrechte(page).map(l => l.x1).filter((x, i, all) => i === 0 || x - all[i - 1] > 0.1);
  const name = page.texts.find(t => t.str.trim() === team);
  expect(name, team).toBeDefined();
  const imBand = page.texts.filter(t => t.str.trim() !== '' && Math.abs(t.y - name!.y) < 1);
  return xs.slice(0, -1).map((x, k) => imBand.filter(t => t.x + t.w / 2 > x && t.x + t.w / 2 < xs[k + 1]).map(t => t.str.trim()).join(' '));
}

/** Seite mit der Tabelle: die Seite, auf der der Spaltenkopf „Pkt.“ steht. */
function tabellenSeite(pages: LayoutPage[]): LayoutPage {
  const page = pages.find(p => p.texts.some(t => t.str.trim() === 'Pkt.'));
  expect(page, 'Seite mit der Tabelle').toBeDefined();
  return page!;
}

describe.each([
  ['vor dem ersten Ergebnis', FALL_A],
  ['mit Werten (Stand am Turniertag)', mitStandA(FALL_A)],
] as [string, HandzettelFall][])('@DR-035 Spielplan mit Ergebnissen, %s', (_name, fall) => {
  it('@DR-035 die Tabelle hat senkrechte graue Trennlinien an jeder Spaltengrenze', async () => {
    const { pages } = await handzettelPdf(fall, { options: { includeScores: true }, standings: calculateStandingsPerGroup(fallTournament(fall)) });
    const linien = senkrechte(tabellenSeite(pages));
    const xs = [...new Set(linien.map(l => Math.round(l.x1 * 10) / 10))];

    expect(xs.length, 'eine Linie je Spaltengrenze und an beiden Rändern').toBe(SPALTEN + 1);
    linien.forEach(l => expect(l.color, `Linie bei x=${l.x1.toFixed(1)}`).toBe(GRAU));
  });

  it('@DR-035 waagerechte graue Rasterlinien über die ganze Tabellenbreite: oben, unter dem Kopf und unter jeder Zeile (Review H1)', async () => {
    const { pages } = await handzettelPdf(fall, { options: { includeScores: true }, standings: calculateStandingsPerGroup(fallTournament(fall)) });
    const page = tabellenSeite(pages);
    const s = senkrechte(page);
    const links = s[0].x1;
    const rechts = s[s.length - 1].x1;
    const waag = waagerechte(page, links, rechts);

    expect(waag.length, 'oben, unter dem Kopf, unter jeder der 6 Zeilen').toBe(fall.teams.length + 2);
    waag.forEach(l => expect(l.color).toBe(GRAU));
  });

  it('@DR-035 jeder Wert und jedes Kopfwort steht in seinem Kästchen zwischen zwei Trennlinien', async () => {
    const { pages } = await handzettelPdf(fall, { options: { includeScores: true }, standings: calculateStandingsPerGroup(fallTournament(fall)) });
    const page = tabellenSeite(pages);
    const linien = senkrechte(page);
    const oben = Math.min(...linien.map(l => Math.min(l.y1, l.y2)));
    const unten = Math.max(...linien.map(l => Math.max(l.y1, l.y2)));
    const inTabelle = page.texts.filter(t => t.str.trim() !== '' && t.y > oben && t.y < unten);

    expect(inTabelle.length).toBeGreaterThan(SPALTEN);
    for (const t of inTabelle) {
      expect(linien.some(l => l.x1 <= t.x + 0.05), `links von „${t.str}“`).toBe(true);
      expect(linien.some(l => l.x1 >= t.x + t.w - 0.05), `rechts von „${t.str}“`).toBe(true);
      const links = Math.max(...linien.filter(l => l.x1 <= t.x + 0.05).map(l => l.x1));
      const rechts = Math.min(...linien.filter(l => l.x1 >= t.x + t.w - 0.05).map(l => l.x1));
      expect(linien.some(l => l.x1 > links + 0.05 && l.x1 < rechts - 0.05), `keine Trennlinie durch „${t.str}“`).toBe(false);
    }
  });
});

describe('@DR-035 mit Werten: die Werte stehen in der Tabelle', () => {
  it('nach fünf beendeten Spielen stehen Zahlen in den Kästchen', async () => {
    const { pages } = await handzettelPdf(mitStandA(FALL_A), { options: { includeScores: true }, standings: calculateStandingsPerGroup(fallTournament(mitStandA(FALL_A))) });
    const page = tabellenSeite(pages);
    const linien = senkrechte(page);
    const oben = Math.min(...linien.map(l => Math.min(l.y1, l.y2)));
    const unten = Math.max(...linien.map(l => Math.max(l.y1, l.y2)));

    expect(page.texts.filter(t => t.y > oben && t.y < unten && /^\d+$/.test(t.str.trim())).length).toBeGreaterThan(10);
  });
});

describe('@DR-035 Zahlen in jedem Kästchen ab dem ersten Ergebnis des Turniers (Daniel 05.11.)', () => {
  /** Fall b nach Spiel 1 (Gruppe A: SG Grabenstätt/Chieming – DJK Traunstein 2:1); Gruppe B hat noch kein Ergebnis. */
  const NACH_SPIEL_1: HandzettelFall = { ...FALL_B, spiele: FALL_B.spiele.map(sp => (sp.nr === 1 ? { ...sp, zustand: { status: 'finished' as const, a: 2, b: 1 } } : sp)) };
  const seite = async (fall: HandzettelFall, edition?: 'blank') => tabellenSeite((await handzettelPdf(fall, {
    options: { includeScores: true, ...(edition ? { edition } : {}) }, standings: calculateStandingsPerGroup(fallTournament(fall)),
  })).pages);

  it('@DR-035 Team mit Spiel: jede Zahl steht, auch 0 bei Siegen, Unentschieden und Punkten', async () => {
    const page = await seite(NACH_SPIEL_1);

    expect(zeile(page, 'DJK Traunstein').slice(1)).toEqual(['DJK Traunstein', '1', '0', '0', '1', '1:2', '-1', '0']);
    expect(zeile(page, 'SG Grabenstätt/Chieming').slice(1)).toEqual(['SG Grabenstätt/Chieming', '1', '1', '0', '0', '2:1', '+1', '3']);
  });

  it('@DR-035 Team ohne Spiel, auch in einer Gruppe ohne Ergebnis: 0 in jedem Zahlenkästchen, Tore „0:0“, Platz eingetragen', async () => {
    const page = await seite(NACH_SPIEL_1);

    for (const team of ['TSV Traunwalchen', 'SV Seeon']) {
      const z = zeile(page, team);
      expect(z.slice(2), team).toEqual(['0', '0', '0', '0', '0:0', '0', '0']);
      expect(z[0], `${team} Platz`).toMatch(/^\d+$/);
    }
  });

  it('@DR-035 Gegenbeispiel: vor dem ersten Ergebnis des Turniers bleiben alle Kästchen leer', async () => {
    const page = await seite(FALL_B);

    for (const team of ['DJK Traunstein', 'SV Seeon']) { expect(zeile(page, team).filter((_, k) => k !== 1), team).toEqual(['', '', '', '', '', '', '', '']); }
  });

  it('@DR-035 Gegenbeispiel: die Fassung ohne Ergebnisse bleibt leer, auch nach dem ersten Ergebnis', async () => {
    const page = await seite(NACH_SPIEL_1, 'blank');

    expect(zeile(page, 'DJK Traunstein').filter((_, k) => k !== 1).filter(c => c !== ':')).toEqual(['', '', '', '', '', '', '']);
  });
});

