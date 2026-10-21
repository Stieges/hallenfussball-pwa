/**
 * tests/e2e/cloud/verwerfen-konflikt.cloud.spec.ts -- T2-UI-Nachweis zu @FU-108, @FU-106 und @FU-109
 * (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`), Muster wie `queue-failed.cloud.spec.ts`: ein Dead-Letter-Eintrag
 * `SAVE_TOURNAMENT` MIT Turnier wird direkt eingelegt (fünf echte Fehlversuche dauerten 2,5 Minuten). Der Inhalt dazu
 * entsteht echt: das Gerät ändert den Ort ohne Netz über die Oberfläche (lokale Kopie + wartender Eintrag), der wartende
 * Eintrag wird mit seinem Grund in den Dead-Letter gelegt.
 *
 * Fall 1 (@FU-108, @FU-106 Beispiel „nach Konflikt“): Maria (Co-Admin) ändert ohne Netz, Olli speichert inzwischen am
 * Server. Die Liste zeigt „Turnier wurde inzwischen auf einem anderen Gerät geändert“, kein „Erneut versuchen“, nur
 * „Verwerfen und aktuellen Stand laden“; danach trägt Marias Gerät Ollis Stand.
 * Fall 2 (@FU-109): Olli verwirft ohne Verbindung – nichts wird gelöscht, der Hinweis „Verworfen – …“ steht im Kopf; mit
 * Verbindung kommt der Stand des Servers.
 *
 * Jeder Fall legt eine eigene Kopie des Freigabe-Cup an und räumt sie im `finally` ab (wie CA-7). Nur cloud-desktop.
 * Bildschirmfotos (Handy 360, Desktop) nur, wenn `E2E_BILDER_DIR` gesetzt ist (Skill visuelle-pruefung), nie in der CI.
 */
import path from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { fetchUserIdByEmail, newRoleContext } from './engineHelpers';
import { fetchQueuedMutationTypes, queueKeys, safeCleanup } from './helpers';
import { restAsRole } from './restAsRole';
import { E2E_USERS } from './testData';
import { cloneReleaseCup, cupRow, deleteCup, localCopy, type ClonedCup } from './coadminEinsatz';

const KONFLIKT_TEXT = 'Turnier wurde inzwischen auf einem anderen Gerät geändert';
const VERWERFEN_UND_LADEN = 'Verwerfen und aktuellen Stand laden';
const WARTE_HINWEIS = 'Verworfen – der Stand des Servers wird geladen, sobald die Verbindung steht';

/**
 * Bildbefund Fixrunde (Handy 360): das Element liegt ganz im Bild, nichts darin ragt seitlich heraus, die Seite scrollt nicht
 * waagerecht. Liefert das Rechteck für weitere Prüfungen.
 */
async function expectInsideViewport(page: Page, locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) { throw new Error('Element ohne Rechteck'); }
  const width = page.viewportSize()?.width ?? 0;
  expect(box.x, 'linker Rand im Bild').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'rechter Rand im Bild').toBeLessThanOrEqual(width);
  const inner = await locator.evaluate((el) => {
    const outer = el.getBoundingClientRect();
    const outside = [...el.querySelectorAll('*')].filter((child) => {
      const r = child.getBoundingClientRect();
      return r.width > 0 && (r.left < outer.left - 0.5 || r.right > outer.right + 0.5);
    }).length;
    return { outside, clipped: el.scrollWidth > el.clientWidth + 1, pageScroll: document.documentElement.scrollWidth > window.innerWidth };
  });
  expect(inner, 'kein Überlauf').toEqual({ outside: 0, clipped: false, pageScroll: false });
  return box;
}

async function bild(page: Page, name: string): Promise<void> {
  const dir = process.env.E2E_BILDER_DIR;
  if (!dir) { return; }
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
}

/** Ort über die Oberfläche ändern, OHNE auf die Cloud zu warten (das Gerät ist ohne Netz). */
async function editLocationOffline(page: Page, cup: ClonedCup, name: string, userId: string): Promise<void> {
  await page.goto(`/#/tournament/${cup.id}/settings`);
  await page.getByText('Metadaten bearbeiten').click();
  await page.getByLabel(/^Veranstaltungsort/).fill(name);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect.poll(() => fetchQueuedMutationTypes(page, userId), { timeout: 10000 }).toContain('SAVE_TOURNAMENT');
  await expect.poll(async () => (await localCopy(page, cup.id))?.locationName, { timeout: 10000 }).toBe(name);
}

/** Den wartenden SAVE_TOURNAMENT des Turniers in den Dead-Letter legen (wie nach MAX_RETRIES), mit dem Grund. */
async function intoDeadLetter(page: Page, userId: string, tournamentId: string, reason: { conflict: boolean; lastError: string }): Promise<string> {
  const keys = queueKeys(userId);
  return page.evaluate(({ queueKey, failedKey, id, conflict, lastError }) => {
    const queued = JSON.parse(window.localStorage.getItem(queueKey) ?? '[]') as Array<{ id: string; type: string; payload: { id?: string } }>;
    const item = queued.find((entry) => entry.type === 'SAVE_TOURNAMENT' && entry.payload.id === id);
    if (!item) { throw new Error('kein wartender SAVE_TOURNAMENT'); }
    const failed = { ...item, retryCount: 5, failedAt: Date.now(), lastError, ...(conflict ? { conflict: true } : {}) };
    window.localStorage.setItem(queueKey, JSON.stringify(queued.filter((entry) => entry.id !== item.id)));
    window.localStorage.setItem(failedKey, JSON.stringify([failed]));
    return item.id;
  }, { queueKey: keys.queue, failedKey: keys.failed, id: tournamentId, ...reason });
}

async function openSchedule(page: Page, cup: ClonedCup): Promise<void> {
  await page.goto(`/#/tournament/${cup.id}/schedule`);
  await page.waitForLoadState('networkidle');
}

/** Admin Center des Turniers: dort steht die Übertragungs-Anzeige im Kopf (`AdminHeader` → `SyncStatusIndicator`). */
async function openAdmin(page: Page, cup: ClonedCup): Promise<void> {
  await page.goto(`/#/tournament/${cup.id}/admin/visibility`);
  await page.waitForLoadState('networkidle');
}

test.describe('Verwerfen und Konflikt in der Liste gestörter Übertragungen (T2-UI)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Eigene Turnierkopien je Fall, nur auf cloud-desktop.');
  });

  test('@FU-108 @FU-106 Konflikt: Hinweis „anderes Gerät“, kein „Erneut versuchen“, „Verwerfen und aktuellen Stand laden“ – danach Ollis Stand', async ({ browser }) => {
    test.setTimeout(180_000);
    const cup = await cloneReleaseCup('verwerfen-konflikt');
    const maria = await newRoleContext(browser, 'coadmin');
    try {
      const mariaId = await fetchUserIdByEmail(E2E_USERS.coadmin.email);
      await openSchedule(maria.page, cup);
      await expect.poll(() => localCopy(maria.page, cup.id), { timeout: 30000 }).not.toBeNull();

      await maria.context.setOffline(true);
      await editLocationOffline(maria.page, cup, 'Marias Halle', mariaId);
      // Olli speichert inzwischen am Server (Ort + Versionszählung mit Versionsprüfung wie SupabaseRepository.save)
      const version = (await cupRow(cup.id)).version ?? 1;
      const olli = await restAsRole('owner', 'PATCH', `tournaments?id=eq.${cup.id}&version=eq.${version}`, { location_name: 'Ollis Halle', version: version + 1 });
      expect(olli.status, olli.text).toBeLessThan(300);
      const entryId = await intoDeadLetter(maria.page, mariaId, cup.id, { conflict: true, lastError: 'Turnier wurde zwischenzeitlich verändert. Bitte neu laden.' });
      await maria.context.setOffline(false);
      await openAdmin(maria.page, cup);
      await maria.page.reload();
      await maria.page.waitForLoadState('networkidle');
      expect((await localCopy(maria.page, cup.id))?.locationName, 'Regel Q: der Eintrag schützt die Kopie').toBe('Marias Halle');

      const syncStatus = maria.page.locator('[data-testid="sync-status"]');
      await expect(syncStatus).toHaveAttribute('data-state', 'error', { timeout: 10000 });
      await syncStatus.click();
      const list = maria.page.locator('[data-testid="sync-failed-list"]');
      await expect(list).toBeVisible({ timeout: 5000 });
      await expect(maria.page.getByTestId(`sync-failed-reason-${entryId}`)).toHaveText(KONFLIKT_TEXT);
      await expect(maria.page.getByTestId(`sync-retry-${entryId}`)).toHaveCount(0);
      await expect(list.getByText('Erneut versuchen')).toHaveCount(0);
      const discard = maria.page.getByTestId(`sync-discard-${entryId}`);
      await expect(discard).toHaveText(VERWERFEN_UND_LADEN);
      await bild(maria.page, 'konflikt-liste-desktop-v2');
      // Handy: der Kopf baut sich beim Größenwechsel neu auf (Liste zu) – dort erneut öffnen, prüfen und verwerfen
      await maria.page.setViewportSize({ width: 360, height: 780 });
      await expect(list).toHaveCount(0, { timeout: 5000 });
      await syncStatus.click();
      await expect(list).toBeVisible({ timeout: 5000 });
      await expect(maria.page.getByTestId(`sync-failed-reason-${entryId}`)).toHaveText(KONFLIKT_TEXT);
      await expect(maria.page.getByTestId(`sync-retry-${entryId}`)).toHaveCount(0);
      await expect(discard).toHaveText(VERWERFEN_UND_LADEN);
      await expectInsideViewport(maria.page, list); // Bildbefund: das Popover lief links aus dem Bild
      await expectInsideViewport(maria.page, maria.page.getByTestId(`sync-failed-reason-${entryId}`));
      await bild(maria.page, 'konflikt-liste-handy-360-v2');

      await discard.click();
      await maria.page.locator('[data-testid="confirm-dialog-confirm"]').click();

      await expect.poll(async () => (await localCopy(maria.page, cup.id))?.locationName, { message: '@FU-106: Ollis Stand', timeout: 10000 }).toBe('Ollis Halle');
      await expect(syncStatus).not.toHaveAttribute('data-state', 'error', { timeout: 10000 });
      expect((await cupRow(cup.id)).location_name, 'Ollis Änderung bleibt').toBe('Ollis Halle');
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
      await maria.context.close();
    }
  });

  test('@FU-109 ohne Verbindung verworfen: nichts gelöscht, Hinweis im Kopf; mit Verbindung kommt der Stand des Servers', async ({ browser }) => {
    test.setTimeout(180_000);
    const cup = await cloneReleaseCup('verwerfen-offline', { withCoAdmin: false });
    const olli = await newRoleContext(browser, 'owner');
    try {
      const olliId = await fetchUserIdByEmail(E2E_USERS.owner.email);
      const serverOrt = (await cupRow(cup.id)).location_name;
      await openSchedule(olli.page, cup);
      await expect.poll(() => localCopy(olli.page, cup.id), { timeout: 30000 }).not.toBeNull();

      await olli.context.setOffline(true);
      await editLocationOffline(olli.page, cup, 'Verworfene Halle', olliId);
      const entryId = await intoDeadLetter(olli.page, olliId, cup.id, { conflict: false, lastError: 'Spiel zeigt noch auf ein Team, das gelöscht würde' });
      await olli.context.setOffline(false);
      await openAdmin(olli.page, cup);
      await olli.page.reload();
      await olli.page.waitForLoadState('networkidle');

      await olli.context.setOffline(true); // Hallen-WLAN weg
      const syncStatus = olli.page.locator('[data-testid="sync-status"]');
      await expect(syncStatus).toHaveAttribute('data-state', 'error', { timeout: 10000 });
      await syncStatus.click();
      await expect(olli.page.getByTestId(`sync-retry-${entryId}`)).toHaveCount(1); // ohne Konflikt bleibt „Erneut versuchen“
      await olli.page.getByTestId(`sync-discard-${entryId}`).click();
      await olli.page.locator('[data-testid="confirm-dialog-confirm"]').click();

      const hinweis = olli.page.getByTestId('sync-awaiting-server-copy');
      await expect(hinweis).toHaveText(WARTE_HINWEIS, { timeout: 10000 });
      expect((await localCopy(olli.page, cup.id))?.locationName, 'nichts gelöscht').toBe('Verworfene Halle');
      await bild(olli.page, 'warte-hinweis-desktop-v2');
      await olli.page.setViewportSize({ width: 360, height: 780 });
      await expect.poll(async () => (await hinweis.boundingBox())?.width ?? 0, { message: 'Statuszeile über die volle Breite', timeout: 5000 }).toBeGreaterThanOrEqual(359);
      // Bildbefund: der Hinweis lief rechts aus dem Bild – auf dem Handy eine Statuszeile über die volle Breite unter dem Kopf
      const zeile = await expectInsideViewport(olli.page, hinweis);
      expect(zeile.width, 'volle Breite').toBeGreaterThanOrEqual(359);
      expect(await hinweis.evaluate((el) => getComputedStyle(el).backgroundColor), 'deckend (Inhalt scheint nicht durch)').toMatch(/^rgb\(/);
      const kopf = await olli.page.locator('header').first().boundingBox();
      if (kopf) { expect(zeile.y, 'unter dem Kopf').toBeGreaterThanOrEqual(kopf.y + kopf.height - 1); }
      const banner = olli.page.getByTestId('offline-banner');
      if (await banner.isVisible()) {
        const unten = await banner.boundingBox();
        expect(unten && zeile.y + zeile.height <= unten.y, 'verdeckt das Offline-Banner nicht').toBe(true);
      }
      await bild(olli.page, 'warte-hinweis-handy-360-v2');
      await olli.page.setViewportSize({ width: 1280, height: 800 });

      await olli.context.setOffline(false);
      await expect.poll(async () => (await localCopy(olli.page, cup.id))?.locationName, { message: '@FU-109: Stand des Servers spätestens 10 s nach Rückkehr der Verbindung', timeout: 10000 }).toBe(serverOrt);
      await expect(hinweis).toHaveCount(0, { timeout: 10000 });
      expect((await cupRow(cup.id)).location_name, 'nichts ging zum Server').toBe(serverOrt);
    } finally {
      await safeCleanup('Kopie löschen', () => deleteCup(cup.id));
      await olli.context.close();
    }
  });
});
