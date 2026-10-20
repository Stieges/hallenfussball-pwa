/**
 * Abpfiff von Hand im Cockpit (E2E-Helfer): „Abpfiff halten“ ist ein Halteknopf (@SL-157). Ein Klick löst nichts aus;
 * die Maus bleibt etwas länger als die Haltezeit (1 s) gedrückt. Die Rückfrage mit der Restzeit (@SL-010) beantworten
 * die Aufrufer wie bisher über den Beenden-Knopf des Dialogs, falls sie erscheint.
 */
import type { Page } from '@playwright/test';

/** Etwas mehr als `HOLD_MS` (src/components/ui/atoms/HoldButton.tsx). */
const HALTEN_MS = 1200;

export async function abpfiffHalten(page: Page): Promise<void> {
  const knopf = page.getByTestId('match-finish-button');
  await knopf.scrollIntoViewIfNeeded();
  const box = await knopf.boundingBox();
  if (!box) { throw new Error('„Abpfiff halten“ ist nicht sichtbar'); }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(HALTEN_MS);
  await page.mouse.up();
}
