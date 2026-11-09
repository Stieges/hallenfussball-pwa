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
type Szene = 'live' | 'lang' | 'tabelle' | 'tabellelang' | 'naechste' | 'plan' | 'planlang';

async function oeffne(page: Page, szene: Szene, profil: (typeof PROFILE)[number] = PROFILE[0], rand = 5): Promise<void> {
  await page.setViewportSize({ width: profil.width, height: profil.height });
  await page.clock.install({ time: UM_1432 });
  await page.goto(`/tests/e2e/harness/monitor-stabil.html?szene=${szene}&rand=${String(rand)}`);
  const bereit = szene === 'tabelle' || szene === 'tabellelang' ? '[data-testid="standings-row"]' : szene === 'naechste' || szene === 'plan' || szene === 'planlang' ? '[data-testid="monitor-match-row"]' : '[data-testid="monitor-clock"]';
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
  interface Window { __netz: boolean | 'haengt'; __neu: 0 | 1 | 2 }
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

  // @ME-030 Zeile 1: Ruhezustand von 14:32 bis 14:52 – der Zeitsprung kommt ohne einen einzigen Zwischen-Timer, danach liegen NEUE Daten vor
  test('@ME-030 Ruhezustand: Zeitsprung von 20 Minuten, beim Aufwachen kommen neue Daten (2:0): nach höchstens 10 s 2:0, bis dahin das Symbol, danach weg', async ({ page }) => {
    await oeffne(page, 'live');
    await expect(page.getByTestId('live-box-home-digits')).toHaveText('1');
    await netz(page, false);
    await page.clock.fastForward(20 * 60_000); // der Rechner schläft: kein Timer läuft dazwischen
    await expect(page.getByTestId('monitor-connection-hint')).toBeVisible();
    await expect(page.getByTestId('live-box-home-digits')).toHaveText('1'); // das letzte Bild bleibt, nichts wird leer
    // Aufwachen: Netz wieder da, der Server hat inzwischen 2:0
    await page.evaluate(() => { window.__netz = true; window.__neu = 1; document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.runFor(10_000);
    await expect(page.getByTestId('live-box-home-digits')).toHaveText('2');
    await expect(page.getByTestId('monitor-connection-hint')).toHaveCount(0);
  });

  // @ME-007 / @ME-047: Netz weg, inzwischen Spiel 1 beendet (2:1) und Spiel 2 angepfiffen; Netz zurück: nach höchstens 10 s Spiel 2 läuft, Symbol weg
  test('@ME-007 Netz kommt zurück, inzwischen Spiel 1 beendet und Spiel 2 angepfiffen: nach höchstens 10 s Spiel 2 läuft, das Symbol ist weg', async ({ page }) => {
    await oeffne(page, 'live');
    await expect(page.getByText(/Spiel 1$/i).first()).toBeVisible();
    await netz(page, false);
    await page.clock.runFor(8 * 60_000);
    await expect(page.getByTestId('monitor-connection-hint')).toBeVisible();
    await page.evaluate(() => { window.__netz = true; window.__neu = 2; });
    await page.clock.runFor(10_000);
    await expect(page.getByTestId('monitor-connection-hint')).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/Spiel 2/i);
    await expect(page.locator('body')).not.toContainText(/Feld 1\s*—\s*Spiel 1(?!\d)/i);
  });

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

  // @ZM-086: das Symbol überdeckt auf keiner vollen Listen-Folie ein Element, das im sicheren Bereich liegt (Zeilen bis ganz unten, Namen mit 45–50 Zeichen).
  // Ausnahme (Befund C-MONITOR-TABELLE-HOEHE-UEBERLAUF, schon ohne Symbol): die Tabelle „Alle Tabellen“ blättert nicht nach Höhe; mit sechs
  // zweizeiligen Namen und 10 % Bildrand ragt sie über den sicheren Bereich hinaus – dieser Fall hat unten seinen eigenen „erwartet rot“-Test.
  // „Nächste Spiele“ (@ZM-085 gilt auf jeder Folie) gehört ebenfalls in die Prüfung.
  async function pruefeUeberdeckung(page: Page, profil: (typeof PROFILE)[number], szene: Szene, rand: number): Promise<void> {
    await oeffne(page, szene, profil, rand);
    await netz(page, false);
    await page.clock.runFor(31_000);
    const symbol = page.getByTestId('monitor-connection-hint');
    await expect(symbol).toBeVisible();
    const s = await box(symbol);
    expect(s.x + s.w).toBeLessThanOrEqual(profil.width * (1 - rand / 100) + 1);
    expect(s.y + s.h).toBeLessThanOrEqual(profil.height * (1 - rand / 100) + 1);
    const getroffen = await page.evaluate((r) => {
      const treffer: string[] = [];
      const sym = document.querySelector('[data-testid="monitor-connection-hint"]')!;
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        if (sym.contains(el) || el.contains(sym) || el.childElementCount > 0) { continue; }
        if ((el.textContent ?? '').trim() === '' && !(el instanceof SVGElement)) { continue; }
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) { continue; }
        if (r.x < b.right && r.x + r.w > b.left && r.y < b.bottom && r.y + r.h > b.top) { treffer.push(`${el.tagName} „${(el.textContent ?? '').trim().slice(0, 30)}“`); }
      }
      return treffer;
    }, s);
    expect(getroffen, `überdeckte Elemente bei Bildrand ${String(rand)} %`).toEqual([]);
  }

  for (const profil of PROFILE) {
    for (const szene of ['plan', 'planlang', 'naechste', 'tabellelang'] as const) {
      test(`@ZM-086 @ZM-085 Verbindungs-Symbol überdeckt auf der Folie „${szene}“ nichts (${profil.name}, Bildrand 0, 5 und 10 %)`, async ({ page }) => {
        for (const rand of szene === 'tabellelang' ? [0, 5] : [0, 5, 10]) {
          await pruefeUeberdeckung(page, profil, szene, rand);
        }
      });
    }
    // Der ausgenommene Fall: Bildrand 10 % bei „Alle Tabellen“ mit sechs zweizeiligen Namen. Wird der Befund behoben, schlägt dieser Test mit
    // „Expect test to fail“ an: dann die Markierung entfernen (Verweis bleibt im Namen) und „10“ in die Schleife oben aufnehmen.
    test.fail(`@ZM-129 @ME-067 @ZM-085 Offen C-MONITOR-TABELLE-HOEHE-UEBERLAUF: „Alle Tabellen“ mit langen Namen bleibt bei Bildrand 10 % im sicheren Bereich, das Symbol überdeckt nichts (${profil.name})`, async ({ page }) => {
      await pruefeUeberdeckung(page, profil, 'tabellelang', 10);
      // der Befund selbst: die Folie ragt nicht über den sicheren Bereich hinaus
      const unterkante = await page.evaluate(() => Math.max(...Array.from(document.querySelectorAll('[data-testid="standings-row"]')).map((z) => z.getBoundingClientRect().bottom)));
      expect(unterkante).toBeLessThanOrEqual(profil.height * 0.9 + 1);
    });
  }

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
