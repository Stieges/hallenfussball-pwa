/**
 * Startseite am Turniertag (lokal, ohne Server, Gast). Szenarien (docs/anforderungen/):
 * @OB-078 Am Turniertag stehen die Turniere des Tages oben und offen (Handy 360×640, Sa 28.11. 08:00 / 09:10 / 12:40, mit und ohne Altlasten)
 * @OB-077 / @OB-030 / @OB-002 Filter ohne Farbe erkennbar, Suche und Filter in der Adresse, kein Filter „Beendet“
 * @LZ-094 Papierkorb leeren: eine Rückfrage, alle Turniere weg
 * @W1-041 Import speichert vor „Import erfolgreich“, Esc nach der Meldung verliert nichts
 * Läuft nur im Projekt `desktop` (setzt das Fenster selbst). Bilder (optional): Ordner aus SEITE_BILDER.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { baueTurniertagSaat, UHRZEIT, type Lage } from '../helpers/turniertagSaat';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const BILDER = process.env.SEITE_BILDER;
const HANDY = { width: 360, height: 640 };
// Karten, nicht die Altersklassen-Zeile (`tournament-card-age-class`)
const KARTE = '[data-testid^="tournament-card-"]:not([data-testid="tournament-card-age-class"])';

type Variante = { lage: Lage; altlasten?: boolean };

function seed({ tournaments }: { tournaments: unknown[] }) {
  localStorage.setItem('hallenfussball-settings', JSON.stringify({ language: 'de' }));
  const req = indexedDB.open('hallenfussball', 1);
  req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('cache')) { req.result.createObjectStore('cache', { keyPath: 'key' }); } };
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').put({ key: 'tournaments', value: tournaments });
    tx.oncomplete = () => db.close();
  };
}

async function oeffne(page: Page, { lage, altlasten = false }: Variante, pfad = '/#/') {
  await page.context().addInitScript(seed, { tournaments: baueTurniertagSaat(lage, altlasten) });
  await page.clock.setFixedTime(new Date(UHRZEIT[lage]));
  await page.goto(pfad);
  await page.waitForSelector('[data-testid="dashboard-import-trigger"]', { timeout: 20000 });
}

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(BILDER, `${name}.png`), fullPage: true });
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop') || testInfo.project.name.includes('webkit'), 'Nur desktop (setzt Fenster selbst).');
  await page.setViewportSize(HANDY);
});

test.describe('@OB-078 Am Turniertag stehen die Turniere des Tages oben und offen', () => {
  const faelle: Array<[string, Variante, string, string]> = [
    ['08:00 nichts angepfiffen', { lage: 'bereit' }, 'tw-f2', 'status.upcoming'],
    ['09:10 F2 läuft', { lage: 'f2laeuft' }, 'tw-f2', 'status.running'],
    ['12:40 F2 abgeschlossen', { lage: 'f2fertig' }, 'tw-f1', 'status.upcoming'],
  ];
  for (const altlasten of [false, true]) {
    for (const [name, variante, erste] of faelle) {
      test(`${name}${altlasten ? ' (mit Herbstcup und Probe-Kopie)' : ''}: ${erste} ist die erste Karte unter „Heute“, ohne Scrollen sichtbar`, async ({ page }) => {
        await oeffne(page, { ...variante, altlasten });
        const heute = page.getByTestId('section-heute');
        await expect(heute).toBeVisible();
        const karten = heute.locator('[data-testid^="tournament-card-"]');
        await expect(karten.first()).toHaveAttribute('data-testid', `tournament-card-${erste}`);
        // der Titel der ersten Karte liegt vor dem Falz und über der festen unteren Leiste (64 px)
        const titel = await karten.first().getByRole('heading').boundingBox();
        expect(titel).not.toBeNull();
        expect(titel!.y + titel!.height).toBeLessThanOrEqual(HANDY.height - 64);
        // „Heute“ steht über allen anderen Abschnitten und ist offen
        const reihenfolge = await page.locator('[data-testid^="section-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
        expect(reihenfolge[0]).toBe('section-heute');
        await expect(heute.locator('[aria-expanded]').first()).toHaveAttribute('aria-expanded', 'true');
        // ohne waagerechtes Scrollen (@OB-021)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await bild(page, `turniertag-${variante.lage}${altlasten ? '-altlasten' : ''}`);
      });
    }
  }

  test('Probe-Kopie und Herbstcup stehen nicht über den Turnieren von heute', async ({ page }) => {
    await oeffne(page, { lage: 'bereit', altlasten: true });
    const ids = await page.locator(KARTE).evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')?.replace('tournament-card-', '')));
    const heuteEnde = Math.max(ids.indexOf('tw-f2'), ids.indexOf('tw-f1'), ids.indexOf('tw-d'));
    expect(ids.indexOf('tw-herbst')).toBeGreaterThan(heuteEnde);
    expect(ids.indexOf('tw-probe')).toBeGreaterThan(heuteEnde);
    await expect(page.getByTestId('section-heute').getByTestId('tournament-card-tw-herbst')).toHaveCount(0);
  });
});

test.describe('@OB-077 @OB-030 @OB-002 Suche und Filter der Startseite', () => {
  test('es gibt drei Filter, keinen „Beendet“; ein gesetzter Filter trägt Häkchen und Fettschrift', async ({ page }) => {
    await oeffne(page, { lage: 'f2laeuft' });
    await expect(page.locator('[data-testid^="filter-chip-"]')).toHaveCount(3);
    await expect(page.getByTestId('filter-chip-finished')).toHaveCount(0);
    const laeuft = page.getByTestId('filter-chip-running');
    await laeuft.click();
    await expect(laeuft).toHaveAttribute('aria-pressed', 'true');
    await expect(laeuft).toHaveAccessibleName(/gewählt/);
    expect(await laeuft.locator('svg').count()).toBeGreaterThan(0);
    await expect.poll(async () => Number(await laeuft.evaluate((el) => getComputedStyle(el).fontWeight))).toBeGreaterThanOrEqual(700); // Übergang 0,2 s
    // der Grund ist sichtbar gefüllt (vorher: ungültiges CSS, durchsichtig)
    await expect.poll(() => laeuft.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    await bild(page, 'filter-gesetzt');
  });

  test('Suche „F1“ und Filter „Läuft“ stehen in der Adresse; Neu laden stellt beides wieder her', async ({ page }) => {
    await oeffne(page, { lage: 'f2laeuft' });
    await page.getByTestId('search-input').fill('F');
    await page.getByTestId('filter-chip-running').click();
    await expect.poll(() => page.url()).toMatch(/[?&]q=F\b/);
    await expect.poll(() => page.url()).toContain('s=running');
    await page.reload();
    await page.waitForSelector('[data-testid="search-input"]');
    await expect(page.getByTestId('search-input')).toHaveValue('F');
    await expect(page.getByTestId('filter-chip-running')).toHaveAttribute('aria-pressed', 'true');
    // nur F2 läuft: genau eine Karte
    await expect(page.locator(KARTE)).toHaveCount(1);
    await expect(page.getByTestId('tournament-card-tw-f2')).toBeVisible();
  });

  test('ein geteilter Link mit Suche öffnet die gefilterte Liste', async ({ page }) => {
    await oeffne(page, { lage: 'bereit' }, '/#/?q=F1');
    await expect(page.getByTestId('search-input')).toHaveValue('F1');
    await expect(page.locator(KARTE)).toHaveCount(1);
    await expect(page.getByTestId('tournament-card-tw-f1')).toBeVisible();
  });
});

test.describe('@LZ-094 Papierkorb leeren', () => {
  test('eine Rückfrage, danach ist der Papierkorb leer', async ({ page }) => {
    await oeffne(page, { lage: 'bereit' }, '/#/papierkorb');
    await expect(page.locator('[data-testid^="trash-card-"]')).toHaveCount(2);
    await bild(page, 'papierkorb-zwei');
    await page.getByTestId('trash-empty-button').click();
    await bild(page, 'papierkorb-rueckfrage');
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByTestId('confirm-dialog-confirm')).toHaveCount(0); // keine zweite Rückfrage
    await expect(page.locator('[data-testid^="trash-card-"]')).toHaveCount(0, { timeout: 10000 });
    await page.waitForTimeout(500);
    await expect(page.getByTestId('confirm-dialog-confirm')).toHaveCount(0);
    await bild(page, 'papierkorb-leer');
  });
});

test.describe('@W1-041 Import meldet Erfolg erst nach dem Speichern', () => {
  test('Esc nach „Import erfolgreich“: das Turnier steht auf der Startseite', async ({ page }) => {
    await oeffne(page, { lage: 'bereit' });
    const vorher = await page.locator(KARTE).count();
    await page.getByTestId('dashboard-import-trigger').click();
    await page.getByTestId('import-file-input').setInputFiles(path.resolve(HIER, '../fixtures/sample-tournament.json'));
    await page.getByTestId('import-warnings-continue').click();
    await page.getByTestId('import-confirm').click();
    await expect(page.getByTestId('import-success-go')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('import-success-hint')).toBeVisible();
    await bild(page, 'import-erfolg');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('import-success-go')).toHaveCount(0);
    await expect(page.locator(KARTE)).toHaveCount(vorher + 1, { timeout: 10000 });
  });
});
