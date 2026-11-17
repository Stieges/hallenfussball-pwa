/**
 * @ZM-087 @ZM-125 Teamnamen der bestehenden Live-Folie (Monitor ohne Profil) bleiben mit „weniger Bewegung“ gleich groß: Die Monitor-Seite setzt bei
 * „weniger Bewegung“ `transition-duration: 0.01ms !important` auf alle Elemente; das Messfeld des Einpassens las dadurch den Anfang eines Übergangs und setzte
 * Namen auf die kleinste Schrift (3 % der Bildhöhe). Gemessen an der echten Seite (lokaler Stand, Saat `monitor-halle`, Monitor `mon-fern` ohne Profil):
 * dieselbe Ansicht mit und ohne „weniger Bewegung“ liefert dieselbe Namensgröße, und sie liegt über der kleinsten Schrift.
 * Keine festen Wartezeiten. Nur Profil `desktop` (setzt das Fenster selbst).
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../scripts/visual-metrics/saat/lader.mjs';

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'setzt das Fenster selbst');
});

const BREITE = 1920;
const HOEHE = 1080;
const KLEINSTE_SCHRIFT_ANTEIL = 0.03;

async function namenGroessen(page: Page, fall: string, bewegung: 'no-preference' | 'reduce'): Promise<number[]> {
  await page.setViewportSize({ width: BREITE, height: HOEHE });
  await page.emulateMedia({ reducedMotion: bewegung });
  await installiereSaat(page.context(), leseSaat('monitor-halle'));
  await page.goto(`/#/display/${fall}/mon-fern`);
  await expect(page.locator('[data-teamname]').first()).toBeVisible({ timeout: 25000 });
  // eingepasst: die Schrift der Namen ist stabil (zwei Messungen mit je zwei Bildern Abstand gleich)
  await page.waitForFunction(async () => {
    const lies = (): string => [...document.querySelectorAll('[data-teamname]')].map((e) => getComputedStyle(e).fontSize).join('|');
    const a = lies();
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    return a === lies() && a !== '';
  }, null, { timeout: 15000 });
  return page.evaluate(() => [...document.querySelectorAll('[data-teamname]')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
}

for (const fall of ['halle-laeuft', 'halle-djk', 'halle-lang25']) {
  test(`@ZM-087 bestehende Live-Folie (${fall}): mit „weniger Bewegung“ stehen die Namen nicht auf der kleinsten Schrift, gleich groß wie ohne`, async ({ page }) => {
    const ohne = await namenGroessen(page, fall, 'no-preference');
    const mit = await namenGroessen(page, fall, 'reduce');
    expect(mit.length).toBeGreaterThan(0);
    expect(mit, 'gleiche Namensgröße mit und ohne „weniger Bewegung“').toEqual(ohne);
    // die Fehlerart: nicht auf die kleinste Schrift gedrückt (am Stand vor der Behebung fiel „halle-lang25“ mit „weniger Bewegung“ von 60 auf 32 px)
    const kleinste = HOEHE * KLEINSTE_SCHRIFT_ANTEIL;
    for (const px of mit) { expect(px, 'Name größer als die kleinste Schrift').toBeGreaterThan(kleinste + 1); }
  });
}
