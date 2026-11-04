/**
 * Hilfen für Specs, die ein heruntergeladenes PDF lesen (pdfjs): Download abwarten, Farben vergleichen. Nur für Tests.
 */
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { readLayout, type LayoutPage } from '../../../src/lib/pdf/__tests__/pdfjsLayout';

/** Klickt `trigger` (Haupttaste des PDF-Dialogs), wartet auf den Download und liest die Seiten des PDFs. */
export async function pdfNachKlick(page: Page, testId: string): Promise<{ pages: LayoutPage[]; filename: string }> {
  const download = page.waitForEvent('download');
  await page.getByTestId(testId).click();
  const loaded = await download;
  const path = await loaded.path();
  return { pages: await readLayout(new Uint8Array(readFileSync(path))), filename: loaded.suggestedFilename() };
}

/** pdfjs rundet die Farbkanäle um höchstens eine Stufe. */
export const gleicheFarbe = (a: string, b: string): boolean =>
  [1, 3, 5].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 1);

export const linienFarben = (pages: LayoutPage[]): string[] => pages.flatMap(p => p.lines.map(l => l.color));
