/**
 * E2E: Tastenkürzel im laufenden Spiel am Laptop (Plan Cockpit v2, PR K; Auflagen A4-1 bis A4-5).
 * Szenarien: @SL-153 (Leertaste = Pause/Weiter, 1/2 = Tor, F/J = Foul, Strg/Cmd+Z = Rückgängig, ? = Übersicht;
 * Hinweise nur mit Maus am Laptop), @SL-189 (Schalter „Tastenkürzel“, an der Voreinstellung), @SL-157/@SL-158 (Abpfiff halten:
 * Tastatur nur mit sichtbarem Fokus, kurzer Druck löst nichts aus), @SL-021 (Nummernauswahl: Ziffern ohne Feldfokus).
 * Saat: Spiel 1 FC Nord – SV Süd (Heim links), Foul-Grenze 5. Handy (unter 1024 px): keine Hinweise, keine Tastenkürzel.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { anpfeifen, cup } from '../helpers/laptopCup';

const breit = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 1024;
const feinerZeiger = (page: Page): Promise<boolean> => page.evaluate(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches);

const stand = async (page: Page, box: 'links' | 'rechts'): Promise<string> => (await page.getByTestId(`scoreboard-box-${box}`).textContent()) ?? '';

test.describe('Tastenkürzel im Cockpit (Gast, lokal)', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
  });

  test('@SL-153 Laptop: 1 = Tor links, 2 = Tor rechts, danach öffnet sich die Nummernauswahl; Ziffern landen ohne Feldfokus im Feld (A4-4)', async ({ page, seedIndexedDB }) => {
    test.skip(!breit(page), 'nur Laptop');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.keyboard.press('1');
    await expect(page.getByTestId('number-picker')).toBeVisible();
    await expect.poll(() => stand(page, 'links')).toBe('1');
    await page.waitForTimeout(400); // Sperre der ersten 300 ms (@SL-021)
    await page.keyboard.press('7');
    await expect(page.getByTestId('number-picker').locator('input')).toHaveValue('7');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('number-picker')).toBeHidden();
    await page.keyboard.press('2');
    await expect.poll(() => stand(page, 'rechts')).toBe('1');
    await expect.poll(() => stand(page, 'links')).toBe('1');
  });

  test('@SL-153 Laptop: F = Foul links, J = Foul rechts, Strg/Cmd+Z nimmt das letzte Foul zurück', async ({ page, seedIndexedDB }) => {
    test.skip(!breit(page), 'nur Laptop');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.keyboard.press('f');
    await expect(page.getByTestId('team-fouls-home')).toContainText('1/5');
    await page.keyboard.press('j');
    await expect(page.getByTestId('team-fouls-away')).toContainText('1/5');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByTestId('team-fouls-away')).toContainText('0/5');
    await expect(page.getByTestId('team-fouls-home')).toContainText('1/5');
  });

  test('@SL-153 Laptop: Leertaste hält die Uhr an und lässt sie weiterlaufen; ein Halten der Taste wiederholt nichts', async ({ page, seedIndexedDB }) => {
    test.skip(!breit(page), 'nur Laptop');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.keyboard.press('Space');
    await expect(page.getByTestId('match-resume-button')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await page.keyboard.down('Space');
    for (let i = 0; i < 5; i++) { await page.keyboard.down('Space'); } // Tastenwiederholung
    await page.keyboard.up('Space');
    await expect(page.getByTestId('match-resume-button')).toBeVisible(); // genau ein Wechsel
  });

  test('@SL-153 Laptop: ? öffnet die Übersicht, Escape schließt sie; der Knopf „Tastenkürzel“ im Kopf öffnet sie ebenfalls', async ({ page, seedIndexedDB }) => {
    test.skip(!breit(page), 'nur Laptop');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.keyboard.press('?');
    await expect(page.getByTestId('shortcut-help')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcut-help')).toBeHidden();
    await page.getByTestId('cockpit-tastenkuerzel').click();
    await expect(page.getByTestId('shortcut-help')).toBeVisible();
    // Während die Übersicht offen ist, löst keine Taste das Spiel aus
    await page.keyboard.press('1');
    await expect(page.getByTestId('number-picker')).toHaveCount(0);
    expect(await stand(page, 'links')).toBe('0');
  });

  test('@SL-153 Hinweise an den Tasten nur mit Maus am Laptop (Handy und Tablet ohne feinen Zeiger: keine)', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    const sollen = breit(page) && await feinerZeiger(page);
    for (const id of ['tor-taste-home', 'tor-taste-away', 'foul-taste-home', 'foul-taste-away']) {
      await expect(page.getByTestId(id)).toHaveCount(sollen ? 1 : 0);
    }
    if (sollen) {
      await expect(page.getByTestId('tor-taste-home')).toHaveText('1');
      await expect(page.getByTestId('tor-taste-away')).toHaveText('2');
      await expect(page.getByTestId('foul-taste-home')).toHaveText('F');
      await expect(page.getByTestId('foul-taste-away')).toHaveText('J');
    }
  });

  test('@SL-153 Handy: die Tasten 1, 2, F, J und die Leertaste lösen nichts aus, der Kopf hat keinen Knopf „Tastenkürzel“', async ({ page, seedIndexedDB }) => {
    test.skip(breit(page), 'nur Handy');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-tastenkuerzel')).toHaveCount(0);
    for (const k of ['1', '2', 'f', 'j', 'Space', '?']) { await page.keyboard.press(k); }
    await expect(page.getByTestId('number-picker')).toHaveCount(0);
    await expect(page.getByTestId('shortcut-help')).toHaveCount(0);
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    expect(await stand(page, 'links')).toBe('0');
    await expect(page.getByTestId('team-fouls-home')).toContainText('0/5');
  });

  test('@SL-189 Schalter aus: kein Tastenkürzel wirkt, keine Hinweise; die Wahl bleibt nach dem Neuladen', async ({ page, seedIndexedDB }) => {
    test.skip(!breit(page), 'nur Laptop');
    await page.addInitScript(() => { try { window.localStorage.setItem('hallenfussball:cockpit:tastenkuerzel', 'aus'); } catch { /* ohne Speicher */ } });
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.keyboard.press('1');
    await page.keyboard.press('f');
    await page.keyboard.press('Space');
    await expect(page.getByTestId('number-picker')).toHaveCount(0);
    expect(await stand(page, 'links')).toBe('0');
    await expect(page.getByTestId('team-fouls-home')).toContainText('0/5');
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await expect(page.getByTestId('tor-taste-home')).toHaveCount(0);
  });

  test('@SL-157 @SL-158 Abpfiff per Tastatur: mit sichtbarem Fokus hält die Leertaste etwa eine Sekunde, ein kurzer Druck löst nichts aus', async ({ page, seedIndexedDB }) => {
    test.skip(!breit(page), 'nur Laptop');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.getByTestId('match-finish-button').focus();
    await page.keyboard.press('Tab'); // Fokus weg und mit der Tastatur zurück: sichtbarer Fokus
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('match-finish-button')).toBeFocused();
    await page.keyboard.press('Space'); // kurz
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('match-pause-button')).toBeVisible(); // die Uhr läuft weiter
    await page.keyboard.down('Space');
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 });
    await page.keyboard.up('Space');
    // Solange die Rückfrage offen ist, wirken die Tastenkürzel nicht
    await page.keyboard.press('1');
    expect(await stand(page, 'links')).toBe('0');
    await expect(page.getByTestId('number-picker')).toHaveCount(0);
  });

  test('@SL-153 @SL-157 Nach einem Mausklick auf „Abpfiff halten“ steuert die Leertaste die Uhr, der Abpfiff bleibt aus (A4-2)', async ({ page, seedIndexedDB }) => {
    test.skip(!breit(page) || !(await feinerZeiger(page)), 'nur Laptop mit Maus');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.getByTestId('match-finish-button').click(); // kurzer Klick: löst nichts aus, Fokus ohne :focus-visible
    await page.keyboard.press('Space');
    await expect(page.getByTestId('match-resume-button')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
});
