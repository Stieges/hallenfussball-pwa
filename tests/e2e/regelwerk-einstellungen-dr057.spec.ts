/**
 * @DR-057 Regelwerk im Reiter „Einstellungen“ → „Metadaten bearbeiten“ (Offline-Profil, ohne Supabase).
 * Regelwerk im Reiter ändern und speichern → in der Verwaltung unter „Meta-Daten“ steht der neue Text.
 * Gegenbeispiel: nur ein anderes Feld ändern → das Regelwerk (auch mit zerlegtem „ü“) bleibt in der Verwaltung unverändert.
 * Bilder (nur mit `RW_BILDER=<Ordner>` und `RW_NAME=<vorher|nachher>`): Reiter mit aufgeklapptem „Metadaten bearbeiten“.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const ID = 'rw-einstellungen-cup';
const NIKOLAUS = 'BFV Richtlinie für private Hallenturniere';
const ZERLEGT = 'BFV Richtlinie für private Hallenturniere';

const turnier = (rulebook: string) => buildVisualTournament({
  id: ID,
  title: 'Nikolaus-Turnier',
  extra: { organizer: 'TSV Nord', rulebook, ageClass: 'U11' },
});

const oeffneReiter = async (page: Page) => {
  await page.goto(`/#/tournament/${ID}/settings`);
  await page.getByText('Metadaten bearbeiten').first().click();
};

async function bild(page: Page, name: string): Promise<void> {
  const ordner = process.env.RW_BILDER;
  if (!ordner) { return; }
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: true });
}

test.describe('@DR-057 Regelwerk im Reiter „Einstellungen“', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  test('@DR-057 Regelwerk im Reiter ändern und speichern → die Verwaltung unter „Meta-Daten“ zeigt den neuen Text', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier(NIKOLAUS)] });
    await oeffneReiter(page);
    const feld = page.getByTestId('settings-rulebook');
    await expect(feld).toHaveValue(NIKOLAUS);

    await feld.fill('BFV-Richtlinien für Futsal');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Gespeichert').first()).toBeVisible();

    await page.goto(`/#/tournament/${ID}/admin/metadata`);
    await expect(page.getByTestId('metadata-rulebook')).toHaveValue('BFV-Richtlinien für Futsal');
  });

  test('@DR-057 Gegenbeispiel: nur den Veranstalter ändern → Regelwerk mit zerlegtem „ü“ bleibt in der Verwaltung unverändert', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier(ZERLEGT)] });
    await oeffneReiter(page);
    await page.getByLabel(/^Veranstalter/).fill('SV Süd');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Gespeichert').first()).toBeVisible();

    await page.goto(`/#/tournament/${ID}/admin/metadata`);
    expect(await page.getByTestId('metadata-rulebook').inputValue()).toBe(ZERLEGT);
  });

  for (const g of [{ n: '390', w: 390, h: 844 }, { n: '360', w: 360, h: 780 }, { n: '1440', w: 1440, h: 900 }]) {
    for (const thema of ['light', 'dark'] as const) {
      test(`Bild ${g.n} ${thema}: Reiter mit aufgeklapptem „Metadaten bearbeiten“, nichts läuft seitlich aus dem Bild`, async ({ page, seedIndexedDB }) => {
        test.skip(!process.env.RW_BILDER && thema === 'dark', 'Bilder nur auf Anforderung');
        await page.setViewportSize({ width: g.w, height: g.h });
        await page.emulateMedia({ colorScheme: thema });
        await seedIndexedDB({ tournaments: [turnier(NIKOLAUS)] });
        await oeffneReiter(page);
        await expect(page.getByLabel(/^Veranstalter/)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        await bild(page, `${process.env.RW_NAME ?? 'nachher'}-${g.n}-${thema}`);
      });
    }
  }
});
