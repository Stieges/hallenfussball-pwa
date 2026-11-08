/**
 * Paket M · Monitor-Stabilität im Browser (Regel T2-UI) – über den Prüfstand tests/e2e/harness/monitor-stabil.html (ganze Monitor-Seite, eingespeiste
 * Datenquelle, Playwright-Uhr: die 30 Sekunden werden vorgespult, nicht abgewartet).
 * @ME-030 / @ZM-085: bleibt die Antwort 30 Sekunden aus (Netz weg oder Abruf hängt), steht unten rechts nur ein Symbol mit Ausrufezeichen, ohne Text,
 * die Restzeit läuft unverändert weiter; mit der nächsten Antwort ist das Symbol weg (@ME-007). @ZM-199: Uhrformat wie im Cockpit. @ZM-198: Tabelle ohne
 * Platz vor dem ersten beendeten Spiel. @ZM-087: echte lange Namen vollständig lesbar.
 * Bilder (Tag @bilder, nur Aufnahme ohne Prüfung): Ordner aus MONITOR_STABIL_BILDER. Nur am Dev-Server (gehört nicht in den Build).
 */
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { test, expect, type Locator, type Page } from '@playwright/test';

const BILDER = process.env.MONITOR_STABIL_BILDER ?? '';
const imGebautenStand = !!process.env.CI_E2E_USE_PREVIEW;
/** 14:32 Ortszeit (Europe/Berlin im November: UTC+1) */
const UM_1432 = new Date('2026-11-28T13:32:00Z');
const PROFILE = [{ name: '1080', width: 1920, height: 1080 }, { name: '720', width: 1280, height: 720 }] as const;
type Szene = 'live' | 'lang' | 'tabelle' | 'naechste';

async function oeffne(page: Page, szene: Szene, profil: (typeof PROFILE)[number] = PROFILE[0], rand = 5): Promise<void> {
  await page.setViewportSize({ width: profil.width, height: profil.height });
  await page.clock.install({ time: UM_1432 });
  await page.goto(`/tests/e2e/harness/monitor-stabil.html?szene=${szene}&rand=${String(rand)}`);
  const bereit = szene === 'tabelle' ? '[data-testid="standings-row"]' : szene === 'naechste' ? '[data-testid="monitor-match-row"]' : '[data-testid="monitor-clock"]';
  await expect(page.locator(bereit).first()).toBeVisible({ timeout: 15_000 });
}

async function netz(page: Page, zustand: boolean | 'haengt'): Promise<void> {
  await page.evaluate((z) => { window.__netz = z; }, zustand);
}

async function box(l: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  const b = await l.boundingBox();
  if (b === null) { throw new Error('Element nicht im Bild'); }
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

async function bild(page: Page, name: string): Promise<void> {
  if (BILDER === '') { return; }
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}${process.env.MONITOR_STABIL_SUFFIX ?? ''}.png`) });
}

declare global {
  interface Window { __netz: boolean | 'haengt' }
}

test.describe('Monitor-Stabilität (Paket M)', () => {
  test.skip(imGebautenStand, 'Prüfstand nur am Dev-Server (gehört nicht in den Build)');
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Monitor 1920×1080 und 1280×720: ein Projekt genügt');
  });

  for (const art of [false, 'haengt'] as const) {
    test(`@ME-030 @ZM-085 @ME-007 ${art === false ? 'Netz weg' : 'Abruf hängt'}: nach 30 s nur ein Symbol ohne Text, Uhr unverändert; Netz zurück: Symbol weg`, async ({ page }) => {
      await oeffne(page, 'live');
      await expect(page.getByTestId('monitor-connection-hint')).toHaveCount(0);

      await netz(page, art);
      await page.clock.runFor(29_000);
      await expect(page.getByTestId('monitor-connection-hint')).toHaveCount(0);
      await page.clock.runFor(2_000);
      const hinweis = page.getByTestId('monitor-connection-hint');
      // nur ein Symbol, kein Text; der Name nur für Vorlese-Programme
      await expect(hinweis).toHaveText('');
      await expect(hinweis).toHaveAttribute('aria-label', 'Keine Verbindung seit 14:32');
      await expect(hinweis.locator('svg')).toBeVisible();
      // die Restzeit läuft unverändert weiter (ohne Kennzeichnung): 6:00 minus 31 Sekunden
      await expect(page.getByTestId('clock-label')).toHaveText('Restzeit');
      await expect(page.getByTestId('monitor-clock')).toHaveText('5:29');
      // das Bild bleibt: Spiel, Namen und Uhr stehen weiter da
      await expect(page.getByTestId('live-block-home')).toBeVisible();

      // Lage: ganz im Bild, unten rechts, innerhalb des Bildrands, ohne Uhr und Kästen zu überdecken
      const h = await box(hinweis);
      const vp = page.viewportSize()!;
      expect(h.x + h.w).toBeLessThanOrEqual(vp.width * 0.95 + 1);
      expect(h.y + h.h).toBeLessThanOrEqual(vp.height * 0.95 + 1);
      expect(h.x).toBeGreaterThan(vp.width / 2);
      expect(h.y).toBeGreaterThan(vp.height / 2);
      for (const id of ['monitor-clock', 'live-block-home', 'live-block-away']) {
        const b = await box(page.getByTestId(id));
        const schneidet = h.x < b.x + b.w && h.x + h.w > b.x && h.y < b.y + b.h && h.y + h.h > b.y;
        expect(schneidet, `Hinweis überdeckt ${id}`).toBe(false);
      }

      await netz(page, true);
      await page.clock.runFor(3_000);
      await expect(page.getByTestId('monitor-connection-hint')).toHaveCount(0);
      await expect(page.getByTestId('clock-label')).toHaveText('Restzeit');
    });
  }

  test('Gegenbeispiel: ein Aussetzer von 20 Sekunden bleibt still', async ({ page }) => {
    await oeffne(page, 'live');
    await netz(page, false);
    await page.clock.runFor(20_000);
    await netz(page, true);
    await page.clock.runFor(40_000);
    await expect(page.getByTestId('monitor-connection-hint')).toHaveCount(0);
  });

  test('@ZM-199 Uhrformat wie im Cockpit: Minuten ohne führende Null, Sekunden zweistellig', async ({ page }) => {
    await oeffne(page, 'live');
    const text = (await page.getByTestId('monitor-clock').textContent()) ?? '';
    expect(text).toMatch(/^[1-9]\d?:\d{2}$/);
    expect(text).toBe('6:00');
  });

  test('@ZM-198 Turnierbeginn: die Spalte Platz zeigt bei allen 6 Teams „–“, Teilnehmerliste, alle Zahlen 0', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.clock.install({ time: new Date('2026-11-28T07:30:00Z') });
    await page.goto('/tests/e2e/harness/monitor-stabil.html?szene=tabelle&rand=5');
    const zeilen = page.locator('[data-testid="standings-row"]');
    await expect(zeilen).toHaveCount(6);
    for (let i = 0; i < 6; i += 1) {
      await expect(zeilen.nth(i).locator('> div').first()).toHaveText('–');
      await expect(zeilen.nth(i).getByTestId('standings-won')).toHaveText('0');
    }
    await expect(zeilen.nth(0).locator('[data-teamname]')).toHaveText('SV Kirchanschöring');
  });

  for (const profil of PROFILE) {
    for (const szene of ['live', 'lang'] as const) {
      test(`@ZM-087 @ZM-125 Teamnamen ${szene === 'live' ? 'des Nikolaus-Wochenendes („SV Kirchanschöring“)' : 'mit 45–50 Zeichen'} über der Uhr: vollständig, ohne „…“, ohne Überlappung (${profil.name})`, async ({ page }) => {
        await oeffne(page, szene, profil);
        const namen = page.locator('[data-teamname]');
        await expect(namen).toHaveCount(2);
        const boxen = [];
        for (let i = 0; i < 2; i += 1) {
          const n = namen.nth(i);
          expect(await n.textContent()).not.toContain('…');
          expect(await n.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
          boxen.push(await box(n));
        }
        const uhr = await box(page.getByTestId('monitor-clock'));
        for (const n of boxen) {
          expect(n.x).toBeGreaterThanOrEqual(0);
          expect(n.x + n.w).toBeLessThanOrEqual(profil.width);
          const schneidet = n.x < uhr.x + uhr.w && n.x + n.w > uhr.x && n.y < uhr.y + uhr.h && n.y + n.h > uhr.y;
          expect(schneidet, 'Teamname überlappt die Uhr').toBe(false);
        }
        if (szene === 'live') { await expect(namen.first()).toHaveText('SV Kirchanschöring'); }
      });
    }
  }

  test.describe('Bilder @bilder', () => {
    for (const profil of PROFILE) {
      test(`Bilder ${profil.name}`, async ({ page }) => {
        test.skip(BILDER === '', 'nur mit MONITOR_STABIL_BILDER');
        await oeffne(page, 'live', profil);
        await bild(page, `live-nikolaus-namen-${profil.name}`);
        await netz(page, false);
        await page.clock.runFor(31_000);
        await bild(page, `live-verbindung-eingefroren-${profil.name}`);
        await oeffne(page, 'lang', profil);
        await bild(page, `live-lange-namen-50-${profil.name}`);
        await oeffne(page, 'naechste', profil);
        await bild(page, `naechste-spiele-war-${profil.name}`);
        // Turnierbeginn: 08:30 Ortszeit, kein Spiel gespielt (Tabelle „Alle Tabellen“)
        await page.setViewportSize({ width: profil.width, height: profil.height });
        await page.clock.install({ time: new Date('2026-11-28T07:30:00Z') });
        await page.goto('/tests/e2e/harness/monitor-stabil.html?szene=tabelle&rand=5');
        await expect(page.locator('[data-testid="standings-row"]').first()).toBeVisible({ timeout: 15_000 });
        await bild(page, `tabelle-turnierbeginn-${profil.name}`);
      });
    }
  });
});
