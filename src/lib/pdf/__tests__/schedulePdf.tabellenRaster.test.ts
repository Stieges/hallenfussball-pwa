/**
 * Fixrunde 2 zu PR #444: Auch im Spielplan mit Ergebnissen haben die Tabellen das graue Raster mit senkrechten Trennlinien zwischen
 * den Spalten, vor dem ersten Ergebnis wie danach; die Werte stehen in den Kästchen. Gemessen am fertigen PDF (pdfjs), Fall a (eine
 * Tabelle „Team“ auf Seite 2), deutsch.
 * Szenario: @DR-035 („Und auch im Spielplan mit Ergebnissen haben die Tabellen dieses graue Raster …“).
 */
import { describe, expect, it } from 'vitest';
import { printTableGrid } from '../../../design-tokens/print-sheet';
import { FALL_A, mitStandA, type HandzettelFall } from './fixtures/handzettelFaelle';
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
