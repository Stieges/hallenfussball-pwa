/**
 * Abpfiff von Hand im Cockpit (E2E-Helfer): „Abpfiff halten“ ist ein Halteknopf (@SL-157). Ein Klick löst nichts aus;
 * die Maus bleibt etwas länger als die Haltezeit (1 s) gedrückt. Danach fragt das Cockpit mit der Restzeit nach
 * (@SL-010); der Helfer beantwortet die Rückfrage mit „Beenden“.
 */
import type { Page } from '@playwright/test';

/** Etwas mehr als `HOLD_MS` (src/components/ui/atoms/HoldButton.tsx). */
const HALTEN_MS = 1200;

/** Hält „Abpfiff“, bis die Rückfrage da ist, und lässt wieder los. Die Rückfrage bleibt offen. */
export async function abpfiffHaltenBisRueckfrage(page: Page): Promise<void> {
  const knopf = page.getByTestId('match-finish-button');
  await knopf.scrollIntoViewIfNeeded();
  const box = await knopf.boundingBox();
  if (!box) { throw new Error('„Abpfiff halten“ ist nicht sichtbar'); }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(HALTEN_MS);
  await page.mouse.up();
}

/** Abpfiff von Hand: halten und die Rückfrage mit „Beenden“ bestätigen. */
export async function abpfiffHalten(page: Page): Promise<void> {
  await abpfiffHaltenBisRueckfrage(page);
  await page.getByTestId('finish-confirm-beenden').click();
}
