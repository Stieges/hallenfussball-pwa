/**
 * Selbsttest der Erweiterung von `pdfjsLayout.ts` (PDF-Paket V1): Link-Flächen (`getAnnotations`) und Eigenschaften der
 * Datei (`getMetadata`) an einem Mini-PDF mit bekannten Werten aus dem echten jsPDF.
 *
 * Dazu der Spike „Metadaten-Unicode“ (Review G2): jsPDF schreibt den Titel mit U+2013, Umlaut und Kyrillisch so, dass
 * pdfjs ihn unverändert zurückliest. Damit setzt T7a den Titel direkt über `setDocumentProperties` (@DR-039).
 */
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { readLayout, readMetadata } from './pdfjsLayout';

const TOL = 0.1;
const URL = 'https://hallenfussball-pwa.vercel.app/#/live/K7M2QX';

function miniPdf(setup: (doc: jsPDF) => void): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.text('x', 20, 20);
  setup(doc);
  return new Uint8Array(doc.output('arraybuffer'));
}

describe('pdfjsLayout: Link-Flächen (getAnnotations)', () => {
  it('ein Link 37,6 × 37,8 mm bei (150, 30) mit Adresse auf ±0,1 mm', async () => {
    const [page] = await readLayout(miniPdf(doc => doc.link(150, 30, 37.6, 37.8, { url: URL })));
    const [link] = page?.links ?? [];

    expect(page?.links).toHaveLength(1);
    expect(link?.url).toBe(URL);
    expect(Math.abs((link?.x ?? 0) - 150)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((link?.y ?? 0) - 30)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((link?.w ?? 0) - 37.6)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((link?.h ?? 0) - 37.8)).toBeLessThanOrEqual(TOL);
  });

  it('Links je Seite getrennt: Seite 2 hat ihren eigenen', async () => {
    const pages = await readLayout(miniPdf(doc => {
      doc.link(10, 10, 5, 5, { url: URL });
      doc.addPage();
      doc.link(20, 20, 25.4, 25.4, { url: `${URL}?s=2` });
    }));

    expect(pages.map(p => p.links.map(l => l.url))).toEqual([[URL], [`${URL}?s=2`]]);
  });

  it('Gegenbeispiel: ohne Link keine Link-Fläche', async () => {
    const [page] = await readLayout(miniPdf(() => undefined));

    expect(page?.links).toEqual([]);
  });
});

describe('pdfjsLayout: Eigenschaften der Datei (getMetadata)', () => {
  it('Sprache aus setLanguage', async () => {
    const meta = await readMetadata(miniPdf(doc => doc.setLanguage('en')));

    expect(meta.lang).toBe('en');
  });

  it('Gegenbeispiel: ohne Titel und Sprache bleiben beide leer', async () => {
    const meta = await readMetadata(miniPdf(() => undefined));

    expect(meta).toEqual({ title: undefined, lang: undefined });
  });
});

describe('Spike Metadaten-Unicode (@DR-039, Review G2): Titel kommt unverändert zurück', () => {
  it.each([
    'Hallencup Nord – Spielplan',
    'Hallencup Süd – Spielplan',
    'Кубок Север – Spielplan',
    'Hallencup Nord – Schedule',
    // Kyrillisch mit den Bytes 0x28/0x29/0x5C in UTF-16 (Щ = 04 29, Ќ = 04 0C, ќ = 04 5C) und Klammern/Backslash im Text
    'Щука ќ (U13) \\ Cup – Spielplan',
    'U13 Qualiturnier um den „Franz Schützinger Cup“ – Spielplan',
  ])('%s', async title => {
    const meta = await readMetadata(miniPdf(doc => {
      doc.setDocumentProperties({ title });
      doc.setLanguage('de');
    }));

    expect(meta.title).toBe(title);
    expect(meta.lang).toBe('de');
  });
});
