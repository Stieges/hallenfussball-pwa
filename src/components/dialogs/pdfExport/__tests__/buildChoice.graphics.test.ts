/**
 * PDF-Paket T8: die Grafiken und die Akzentfarbe des Geräts kommen im fertigen Spielplan und im fertigen Aushang an
 * (@DR-041, @DR-023, @DR-024, @DR-017, @DR-040, @W3-030, @W3-040). Gemessen am echten PDF (pdfjs), gebaut über `buildChoice`
 * wie im Dialog. Logos: selbst erzeugte Prüfbilder, kein Vereinswappen.
 */
import i18next from 'i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { StoredGraphic, TournamentGraphics } from '../../../../core/storage/tournamentGraphicsStore';
import { printAccent } from '../../../../design-tokens/print';
import { printHeader } from '../../../../design-tokens/print-header';
import { pageGeometry } from '../../../../lib/pdf/layout';
import { hallencupSchedule, hallencupTournament } from '../../../../lib/pdf/__tests__/pdfFixture';
import { readLayout, type LayoutPage } from '../../../../lib/pdf/__tests__/pdfjsLayout';
import { pngBytes } from '../../../../lib/pdf/__tests__/pdfLogoFixture';
import deTournament from '../../../../i18n/locales/de/tournament.json';
import { buildChoice, type BuildContext, type PdfChoice } from '../buildChoice';

vi.unmock('i18next');

const NOW = new Date(2026, 10, 14, 15, 7);
const BLAU = '#2A2576';
const TINT = '#DDDCE9';
const geo = pageGeometry('a4', 'portrait');
const TOL = 0.3;

beforeAll(async () => {
  await i18next.init({ lng: 'de', fallbackLng: 'de', defaultNS: 'tournament', ns: ['tournament'], resources: { de: { tournament: deTournament } }, interpolation: { escapeValue: false } });
});

/** Gespeicherte Grafik aus einem selbst erzeugten PNG (Rahmen, Graustufen). */
function gespeichert(widthPx: number, heightPx: number): StoredGraphic {
  return { dataUrl: `data:image/png;base64,${Buffer.from(pngBytes(widthPx, heightPx)).toString('base64')}`, widthPx, heightPx, originalHeightPx: heightPx };
}
const BEIDE: TournamentGraphics = { left: gespeichert(240, 240), right: gespeichert(480, 240), accent: BLAU };

async function bauen(choice: PdfChoice, extra: Partial<BuildContext> = {}): Promise<{ pages: LayoutPage[]; hints: ReturnType<typeof hintsOf>; filename: string }> {
  const tournament = hallencupTournament({ isPublic: true, shareCode: 'ABC123' });
  const result = await buildChoice(choice, { tournament, schedule: hallencupSchedule(tournament), standings: [], audience: 'organizer', online: true, now: NOW, ...extra });
  if (!result.ok) { throw new Error(`nicht gebaut: ${result.reason}`); }
  return { pages: await readLayout(new Uint8Array(result.pdf.doc.output('arraybuffer'))), hints: hintsOf(result.pdf), filename: result.pdf.filename };
}
const hintsOf = (pdf: { hints: { logos: Array<'left' | 'right'> } }) => pdf.hints;

/** pdfjs rundet die Kanäle (0–1 → 0–255) um höchstens eine Stufe. */
const gleich = (a: string, b: string): boolean => [1, 3, 5].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 1);
const hatFarbe = (farben: string[], soll: string): boolean => farben.some(c => gleich(c, soll));
const linienFarben = (pages: LayoutPage[]): string[] => pages.flatMap(p => p.lines.map(l => l.color));
const flaechenFarben = (pages: LayoutPage[]): string[] => pages.flatMap(p => p.rects.map(r => r.fill ?? ''));

describe.each<[PdfChoice]>([['schedule'], ['notice']])('@DR-041 Akzent aus dem Speicher landet im PDF (%s)', choice => {
  it('Linien in der Farbe des Wappens; das Grün der App kommt nicht vor; alle Texte bleiben schwarz (@DR-017)', async () => {
    const { pages } = await bauen(choice, { graphics: BEIDE });

    expect(hatFarbe(linienFarben(pages), BLAU)).toBe(true);
    expect(hatFarbe(linienFarben(pages), printAccent.fallback)).toBe(false);
    pages.forEach(p => p.textColors.forEach(c => expect(c, 'Textfarbe').toBe('#000000')));
  });

  it('@DR-041 nur rechte Grafik: der Akzent im PDF ist das Grün der App', async () => {
    const { pages } = await bauen(choice, { graphics: { right: BEIDE.right, accent: BLAU } });

    expect(hatFarbe(linienFarben(pages), printAccent.fallback)).toBe(true);
    expect(hatFarbe(linienFarben(pages), BLAU)).toBe(false);
  });

  it('@W3-030 Gerät ohne Speicher (Co-Admin): kein Bild, Grün der App', async () => {
    const { pages, hints } = await bauen(choice, { graphics: {} });

    pages.forEach(p => expect(p.images).toHaveLength(0));
    expect(hatFarbe(linienFarben(pages), printAccent.fallback)).toBe(true);
    expect(hints.logos).toEqual([]);
  });
});

describe('@DR-041 @DR-001 Spielplan: helle Flächen im hellen Ton des Akzents', () => {
  it('Zebra und Eckdaten-Block tragen #DDDCE9, Füllungen sind sonst schwarz (QR), weiß oder Teil der Grafik', async () => {
    const { pages } = await bauen('schedule', { graphics: BEIDE });

    expect(hatFarbe(flaechenFarben(pages), TINT)).toBe(true);
    flaechenFarben(pages).forEach(c => expect([c === '#000000', gleich(c, TINT), c === '#ffffff'].some(Boolean), `Füllung ${c}`).toBe(true));
  });
});

describe('@DR-017 Aushang: Akzent nur auf Linien und Flächen, Linie unter dem Titel', () => {
  it('@DR-041 genau eine Linie von 1,5 pt in der Akzentfarbe über die Satzbreite, zwischen Titel und Aufruf', async () => {
    const { pages } = await bauen('notice', { graphics: BEIDE });
    const [page] = pages;
    const regeln = page.lines.filter(l => gleich(l.color, BLAU));
    const aufruf = page.texts.find(t => t.str.includes('aufs Handy'));
    const titel = page.texts.filter(t => aufruf && t.y < aufruf.y && t.size > 30);

    expect(regeln).toHaveLength(1);
    expect(regeln[0].width).toBeCloseTo(1.5 * 25.4 / 72, 2);
    expect(regeln[0].x1).toBeCloseTo(geo.left, 1);
    expect(regeln[0].x2).toBeCloseTo(geo.left + geo.contentWidth, 1);
    expect(titel.length).toBeGreaterThan(0);
    expect(regeln[0].y1).toBeGreaterThan(Math.max(...titel.map(t => t.y)));
    expect(regeln[0].y1).toBeLessThan((aufruf?.y ?? 0) - (aufruf?.size ?? 0) * 0.25);
    expect(page.rects.every(r => r.fill === '#000000')).toBe(true);
  });

  it('@DR-023 beide Grafiken stehen auf dem Aushang in einer eigenen Zeile über dem Titel, je höchstens 20 mm hoch', async () => {
    const { pages } = await bauen('notice', { graphics: BEIDE });
    const [page] = pages;
    const [links, rechts] = [...page.images].sort((a, b) => a.x - b.x);
    const titelOben = Math.min(...page.texts.filter(t => t.size > 30).map(t => t.y - t.size * 0.35));

    expect(page.images).toHaveLength(2);
    expect(links.x).toBeCloseTo(geo.left, 1);
    expect(rechts.x + rechts.w).toBeCloseTo(geo.left + geo.contentWidth, 1);
    expect(Math.max(links.h, rechts.h)).toBeLessThanOrEqual(printHeader.logoMaxHeight + 0.05);
    expect(Math.max(links.y + links.h, rechts.y + rechts.h)).toBeLessThanOrEqual(titelOben + TOL);
  });

  it('@W3-030 ohne Grafik beginnt der Titel ganz oben, ohne Lücke', async () => {
    const mit = await bauen('notice', { graphics: BEIDE });
    const ohne = await bauen('notice', { graphics: {} });
    const titelY = (p: LayoutPage): number => Math.min(...p.texts.filter(t => t.size > 30).map(t => t.y));

    expect(titelY(ohne.pages[0])).toBeLessThan(titelY(mit.pages[0]) - 10);
    expect(titelY(ohne.pages[0])).toBeLessThan(geo.top + 20);
  });
});

describe('@DR-023 @DR-040 Spielplan: Kopfgrafiken aus dem Speicher', () => {
  it('beide Grafiken am Rand des Satzspiegels, je höchstens 20 mm hoch, Titel dazwischen ohne Überlappung', async () => {
    const { pages } = await bauen('schedule', { graphics: BEIDE });
    const [links, rechts] = [...pages[0].images].sort((a, b) => a.x - b.x);
    const titel = pages[0].texts.filter(t => Math.abs(t.size - 26) < 0.5);

    expect(pages[0].images).toHaveLength(2);
    expect(links.x).toBeCloseTo(geo.left, 1);
    expect(rechts.x + rechts.w).toBeCloseTo(geo.left + geo.contentWidth, 1);
    expect(Math.max(links.h, rechts.h)).toBeLessThanOrEqual(printHeader.logoMaxHeight + 0.05);
    expect(titel.length).toBeGreaterThan(0);
    titel.forEach(t => {
      expect(t.x).toBeGreaterThanOrEqual(links.x + links.w - 0.05);
      expect(t.x + t.w).toBeLessThanOrEqual(rechts.x + 0.05);
    });
  });

  it('@DR-040 ein 141 Bildpunkte hohes Logo steht im Kopf des Spielplans (kein Ausschluss, nur die Warnung im Assistenten)', async () => {
    const klein = { ...gespeichert(300, 141), originalHeightPx: 141 };
    const { pages, hints } = await bauen('schedule', { graphics: { left: klein, accent: BLAU } });

    expect(pages[0].images).toHaveLength(1);
    expect(pages[0].images[0].x).toBeCloseTo(geo.left, 1);
    expect(hints.logos).toEqual([]);
  });
});

describe('@DR-024 kaputte gespeicherte Datei oder unlesbarer Speicher: Hinweis, das PDF entsteht trotzdem', () => {
  const KAPUTT = { dataUrl: 'data:image/png;base64,AAECAwQFBgcICQ==', widthPx: 300, heightPx: 300, originalHeightPx: 300 };

  it.each<[PdfChoice]>([['schedule'], ['notice']])('%s: kaputte linke Datei → Hinweis „links“, kein Bild, PDF da', async choice => {
    const { pages, hints } = await bauen(choice, { graphics: { left: KAPUTT, right: gespeichert(240, 240), accent: BLAU } });

    expect(pages.length).toBeGreaterThan(0);
    expect(hints.logos).toEqual(['left']);
    expect(pages[0].images).toHaveLength(1);
  });

  it.each<[PdfChoice]>([['schedule'], ['notice']])('%s: der Speicher ließ sich nicht lesen → Hinweis für beide Seiten, PDF ohne Grafik', async choice => {
    const { pages, hints } = await bauen(choice, { graphicsUnreadable: true });

    expect(pages.length).toBeGreaterThan(0);
    expect(hints.logos).toEqual(['left', 'right']);
    expect(pages[0].images).toHaveLength(0);
  });

  it('Gegenbeispiel: brauchbare Dateien ergeben keinen Hinweis', async () => {
    expect((await bauen('schedule', { graphics: BEIDE })).hints.logos).toEqual([]);
  });
});
