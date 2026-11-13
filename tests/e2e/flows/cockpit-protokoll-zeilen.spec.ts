/**
 * E2E (Gast, lokal) @OB-021 / @OB-025 Handy-Blatt „Ereignisprotokoll“: keine Zeile schneidet ihre Beschreibung ab (kein „…“), nichts läuft
 * waagerecht über, nichts überlappt die Taste „Bearbeiten“ (mindestens 44 px, ganz im Fenster). Jede Zeilenart (Tor, Foul, Karte, Zeitstrafe mit
 * Zusatz „beendet durch Tor“), normaler und 50-Zeichen-Teamname, 360 und 390 px. Der Ergebniseintrag-Zeile (eigener Baustein, ohne Kürzung) fehlt hier:
 * im Gast-Turnier trägt sie keinen Namen. Bilder nach `PSB_BILDER`, sonst keine.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { animationenFertig } from '../helpers/animationenFertig';
import { cup, anpfeifen, NAME_50, NAMEN } from '../helpers/laptopCup';
import { schliesseTorAuswahl, tippeKarte, wartePicker } from '../helpers/cockpitNeu';

const BILDER = process.env.PSB_BILDER ?? '';
const DUNKEL = process.env.PSB_DUNKEL === '1'; // Bilder im dunklen Thema

async function bild(page: Page, name: string): Promise<void> {
  if (BILDER === '') { return; }
  await animationenFertig(page);
  mkdirSync(BILDER, { recursive: true });
  writeFileSync(join(BILDER, `${name}${DUNKEL ? '-dunkel' : ''}.png`), await page.screenshot());
}

const marke = (page: Page) => page.getByTestId('scoreboard').getByText(/^#5 [01]:\d{2}$/)
  .or(page.getByRole('listitem', { name: /, #5, Restzeit [01]:\d{2}$/ }));

/** Spielt jede Zeilenart ins Protokoll: Tor Heim, Foul Gast, Gelb Heim #7, Zeitstrafe Heim #5, dann Gegentor (beendet die Strafe). */
async function spieleAlleZeilenarten(page: Page): Promise<void> {
  // Uhr des Browsers: feste Spielzeiten (Tor 0:30, Strafe 2:00, Gegentor 2:40), keine Wartezeit
  await page.clock.install();
  await anpfeifen(page);
  await page.clock.fastForward(30_000);
  await page.getByTestId('goal-button-home').click();
  await schliesseTorAuswahl(page);
  await page.getByTestId('foul-button-away').click();
  await tippeKarte(page, 'home', 'Gelb', 7);
  await page.clock.fastForward(90_000);
  await page.getByTestId('penalty-button-home').click();
  await wartePicker(page);
  await page.getByTestId('number-picker').getByRole('button', { name: '5', exact: true }).click();
  await expect(page.getByTestId('number-picker')).toBeHidden();
  await expect(marke(page)).toBeVisible();
  await page.clock.fastForward(40_000);
  await page.getByTestId('goal-button-away').click();
  await schliesseTorAuswahl(page);
}

for (const [fall, namen] of [['normal', NAMEN], ['name50', [NAME_50, ...NAMEN.slice(1)]]] as const) {
  test(`@OB-021 @OB-025 Handy-Blatt (${fall}): jede Zeilenart ungekürzt, ohne Überlauf, Taste „Bearbeiten“ erreichbar`, async ({ page, seedIndexedDB }, testInfo) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'das Blatt gibt es nur unter 1024 px (darüber steht die Liste daneben)');
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten');
    if (DUNKEL) { await page.emulateMedia({ colorScheme: 'dark' }); }
    await seedIndexedDB({ tournaments: [{ ...cup({ namen }), matchCockpitSettings: { penaltyEndsOnGoal: true, foulLimit: 5 } }] });
    await spieleAlleZeilenarten(page);
    await page.getByTestId('match-event-log-button').click();
    const blatt = page.getByTestId('event-log-sheet');
    await expect(blatt).toBeVisible();
    await animationenFertig(page);
    const zeilen = blatt.locator('[data-event-type]');
    await expect(zeilen).toHaveCount(5);
    await bild(page, `protokoll-blatt-${fall}-${testInfo.project.name}`);

    const breite = page.viewportSize()!.width;
    const arten = await zeilen.evaluateAll((els) => els.map((e) => e.getAttribute('data-event-type')));
    expect([...arten].sort()).toEqual(['FOUL', 'GOAL', 'GOAL', 'TIME_PENALTY', 'YELLOW_CARD']);
    const zeitLinks: number[] = [];
    for (let i = 0; i < 5; i++) {
      const zeile = zeilen.nth(i);
      const art = arten[i];
      const text = (await zeile.innerText()).replace(/\s+/g, ' ');
      expect(text, `${art}: keine Auslassungspunkte`).not.toMatch(/…|\.\.\./);
      if (fall === 'name50' && (art === 'TIME_PENALTY' || art === 'YELLOW_CARD')) {
        expect(text, `${art}: voller Teamname sichtbar`).toContain(NAME_50);
      }
      const ueberlauf = await zeile.evaluate((el) =>
        [el, ...Array.from(el.querySelectorAll('*'))].filter((k) => k.scrollWidth > k.clientWidth + 1).map((k) => k.tagName + ':' + (k.textContent ?? '').slice(0, 20)));
      expect(ueberlauf, `${art}: nichts läuft waagerecht über`).toEqual([]);
      zeitLinks.push((await zeile.getByText(/^\d{2}:\d{2}$/).boundingBox())!.x);
      // Zeilen des Textes (ohne Taste): kein Wort eines Teamnamens auf zwei Zeilen, die Nummer nie allein (VISUAL-DESIGN § 2)
      const zeilenDesTextes = await zeile.evaluate((el) => {
        const jeZeile = new Map<number, string>();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
          if (n.parentElement!.closest('button') !== null) { continue; }
          const text = n.textContent ?? '';
          const r = document.createRange();
          for (let k = 0; k < text.length; k++) {
            r.setStart(n, k); r.setEnd(n, k + 1);
            const rect = r.getBoundingClientRect();
            if (rect.width === 0) { continue; }
            const top = Math.round(rect.top / 4) * 4; // gleiche Zeile trotz Symbol-/Schriftunterschied
            jeZeile.set(top, (jeZeile.get(top) ?? '') + text[k]);
          }
        }
        return [...jeZeile.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t.replace(/\u00a0/g, ' ').trim());
      });
      for (const l of zeilenDesTextes) {
        expect(l, `${art}: keine Zeile endet mit „-“ (${JSON.stringify(zeilenDesTextes)})`).not.toMatch(/-$/);
        expect(l, `${art}: die Nummer steht nie allein (${JSON.stringify(zeilenDesTextes)})`).not.toMatch(/^#\d+$/);
      }
      if (fall === 'name50' && (art === 'TIME_PENALTY' || art === 'YELLOW_CARD')) {
        expect(zeilenDesTextes.some((l) => l.includes('Nordheim-Süd')), `${art}: „Nordheim-Süd“ in einer Zeile`).toBe(true);
      }
      const taste = zeile.getByRole('button');
      const t = (await taste.boundingBox())!;
      const z = (await zeile.boundingBox())!;
      expect(t.height, `${art}: Taste mindestens 44 px hoch`).toBeGreaterThanOrEqual(44);
      expect(t.x + t.width, `${art}: Taste ganz im Fenster`).toBeLessThanOrEqual(breite);
      expect(t.x + t.width, `${art}: Taste innerhalb der Zeile`).toBeLessThanOrEqual(z.x + z.width + 1);
      // Der Textblock endet vor der Taste (keine Überlappung)
      const textRechts = await zeile.evaluate((el) => {
        const kinder = Array.from(el.querySelectorAll('span, div')).filter((k) => !k.querySelector('button') && !k.closest('button') && (k.textContent ?? '').trim() !== '');
        return Math.max(...kinder.map((k) => k.getBoundingClientRect().right));
      });
      expect(textRechts, `${art}: Text überlappt die Taste nicht`).toBeLessThanOrEqual(t.x + 1);
    }
    expect(Math.max(...zeitLinks) - Math.min(...zeitLinks), `linke Kante der Uhrzeit in allen Zeilenarten gleich (${zeitLinks.join(', ')})`).toBeLessThanOrEqual(1);
    const zusatz = blatt.getByTestId('event-penalty-ended-by-goal');
    await expect(zusatz).toHaveText(/^beendet durch Tor\s\d{2}:\d{2}$/);
    // Zeit und „Tor“ bleiben auf einer Zeile: die Zeile des Zusatzes hat nie nur die Zeit
    const zeilenDesZusatzes = await zusatz.evaluate((el) => {
      const r = document.createRange();
      const knoten = el.firstChild!;
      const text = knoten.textContent ?? '';
      const boxen = (von: number, bis: number) => { r.setStart(knoten, von); r.setEnd(knoten, bis); return r.getBoundingClientRect().top; };
      return { tor: boxen(text.indexOf('Tor'), text.indexOf('Tor') + 3), zeit: boxen(text.length - 5, text.length) };
    });
    expect(Math.abs(zeilenDesZusatzes.tor - zeilenDesZusatzes.zeit), 'Tor und Zeit stehen in einer Zeile').toBeLessThan(4);
  });
}
