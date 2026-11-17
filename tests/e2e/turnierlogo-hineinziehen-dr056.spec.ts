/**
 * @DR-056 Das Turnierlogo lässt sich auch hineinziehen – im echten Browser, im Assistenten, Schritt 1 „Stammdaten“, ohne Datenbank.
 * Das Ablegen wird mit einem `DataTransfer` und echten DragEvents (dragenter/dragover/drop) auf das Feld simuliert; aufbereitet
 * und gespeichert wird wie nach „Datei auswählen“ (echter Aufbereiter, echter Gerätespeicher). Breiten 390 und 1440, Bilder
 * (Ruhe, Ablege-Zustand, Fehlermeldung; hell, am Handy auch dunkel) in den Ordner aus DR056_BILDER.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { t } from './helpers/i18n';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#1a3a8f"/><circle cx="100" cy="50" r="30" fill="#ffffff"/></svg>';
interface Ablage { name: string; type: string; inhalt: string }
const wappen: Ablage = { name: 'wappen.svg', type: 'image/svg+xml', inhalt: SVG };
const liste: Ablage = { name: 'liste.pdf', type: 'application/pdf', inhalt: '%PDF-1.4 kein Bild' };

/** Ein DragEvent mit Dateien (oder Text) auf das Feld auslösen, so wie der Browser es beim Ziehen aus dem Dateimanager tut. */
async function ziehe(feld: Locator, art: 'dragenter' | 'dragover' | 'drop' | 'dragleave', dateien: Ablage[], alsText = false): Promise<void> {
  await feld.evaluate((element, { ereignis, dateien: liste, alsText: text }) => {
    const dt = new DataTransfer();
    if (text) { dt.setData('text/plain', 'markierter Text'); }
    for (const datei of liste) { dt.items.add(new File([datei.inhalt], datei.name, { type: datei.type })); }
    element.dispatchEvent(new DragEvent(ereignis, { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, { ereignis: art, dateien, alsText });
}

async function bild(feld: Locator, name: string): Promise<void> {
  const ordner = process.env.DR056_BILDER;
  if (ordner === undefined) { return; }
  mkdirSync(ordner, { recursive: true });
  await feld.screenshot({ path: join(ordner, `${name}.png`) });
}

const GROESSEN = [{ breite: 390, hoehe: 844 }, { breite: 1440, hoehe: 900 }] as const;

for (const { breite, hoehe } of GROESSEN) {
  test.describe(`Turnierlogo hineinziehen bei ${breite} px`, () => {
    let feld: Locator;
    const oeffne = async (page: Page, farbschema: 'light' | 'dark' = 'light'): Promise<void> => {
      await page.setViewportSize({ width: breite, height: hoehe });
      await page.emulateMedia({ colorScheme: farbschema });
      await page.goto('/#/tournament/new');
      await expect(page.getByRole('heading', { name: t('wizard:step3.title') })).toBeVisible();
      feld = page.getByTestId('turnierlogo-feld');
      await expect(feld).toBeVisible();
    };

    test('@DR-056 „wappen.svg“ auf die linke Grafik ziehen: übernommen wie nach „Datei auswählen“; Ruhe und Ablege-Zustand sind zu sehen', async ({ page }) => {
      await oeffne(page);
      await bild(feld, `logo-ruhe-${breite}-hell`);

      await ziehe(feld, 'dragenter', [wappen]);
      await ziehe(feld, 'dragover', [wappen]);
      await expect(page.getByTestId('turnierlogo-ablegen')).toHaveText(t('wizard:step3.graphics.drop'));
      await expect(feld).toHaveCSS('border-top-style', 'dashed');
      await bild(feld, `logo-ablegen-${breite}-hell`);
      await ziehe(feld, 'dragleave', [wappen]);
      await expect(page.getByTestId('turnierlogo-ablegen')).toHaveCount(0);
      await expect(feld).toHaveCSS('border-top-style', 'solid');

      await ziehe(feld, 'drop', [wappen]);

      await expect(page.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', /^data:image\/png/);
      await expect(page.getByTestId('akzent-tupfer')).toHaveAttribute('data-accent', /^#[0-9A-F]{6}$/i);
      await expect(page.getByTestId('turnierlogo-ablegen')).toHaveCount(0);
      await expect(page.getByTestId('turnierlogo-hochladen')).toHaveCount(0); // mit Grafik steht dort „Ändern“, wie nach der Dateiwahl
    });

    test('@DR-056 zwei Dateien: die hinterlegte Grafik bleibt, der Grund steht am Feld', async ({ page }) => {
      await oeffne(page);
      await ziehe(feld, 'drop', [wappen]);
      const vorschau = page.getByTestId('turnierlogo-vorschau');
      await expect(vorschau).toBeVisible();
      const vorher = await vorschau.getAttribute('src');

      await ziehe(feld, 'drop', [wappen, { ...wappen, name: 'zweites.svg' }]);

      await expect(page.getByTestId('turnierlogo-fehler')).toContainText(t('wizard:step3.graphics.error.multiple'));
      await expect(page.getByTestId('turnierlogo-fehler')).toContainText(t('wizard:step3.graphics.logo.keeps'));
      await expect(vorschau).toHaveAttribute('src', vorher ?? '');
      await bild(feld, `logo-fehler-mehrere-${breite}-hell`);
    });

    test('@DR-056 Datei falscher Art: die hinterlegte Grafik bleibt, der Grund steht am Feld', async ({ page }) => {
      await oeffne(page);
      await ziehe(feld, 'drop', [wappen]);
      const vorschau = page.getByTestId('turnierlogo-vorschau');
      await expect(vorschau).toBeVisible();
      const vorher = await vorschau.getAttribute('src');

      await ziehe(feld, 'drop', [liste]);

      await expect(page.getByTestId('turnierlogo-fehler')).toContainText(t('wizard:step3.graphics.error.type'));
      await expect(vorschau).toHaveAttribute('src', vorher ?? '');
      await bild(feld, `logo-fehler-art-${breite}-hell`);
    });

    test('@DR-056 etwas ohne Datei (Text): nichts wird übernommen, der Grund steht am Feld', async ({ page }) => {
      await oeffne(page);

      await ziehe(feld, 'drop', [], true);

      await expect(page.getByTestId('turnierlogo-fehler')).toContainText(t('wizard:step3.graphics.error.none'));
      await expect(page.getByTestId('turnierlogo-vorschau')).toHaveCount(0);
    });

    test('@DR-056 rechte Grafik: auch das zweite Feld nimmt eine abgelegte Datei an, das Logo links bleibt', async ({ page }) => {
      await oeffne(page);
      await ziehe(feld, 'drop', [wappen]);
      await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
      const links = await page.getByTestId('turnierlogo-vorschau').getAttribute('src');
      const rechts = page.getByTestId('zweite-grafik-feld');

      await ziehe(rechts, 'dragenter', [wappen]);
      await bild(rechts, `zweite-grafik-ablegen-${breite}-hell`);
      await ziehe(rechts, 'drop', [{ ...wappen, name: 'sponsor.svg', inhalt: SVG.replace('#1a3a8f', '#8f1a1a') }]);

      await expect(page.getByTestId('zweite-grafik-vorschau')).toHaveAttribute('src', /^data:image\/png/);
      await expect(page.getByTestId('turnierlogo-vorschau')).toHaveAttribute('src', links ?? '');
    });

    test('@DR-056 die Taste „Logo hochladen“ und die Dateiwahl bleiben (Tastatur unverändert)', async ({ page }) => {
      await oeffne(page);
      const taste = page.getByTestId('turnierlogo-hochladen');
      await expect(taste).toBeVisible();
      await taste.focus();
      await expect(taste).toBeFocused();
      await page.getByTestId('turnierlogo-datei').setInputFiles({ name: 'wappen.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) });
      await expect(page.getByTestId('turnierlogo-vorschau')).toBeVisible();
    });
  });
}

test('@DR-056 dunkel bei 390 px: Ruhe, Ablege-Zustand und Fehlermeldung bleiben lesbar (Bilder)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#/tournament/new');
  await expect(page.getByRole('heading', { name: t('wizard:step3.title') })).toBeVisible();
  const feld = page.getByTestId('turnierlogo-feld');
  await bild(feld, 'logo-ruhe-390-dunkel');
  await ziehe(feld, 'dragenter', [wappen]);
  await expect(page.getByTestId('turnierlogo-ablegen')).toBeVisible();
  await bild(feld, 'logo-ablegen-390-dunkel');
  await ziehe(feld, 'drop', [wappen, { ...wappen, name: 'zweites.svg' }]);
  await expect(page.getByTestId('turnierlogo-fehler')).toBeVisible();
  await bild(feld, 'logo-fehler-390-dunkel');
});

test('@DR-056 Schritt „Stammdaten“ bei 360 px: kein waagerechtes Scrollen, auch im Ablege-Zustand (Bild)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/#/tournament/new');
  await expect(page.getByRole('heading', { name: t('wizard:step3.title') })).toBeVisible();
  const feld = page.getByTestId('turnierlogo-feld');
  await ziehe(feld, 'dragenter', [wappen]);
  await expect(page.getByTestId('turnierlogo-ablegen')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const ordner = process.env.DR056_BILDER;
  if (ordner !== undefined) { await page.screenshot({ path: join(ordner, 'wizard-stammdaten-360-ablegen.png'), fullPage: true }); }
});
