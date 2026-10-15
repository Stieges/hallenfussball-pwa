/**
 * B-28a3-4b Punkt 1 (Controller 15.10.): Ohne gespielte Spiele bleibt die Platz-Spalte der Gruppentabellen und der
 * Platzierung leer, sonst steht dort die Rangziffer. Gelesen aus dem fertigen PDF (pdfjs).
 * Szenarien: @BM-016, @DR-009 (Platzierung nach dem Finale: Umsetzung in a4-4, hier nur die leere Spalte).
 */
import { describe, expect, it } from 'vitest';
import { printColumns, printType } from '../../../design-tokens/print';
import type { Standing } from '../../../types/tournament';
import { buildSchedulePdf } from '../schedulePdf';
import { pageGeometry } from '../layout';
import { hallencupSchedule, HALLENCUP_STANDINGS, hallencupTournament } from './pdfFixture';
import { layoutOf } from './pdfFixtureLayout';
import { readLayout, type LayoutPage, type LayoutText } from './pdfjsLayout';
import { translatorFor } from './pdfText';

const SIZE_TOL = 0.05;
const trimmed = (text: LayoutText): string => text.str.trim();

/** Seiten des fertigen PDFs mit gegebenen Standings (ohne Aufruf über `layoutOf`, der keine Standings annimmt). */
async function seitenMit(standings: Standing[] | undefined): Promise<LayoutPage[]> {
  const tournament = hallencupTournament();
  const { doc } = await buildSchedulePdf({
    schedule: hallencupSchedule(tournament),
    standings,
    options: { locale: 'de', translate: translatorFor('de'), tournament },
  });
  return readLayout(new Uint8Array(doc.output('arraybuffer')));
}

/**
 * Textstücke in der Platz-Spalte unter jeder Tabellenüberschrift „Pl“ (Gruppentabellen und Platzierung), die aus
 * einer Ziffer bestehen. Spaltenbreite und Ursprung aus den Druck-Tokens.
 */
function platzZiffern(pages: LayoutPage[]): { kopfzeilen: number; ziffern: string[] } {
  const geo = pageGeometry('a4', 'portrait');
  const spalte = { links: geo.left, rechts: geo.left + printColumns.standings.pos };
  let kopfzeilen = 0;
  const ziffern: string[] = [];
  for (const page of pages) {
    for (const kopf of page.texts.filter(t => trimmed(t) === 'Pl')) {
      kopfzeilen++;
      for (const t of page.texts) {
        const text = trimmed(t);
        if (t.y > kopf.y && t.x >= spalte.links && t.x < spalte.rechts && /^\d+$/.test(text) && Math.abs(t.size - printType.tableSBody) <= SIZE_TOL) {
          ziffern.push(text);
        }
      }
    }
  }
  return { kopfzeilen, ziffern };
}

/**
 * Ziffern in der Platz-Spalte unter der Überschrift `ueberschrift` (ab ihrer Höhe, auf derselben Seite). `kopfzeilen`
 * zählt die Tabellenköpfe „Pl“ unter der Überschrift, damit ein leerer Befund nicht als Erfolg zählt.
 */
function platzZiffernUnter(pages: LayoutPage[], ueberschrift: string): { kopfzeilen: number; ziffern: string[] } {
  const geo = pageGeometry('a4', 'portrait');
  let kopfzeilen = 0;
  const ziffern: string[] = [];
  for (const page of pages) {
    const titel = page.texts.find(t => trimmed(t) === ueberschrift);
    const kopf = titel ? page.texts.find(t => trimmed(t) === 'Pl' && t.y > titel.y) : undefined;
    if (!kopf) {continue;}
    kopfzeilen++;
    for (const t of page.texts) {
      if (t.y > kopf.y && t.x >= geo.left && t.x < geo.left + printColumns.standings.pos && /^\d+$/.test(trimmed(t))) {
        ziffern.push(trimmed(t));
      }
    }
  }
  return { kopfzeilen, ziffern };
}

describe('Punkt 1 Platz-Spalte ohne gespielte Spiele', () => {
  it('ohne Ergebnisse: Gruppentabellen und Platzierung haben keine Ziffer in der Platz-Spalte', async () => {
    const tournament = hallencupTournament();
    const { pages } = await layoutOf({ tournament }, hallencupSchedule(tournament));
    const { kopfzeilen, ziffern } = platzZiffern(pages);

    expect(kopfzeilen, 'Tabellen mit Platz-Spalte: Gruppe A, Gruppe B, Platzierung').toBeGreaterThanOrEqual(3);
    expect(ziffern).toEqual([]);
  });

  it('Gegenbeispiel: mit gespielten Spielen steht die Rangziffer in der Platz-Spalte', async () => {
    const pages = await seitenMit(HALLENCUP_STANDINGS);
    const { ziffern } = platzZiffern(pages);

    expect(ziffern).toEqual(expect.arrayContaining(['1', '2', '3', '4']));
  });

  it('F5 Platzierung bleibt auch mit gespielten Spielen ohne Ziffern (keine Übergangsplatzierung vor a4-4, @DR-009)', async () => {
    const pages = await seitenMit(HALLENCUP_STANDINGS);
    const { kopfzeilen, ziffern } = platzZiffernUnter(pages, 'Platzierung');

    expect(kopfzeilen, 'Tabellenkopf „Pl“ unter der Überschrift Platzierung').toBe(1);
    expect(ziffern).toEqual([]);
  });
});
