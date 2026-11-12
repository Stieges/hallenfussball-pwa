/**
 * Wartet auf den Zustand statt auf eine feste Zeit (@TA-021): alle endlichen Animationen und Übergänge der Seite sind fertig (das Blatt gleitet
 * 0,3 s ein, Tasten blenden Farben über). Endlos laufende Animationen (Puls des Live-Abzeichens) zählen nicht. Erst danach sind Lage und Farben messbar.
 */
import { expect, type Page } from '@playwright/test';

export async function animationenFertig(page: Page): Promise<void> {
  await expect.poll(
    () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity).length),
    { message: 'Animationen und Übergänge sind fertig', intervals: [50, 100, 100, 200, 250] },
  ).toBe(0);
}
