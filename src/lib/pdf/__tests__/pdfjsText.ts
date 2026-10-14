/**
 * Prüf-Werkzeug zweiter Art (B-28a2): Text aus dem fertigen PDF über pdfjs-dist (B5 aus dem a0-Review).
 * Gleiche Form wie der Mitschnitt (`CapturedDoc`, Seiten als Textstücke), damit beide gegeneinander
 * abgeglichen werden können. Der Mitschnitt bleibt die Grundlage der Struktur-Tests (a0).
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { CapturedDoc } from './pdfCapture';

/** Textstücke je Seite aus den Bytes eines PDFs. Die Bytes werden kopiert: pdfjs übergibt sie an den Worker. */
export async function extractPdfText(bytes: Uint8Array, filename = ''): Promise<CapturedDoc> {
  const document = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const pages: string[][] = [];
  let pageWidth = 0;
  let pageHeight = 0;
  for (let n = 1; n <= document.numPages; n++) {
    const page = await document.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    // pdfjs misst in Punkt (1/72 Zoll), CapturedDoc in mm.
    pageWidth = (viewport.width * 25.4) / 72;
    pageHeight = (viewport.height * 25.4) / 72;
    const content = await page.getTextContent();
    pages.push(content.items.flatMap(item => ('str' in item && item.str !== '' ? [item.str] : [])));
  }
  return { filename, pageWidth, pageHeight, pages };
}

/** Sprache aus dem Dokumentkatalog (`/Lang (de)`), unkomprimiert geschrieben. */
export function pdfLanguage(bytes: Uint8Array): string | undefined {
  return /\/Lang\s*\(([A-Za-z-]+)\)/.exec(Buffer.from(bytes).toString('latin1'))?.[1];
}

/** Leerraum weg: Zeilenumbrüche in Zellen zählen nicht als Textbruch. */
export function squash(text: string): string {
  return text.replace(/\s+/g, '');
}
