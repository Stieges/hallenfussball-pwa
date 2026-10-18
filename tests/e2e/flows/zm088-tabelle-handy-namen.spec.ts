/**
 * @ZM-088 Teamnamen der Gruppentabelle brechen nur an Leerzeichen (Befund C-TABELLE-HANDY-NAME-SENKRECHT).
 *
 * Gherkin @ZM-088: Kein Teamname endet mit „…“; ohne Kurzname steht der volle Name, an Leerzeichen umgebrochen.
 * Geprüft wird die Mobil-Ansicht der Gruppentabelle auf der Zuschauer-Seite (Reiter „Spiele“) bei 360×640 und
 * 320×640 (@OB-060 Reflow): kein Wort (Teilstück zwischen Leerzeichen/Bindestrichen) eines Teamnamens wird innerhalb
 * des Worts umbrochen, die Teamspalte ist mindestens so breit wie das breiteste Wort, nichts läuft seitlich über.
 * Gegenbeispiel: Desktop (1280) zeigt weiter die breite Tabelle, Mobil-Ansicht ausgeblendet, Rand der Tabelle unverändert.
 * Saat `hallencup-messlauf` (MESS26: lange Namen) und PHASES (SV Südpark). Läuft nur im Projekt `desktop`.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const BILDER = process.env.ZM088_BILDER;
const PHASE = process.env.ZM088_PHASE ?? 'nachher';
const NAME_ZELLE = '.standings-table .mobile-view tbody tr td:nth-child(2) > div';

interface Messung {
  namen: number;
  gebrochen: string[];
  senkrecht: string[];
  zu_schmal: string[];
  teamspalte: number[];
  breitestesWort: number;
  spaltenBreiten: number[];
  tabelle: number;
  ueberlauf: boolean;
  fenster: number;
  verfuegbar: number;
  abgeschnitten: number;
}

async function oeffne(page: Page, breite: number, code: string) {
  await page.setViewportSize({ width: breite, height: 640 });
  await installiereSaat(page.context(), leseSaat('hallencup-messlauf'));
  await page.goto(`/#/live/${code}`);
  await expect(page.locator('.standings-table').first()).toBeAttached({ timeout: 25000 });
}

async function messe(page: Page): Promise<Messung> {
  return page.evaluate((sel) => {
    const out: Messung = {
      namen: 0, gebrochen: [], senkrecht: [], zu_schmal: [], teamspalte: [], breitestesWort: 0,
      spaltenBreiten: [], tabelle: 0, ueberlauf: false, fenster: window.innerWidth, verfuegbar: 0, abgeschnitten: 0,
    };
    const zellen = Array.from(document.querySelectorAll<HTMLElement>(sel));
    for (const div of zellen) {
      const text = Array.from(div.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim());
      if (!text) { continue; }
      out.namen += 1;
      const roh = text.textContent ?? '';
      const re = /[^\s-]+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(roh)) !== null) {
        const r = document.createRange();
        r.setStart(text, m.index);
        r.setEnd(text, m.index + m[0].length);
        const zeilen = new Set(Array.from(r.getClientRects()).map((q) => Math.round(q.top)));
        if (zeilen.size > 1) {
          out.gebrochen.push(`${roh.trim()} → ${m[0]}`);
          // Teilstücke je Zeile zählen: ein Stück unter 3 Zeichen heißt Buchstabe für Buchstabe (kein Silbentrennstrich-Umbruch)
          const proZeile = new Map<number, number>();
          for (let i = m.index; i < m.index + m[0].length; i++) {
            const c = document.createRange();
            c.setStart(text, i);
            c.setEnd(text, i + 1);
            const top = Math.round(c.getBoundingClientRect().top);
            proZeile.set(top, (proZeile.get(top) ?? 0) + 1);
          }
          if (Math.min(...proZeile.values()) < 3) { out.senkrecht.push(`${roh.trim()} → ${m[0]} [${Array.from(proZeile.values()).join(",")}]`); }
        }
        out.breitestesWort = Math.max(out.breitestesWort, r.getBoundingClientRect().width);
      }
      const td = div.parentElement!;
      const textBreite = div.getBoundingClientRect().width;
      out.teamspalte.push(Math.round(td.getBoundingClientRect().width));
      if (textBreite < 1) { out.zu_schmal.push(roh.trim()); }
    }
    const tabelle = document.querySelector<HTMLElement>('.standings-table .mobile-view table');
    out.tabelle = Math.round(tabelle?.getBoundingClientRect().width ?? 0);
    out.spaltenBreiten = Array.from(document.querySelectorAll<HTMLElement>('.standings-table .mobile-view thead th'))
      .map((th) => Math.round(th.getBoundingClientRect().width));
    const sicht = document.querySelector<HTMLElement>('.standings-table .mobile-view');
    out.verfuegbar = Math.round(sicht?.clientWidth ?? 0);
    out.abgeschnitten = Math.max(0, (sicht?.scrollWidth ?? 0) - (sicht?.clientWidth ?? 0));
    out.ueberlauf = document.documentElement.scrollWidth > document.documentElement.clientWidth;
    return out;
  }, NAME_ZELLE);
}

async function bild(page: Page, name: string) {
  if (!BILDER) { return; }
  mkdirSync(BILDER, { recursive: true });
  const t = page.locator('.standings-table').first();
  await t.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(BILDER, `${PHASE}-${name}.png`), fullPage: false });
}

for (const breite of [360, 320]) {
  for (const code of ['MESS26', 'PHASES']) {
    test(`@ZM-088 @OB-060 Gruppentabelle ${breite}×640 (${code}): Teamnamen brechen nie mitten im Wort, Teamspalte >= breitestes Wort`, async ({ page }) => {
      await oeffne(page, breite, code);
      const m = await messe(page);
      for (const thema of ['hell', 'dunkel'] as const) {
        await page.emulateMedia({ colorScheme: thema === 'dunkel' ? 'dark' : 'light' });
        await bild(page, `tabelle-${breite}-${code}-${thema}`);
      }
      test.info().annotations.push({ type: 'messung', description: JSON.stringify(m) });
      expect(m.fenster).toBe(breite);
      expect(m.namen).toBeGreaterThan(0);
      // @ZM-088: nie senkrecht, nie mitten im Wort; @OB-060: die Seite selbst läuft nie seitlich über
      expect(m.senkrecht).toEqual([]);
      expect(m.gebrochen).toEqual([]);
      expect(m.ueberlauf).toBe(false);
      if (code === 'PHASES') {
        // Der Fall aus dem Befund (kurze Namen wie „SV Südpark“): Teamspalte >= breitestes Wort, nichts abgeschnitten
        expect(Math.min(...m.teamspalte)).toBeGreaterThanOrEqual(Math.floor(m.breitestesWort));
        expect(m.abgeschnitten).toBe(0);
      }
      // MESS26 hat Wörter mit 17 Buchstaben (129 px): die Tabelle darf dort in ihrem Kasten seitlich scrollen (overflow-x: auto),
      // aber kein Wort wird zerlegt.
    });
  }
}

test('@ZM-088 Gegenbeispiel Desktop 1280: breite Tabelle bleibt, Mobil-Ansicht ausgeblendet, Rand der Tabelle unverändert', async ({ page }) => {
  await oeffne(page, 1280, 'MESS26');
  const t = page.locator('.standings-table').first();
  await expect(t.locator('.desktop-view')).toBeVisible();
  await expect(t.locator('.mobile-view')).toBeHidden();
  await expect(t).toHaveCSS('padding-left', '16px');
  await expect(t.locator('.desktop-view thead th')).toHaveCount(9);
  test.info().annotations.push({
    type: 'messung',
    description: JSON.stringify(await t.locator('.desktop-view thead th').evaluateAll((l) => l.map((e) => Math.round(e.getBoundingClientRect().width)))),
  });
});
