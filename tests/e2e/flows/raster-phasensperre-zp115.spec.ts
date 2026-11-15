/**
 * E2E (G3-N, Regel T2-UI): @ZP-115 Im Raster lässt sich ein Spiel nicht auf einen freien Platz der anderen Phase ziehen
 * (Gruppenspiel nicht neben das Finale, Finalspiel nicht in die Gruppenphase); innerhalb der eigenen Phase geht es.
 * Dazu @ZP-111: Wird das Fenster im Bearbeiten-Modus des Rasters schmaler, zeigt der Spielplan die Liste, der Entwurf bleibt
 * („1 Änderung nicht gespeichert“) und die Liste lässt sich bedienen. Offline (Gast = Turnierleitung), 1280×720.
 *
 * Daten: zwei Felder; 10:00 Spiel 1 (Feld 1) und Spiel 2 (Feld 2), 10:12 Spiel 3 (Feld 1, Feld 2 frei = Gruppenphase),
 * 10:24 Halbfinale (Feld 1, Feld 2 frei = Finalrunde). Die freien Plätze haben keine Kennung: sie werden über die
 * Feld-Überschrift (Spalte) und die Zeile der Karte daneben getroffen.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { cup, ID, TEAMS } from '../helpers/laptopCup';

const at = (minute: number) => {
  const d = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return `${d}T${String(10 + Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00.000Z`;
};

function turnier() {
  const base = cup({ felder: 2 });
  const spiel = (nr: number, minute: number, field: number, extra: Record<string, unknown> = {}) => ({
    id: `00000000-0000-4000-8000-0000000115${String(nr).padStart(2, '0')}`, matchNumber: nr, round: nr, field, group: 'A', phase: 'groupStage',
    slotA: { kind: 'team', teamId: TEAMS[0] }, slotB: { kind: 'team', teamId: TEAMS[1] }, matchStatus: 'scheduled', scheduledTime: at(minute), ...extra,
  });
  return {
    ...base,
    matches: [
      spiel(1, 0, 1), spiel(2, 0, 2, { slotA: { kind: 'team', teamId: TEAMS[2] }, slotB: { kind: 'team', teamId: TEAMS[3] } }),
      spiel(3, 12, 1, { slotA: { kind: 'team', teamId: TEAMS[0] }, slotB: { kind: 'team', teamId: TEAMS[2] } }),
      spiel(4, 24, 1, { group: undefined, phase: 'semifinal', isFinal: true, slotA: { kind: 'team', teamId: TEAMS[0] }, slotB: { kind: 'team', teamId: TEAMS[1] } }),
    ],
  };
}

const griff = (page: Page, nr: number) => page.locator(`xpath=//span[normalize-space()='Spiel ${nr}']/preceding-sibling::div[1]`);
const kopf = (page: Page, nr: number) => page.locator(`xpath=//span[normalize-space()='Spiel ${nr}']`).first(); // beim Ziehen gibt es kurz eine zweite Kopie (Zieh-Vorschau)
/** Die Karte des Spiels (Kopf → Kartenfläche); ihre Mitte entscheidet beim Ziehen, über welchem Platz sie liegt. */
const karte = (page: Page, nr: number) => kopf(page, nr).locator('xpath=ancestor::div[2]');
const zaehler = (page: Page) => page.getByTestId('schedule-unsaved-count');

/** Mitte des freien Platzes in Feld 2 in der Zeile von Spiel `nr` (Spalte der Überschrift „Feld 2“, Höhe der Karte in Feld 1). */
async function freierPlatz(page: Page, nr: number): Promise<{ x: number; y: number }> {
  const spalte = await page.getByText('Feld 2', { exact: true }).first().boundingBox();
  const zeile = await karte(page, nr).boundingBox();
  if (!spalte || !zeile) { throw new Error('Spalte oder Zeile nicht sichtbar'); }
  return { x: spalte.x + spalte.width / 2, y: zeile.y + zeile.height / 2 };
}

/** Zieht Spiel `vonNr` am Griff so, dass die Mitte seiner Karte auf der Mitte des Platzes `ziel` liegt. */
async function ziehe(page: Page, vonNr: number, ziel: { x: number; y: number }) {
  const [von, k] = await Promise.all([griff(page, vonNr).boundingBox(), karte(page, vonNr).boundingBox()]);
  if (!von || !k) { throw new Error('Griff nicht sichtbar'); }
  const start = { x: von.x + von.width / 2, y: von.y + von.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 20, start.y + 20, { steps: 5 });
  await page.mouse.move(ziel.x - (k.x + k.width / 2 - start.x), ziel.y - (k.y + k.height / 2 - start.y), { steps: 15 });
  await page.mouse.up();
}

test.describe('@ZP-115 Raster: freie Plätze der anderen Phase sind gesperrt', () => {
  test.beforeEach(async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier()] });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/#/tournament/${ID}/schedule`);
    await page.getByTestId('schedule-edit-start').click({ timeout: 15_000 });
    await page.getByTestId('schedule-view-grid').click();
    await expect(page.getByTestId('schedule-filter-bar')).toHaveCount(0);
    await expect(kopf(page, 4)).toBeVisible();
    await kopf(page, 4).scrollIntoViewIfNeeded();
  });

  test('@ZP-115 Gruppenspiel auf den freien Platz neben dem Halbfinale: Meldung, Spiel bleibt, kein Änderungszähler', async ({ page }) => {
    const vorher = await kopf(page, 1).boundingBox();
    await ziehe(page, 1, await freierPlatz(page, 4));
    await expect(page.getByText('Gruppenspiele bleiben in der Gruppenphase')).toBeVisible();
    await expect(zaehler(page)).not.toContainText('nicht gespeichert');
    await expect.poll(async () => kopf(page, 1).boundingBox()).toEqual(vorher);
  });

  test('@ZP-115 Gegenbeispiel: Gruppenspiel auf den freien Platz in der Gruppenphase (neben Spiel 3): gelingt, 1 Änderung', async ({ page }) => {
    await ziehe(page, 1, await freierPlatz(page, 3));
    await expect(zaehler(page)).toContainText('1 Änderung nicht gespeichert');
    await expect(page.getByText('Gruppenspiele bleiben in der Gruppenphase')).toHaveCount(0);
  });

  test('@ZP-111 Fenster im Bearbeiten-Modus verkleinert (1280 → 1024): Liste, Entwurf bleibt, Liste lässt sich bedienen', async ({ page }) => {
    await ziehe(page, 1, await freierPlatz(page, 3));
    await expect(zaehler(page)).toContainText('1 Änderung nicht gespeichert');
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.getByTestId('schedule-filter-bar')).toBeVisible();
    await expect(page.getByTestId('schedule-view-grid')).toHaveCount(0);
    await expect(zaehler(page)).toContainText('1 Änderung nicht gespeichert');
    // bedienbar: „Abbrechen“ fragt nach (eine Änderung), „Weiter bearbeiten“ lässt den Entwurf stehen, „Verwerfen“ beendet ihn
    await page.getByTestId('schedule-edit-cancel').click();
    await expect(page.getByRole('heading', { name: '1 Änderung verwerfen?' })).toBeVisible();
    await page.getByRole('button', { name: 'Weiter bearbeiten' }).click();
    await expect(zaehler(page)).toContainText('1 Änderung nicht gespeichert');
    await page.getByTestId('schedule-edit-cancel').click();
    await page.getByRole('button', { name: 'Verwerfen', exact: true }).click();
    await expect(page.getByTestId('schedule-edit-start')).toBeVisible();
    await expect(zaehler(page)).toHaveCount(0);
  });
});
