/**
 * Monitor einrichten am Handy (@ME-074, @ME-075, @ME-076; Größen am Handy): offline, Projekte `desktop` und `mobile-sm`.
 * Nikolaus-Fall: ein Feld, sechs Teams ohne Gruppen. Bilder (nicht eingecheckt): Ordner aus MONITOR_PAKET_BILDER.
 */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { animationenFertig } from './helpers/animationenFertig';
import { neuLaden } from './helpers/neuLaden';
import { buildVisualTournament, freezeClock } from './visual/helpers';

const ID = 'nikolaus-monitor';
const TEAMS = ['TSV Waging', 'DJK Kammer', 'TSV Petting', 'DJK Otting', 'TSV Fridolfing', 'SV Tittmoning'].map((name, i) => ({
  id: `00000000-0000-4000-8000-00000000010${i}`, name,
}));
const SPIELE = [0, 2, 4].map((i, n) => ({
  id: `niko-${n}`, round: n + 1, teamA: TEAMS[i].id, teamB: TEAMS[i + 1].id, field: 1, matchStatus: 'scheduled' as const,
  scheduledTime: `2026-03-14T${10 + n}:00:00.000Z`,
}));
const MONITOR_LEER = {
  id: 'mon-1', name: 'Halle Nord', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500, theme: 'dark',
  performanceMode: 'auto', slides: [], createdAt: '2026-03-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z',
};

async function oeffneReiter(page: Page, seed: (d: Record<string, unknown>) => Promise<void>, monitors: Record<string, unknown>[] = []) {
  await freezeClock(page);
  await seed({
    tournaments: [buildVisualTournament({
      id: ID, title: 'Nikolaus-Turnier', matches: SPIELE, monitors,
      extra: { teams: TEAMS, numberOfTeams: 6, isPublic: true, shareCode: 'NIKO26' },
    })],
  });
  await page.goto(`/#/tournament/${ID}/monitors`);
  await expect(page.getByRole('heading', { name: 'Monitore' })).toBeVisible();
}

const hoehe = async (page: Page, testId: string) => (await page.getByTestId(testId).boundingBox())!.height;

test.describe('@ME-074 leerer Reiter', () => {
  test.beforeEach(({ browserName }) => { test.skip(browserName !== 'chromium'); });

  test('Hallen-Standard anlegen: Monitor steht mit vier Folien in der Liste, der Editor bleibt zu', async ({ page, seedIndexedDB }) => {
    await oeffneReiter(page, seedIndexedDB);
    const haupt = page.getByTestId('monitors-start-hallen-standard');
    expect(await hoehe(page, 'monitors-start-hallen-standard')).toBeGreaterThanOrEqual(56);
    await expect(page.getByTestId('monitors-start-hallen-standard-hint')).toContainText('Live-Spiel, Nächsten Spielen, Tabellen und Zuschauer-QR');
    await haupt.click();
    await expect(page.getByRole('heading', { name: 'Hallen-Standard' })).toBeVisible();
    await expect(page.getByText('4 Folien')).toBeVisible();
    await expect(page.getByTestId('monitor-editor-save')).toHaveCount(0);
    await expect(page.getByTestId('monitors-empty-start')).toHaveCount(0);
    // Gespeichert, nicht nur angezeigt: nach dem Neuladen ist der Monitor noch da (Gegenprobe: der Leerzustand bleibt weg)
    await neuLaden(page);
    await expect(page.getByRole('heading', { name: 'Monitore' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hallen-Standard' })).toBeVisible();
    await expect(page.getByText('4 Folien')).toBeVisible();
    await expect(page.getByTestId('monitors-empty-start')).toHaveCount(0);
    await page.getByRole('button', { name: /Hallen-Standard.*bearbeiten/ }).click();
    await expect(page.getByTestId(/^monitor-slide-row-/)).toHaveCount(4);
    // Gegenbeispiel: nichts davon ist „nicht eingerichtet“
    await expect(page.getByTestId('monitor-slide-problem')).toHaveCount(0);
  });
});

test.describe('@ME-075 @ME-076 Editor', () => {
  test.beforeEach(({ browserName }) => { test.skip(browserName !== 'chromium'); });

  test('Spielplan (Feld) bei einem Feld: vorbelegt, ohne Feldwahl; Tasten je Zeile mindestens 44 px', async ({ page, seedIndexedDB }) => {
    await oeffneReiter(page, seedIndexedDB, [MONITOR_LEER]);
    await page.getByRole('button', { name: /Halle Nord.*bearbeiten/ }).click();
    await page.getByTestId('monitor-add-slide').click();
    await page.getByTestId('monitor-add-slide-schedule-field').click();
    await expect(page.getByTestId('monitor-slide-desc')).toHaveText('Feld 1');
    await expect(page.getByLabel(/Spielfeld/)).toHaveCount(0);
    for (const name of ['Spielplan (Feld) nach oben', 'Spielplan (Feld) nach unten', 'Spielplan (Feld) bearbeiten', 'Spielplan (Feld) löschen']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.width, name).toBeGreaterThanOrEqual(44);
      expect(box!.height, name).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByRole('button', { name: 'Spielplan (Feld) bearbeiten' })).toHaveAttribute('aria-expanded', 'true');
    expect(await hoehe(page, 'monitor-editor-save')).toBeGreaterThanOrEqual(56);
  });

  test('Sponsor-Folie ohne Sponsor: Speichern fragt; „Zurück zum Editor“ bleibt im Editor, „Trotzdem speichern“ speichert', async ({ page, seedIndexedDB }) => {
    await oeffneReiter(page, seedIndexedDB, [MONITOR_LEER]);
    await page.getByRole('button', { name: /Halle Nord.*bearbeiten/ }).click();
    await page.getByTestId('monitor-add-slide').click();
    await page.getByTestId('monitor-add-slide-sponsor').click();
    await expect(page.getByTestId('monitor-slide-problem')).toHaveText('Sponsor fehlt');

    await page.getByTestId('monitor-editor-save').click();
    const dialog = page.getByTestId('monitor-unready-dialog');
    await expect(dialog).toContainText('1 Folie ist noch nicht eingerichtet und wird am Monitor nicht gezeigt. Trotzdem speichern?');
    await expect(dialog).toContainText('Sponsor: Sponsor fehlt');
    await page.getByRole('button', { name: 'Zurück zum Editor' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('monitor-editor-save')).toBeVisible();

    await page.getByTestId('monitor-editor-save').click();
    await page.getByRole('button', { name: 'Trotzdem speichern' }).click();
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await expect(page.getByTestId('monitor-editor-save')).toHaveCount(0);
    await expect(page.getByText('1 Folie')).toBeVisible();
  });

  test('Gegenbeispiel: alle Folien eingerichtet – Speichern ohne Rückfrage', async ({ page, seedIndexedDB }) => {
    await oeffneReiter(page, seedIndexedDB, [MONITOR_LEER]);
    await page.getByRole('button', { name: /Halle Nord.*bearbeiten/ }).click();
    await page.getByTestId('monitor-add-slide').click();
    await page.getByTestId('monitor-add-slide-live').click();
    await page.getByTestId('monitor-editor-save').click();
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await expect(page.getByTestId('monitor-unready-dialog')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Bilder für den Vorher/Nachher-Vergleich (nur mit MONITOR_PAKET_BILDER; nicht eingecheckt)
// ---------------------------------------------------------------------------------------------------------------
const GERAETE = [
  { praefix: 'handy', width: 390, height: 844 },
  { praefix: 'laptop', width: 1280, height: 800 },
] as const;

async function bild(page: Page, name: string) {
  await animationenFertig(page);
  const ordner = process.env.MONITOR_PAKET_BILDER!;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`) });
}

test.describe('Bilder Monitor einrichten (nachher)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(!process.env.MONITOR_PAKET_BILDER || testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'nur auf Anforderung');
  });

  for (const g of GERAETE) {
    test(`${g.praefix}: Ablauf Leer anlegen bis Rückfrage`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await oeffneReiter(page, seedIndexedDB);
      await bild(page, `${g.praefix}-01-reiter-leer`);
      await page.getByTestId('monitors-start-empty').click();
      await bild(page, `${g.praefix}-02-neu-dialog`);
      await page.getByLabel('Name des Monitors').fill('Halle Nord');
      await bild(page, `${g.praefix}-03-neu-dialog-name`);
      await page.getByTestId('monitor-create-submit').click();
      await expect(page.getByTestId('monitor-editor-save')).toBeVisible();
      await bild(page, `${g.praefix}-04-editor-oben`);
      await page.getByTestId('monitor-editor-save').scrollIntoViewIfNeeded();
      await page.getByTestId('monitor-add-slide').scrollIntoViewIfNeeded();
      await bild(page, `${g.praefix}-05-editor-unten`);
      await page.getByTestId('monitor-add-slide').click();
      await bild(page, `${g.praefix}-06-slide-arten`);

      const arten = ['live', 'standings', 'schedule-field', 'sponsor', 'custom-text', 'qr-code', 'all-standings', 'next-matches'];
      for (const [i, art] of arten.entries()) {
        if (i > 0) {await page.getByTestId('monitor-add-slide').click();}
        await page.getByTestId(`monitor-add-slide-${art}`).click();
        await page.getByTestId(/^monitor-slide-row-/).last().scrollIntoViewIfNeeded();
        await page.getByTestId('monitor-add-slide').scrollIntoViewIfNeeded();
        await bild(page, `${g.praefix}-${String(7 + i).padStart(2, '0')}-folie-${i + 1}-${art}`);
      }
      // Folienliste mit acht Folien: die zuletzt geöffnete Folie zuklappen
      await page.getByTestId(/^monitor-slide-edit-/).last().click();
      await page.getByTestId(/^monitor-slide-row-/).nth(3).scrollIntoViewIfNeeded();
      await bild(page, `${g.praefix}-15-editor-mitte-mit-folien`);

      await page.getByTestId('monitor-editor-save').click();
      await expect(page.getByTestId('monitor-unready-dialog')).toBeVisible();
      await bild(page, `${g.praefix}-20-rueckfrage-speichern`);
      await page.getByRole('button', { name: 'Zurück zum Editor' }).click();
      await bild(page, `${g.praefix}-21-zurueck-zur-ersten-folie`);
      await page.getByTestId('monitor-editor-save').click();
      await page.getByRole('button', { name: 'Trotzdem speichern' }).click();
      await expect(page.getByTestId('monitor-editor-save')).toHaveCount(0);
      await page.waitForTimeout(0);
      await bild(page, `${g.praefix}-16-nach-speichern`);
    });

    test(`${g.praefix}: Hallen-Standard anlegen`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await oeffneReiter(page, seedIndexedDB);
      await page.getByTestId('monitors-start-hallen-standard').click();
      await expect(page.getByText('4 Folien')).toBeVisible();
      await bild(page, `${g.praefix}-19-hallen-standard-liste`);
    });
  }

  for (const g of GERAETE) {
    test(`${g.praefix}: Monitor-Karte mit Adresse kopieren`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await oeffneReiter(page, seedIndexedDB, [{ ...MONITOR_LEER, slides: [
        { id: 'k1', type: 'live', config: {}, duration: null, order: 0 },
        { id: 'k2', type: 'next-matches', config: {}, duration: null, order: 1 },
      ] }]);
      await expect(page.getByText('Adresse kopieren')).toBeVisible();
      await bild(page, `${g.praefix}-30-monitor-karte`);
    });
  }

  test('handy dunkel: Leerzustand, Editor, Rückfrage', async ({ page, seedIndexedDB }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await oeffneReiter(page, seedIndexedDB);
    await bild(page, 'handy-dunkel-01-reiter-leer');
    await page.getByTestId('monitors-start-empty').click();
    await page.getByLabel('Name des Monitors').fill('Halle Nord');
    await page.getByTestId('monitor-create-submit').click();
    await expect(page.getByTestId('monitor-editor-save')).toBeVisible();
    await bild(page, 'handy-dunkel-04-editor-oben');
    await page.getByTestId('monitor-add-slide').click();
    await page.getByTestId('monitor-add-slide-sponsor').click();
    await page.getByTestId('monitor-editor-save').click();
    await expect(page.getByTestId('monitor-unready-dialog')).toBeVisible();
    await bild(page, 'handy-dunkel-20-rueckfrage-speichern');
  });
});
