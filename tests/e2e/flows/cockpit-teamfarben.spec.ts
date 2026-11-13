/**
 * E2E: Teamfarben im Cockpit und Foul je Halbzeit (Plan Cockpit v2 A2/A5, M3).
 * @SL-176: Blau gegen Navy (zu ähnlich) → Tom bestätigt die Karte, Kasten und Kopf zeigen die Weste – auch ohne Netz.
 * @SL-036/@SL-099: Foul, Halbzeit, Wiederanpfiff, Foul → „Foul 0/5“, dann „Foul 1/5“ (der Zähler gegen die Grenze zählt je Halbzeit;
 * die Grenze 5 setzt das Testturnier selbst – die Vorgabe ist aus, @SL-101).
 */
import { test, expect } from '../helpers/test-fixtures';
import { cup, ID, FARBEN, anpfeifen } from '../helpers/laptopCup';

test.describe('Cockpit: Teamfarben und Foul je Halbzeit (Gast, lokal)', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
  });

  test('@SL-176 Blau/Navy: nach „Bestätigen“ und Anpfiff zeigt das Cockpit die Weste (Gelb mit blauen Streifen, Leibchen-Zeichen), auch ohne Netz', async ({ page, context, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ farben: ['#1565C0', '#0D1B4C', FARBEN[2], FARBEN[3]] })] });
    await page.goto(`/#/tournament/${ID}/live`);
    await expect(page.getByTestId('match-start-button')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('data-fill', 'solid'); // vor dem Anpfiff: Teamfarbe
    await context.setOffline(true);
    await page.getByTestId('leibchen-bestaetigen').click(); // Tom bestätigt „TSV … zieht Gelb“ (sofort im Cockpit, auch ohne Netz, @SL-226)
    await expect(page.getByTestId('scoreboard-box-links')).toHaveAttribute('data-fill', 'vest');
    await page.getByTestId('match-start-button').click();
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    const kasten = page.getByTestId('scoreboard-box-links');
    await expect(kasten).toHaveAttribute('data-fill', 'vest');
    await expect(kasten).toHaveAttribute('data-color', '#FFCC00');
    await expect(kasten).toHaveAttribute('data-stripes', '#1565C0');
    await expect(page.getByTestId('scoreboard-box-links-bib')).toBeVisible();
    await expect(page.getByTestId('team-head-home')).toHaveAttribute('data-fill', 'vest');
    await expect(page.getByTestId('scoreboard-box-rechts')).toHaveAttribute('data-color', '#0D1B4C');
  });

  test('@SL-036 @SL-099 Foul im ersten Abschnitt, Halbzeit, Wiederanpfiff: „Foul 0/5“, das nächste Foul zählt „Foul 1/5“', async ({ page, seedIndexedDB }) => {
    await page.clock.install();
    await seedIndexedDB({ tournaments: [cup({ minuten: 1, perioden: 2, pause: 1, einstellungen: { foulLimit: 5 } })] });
    await anpfeifen(page);
    await page.getByTestId('foul-button-home').click();
    await expect(page.getByTestId('team-fouls-home')).toContainText('Foul 1/5');
    await page.clock.fastForward(31_000); // erster Abschnitt (30 s) ist um
    await expect(page.getByTestId('scoreboard-state')).toContainText('Halbzeit');
    await page.clock.fastForward(61_000); // Pause (1 Minute) ist um
    await page.getByTestId('match-wiederanpfiff-button').click();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    await expect(page.getByTestId('team-fouls-home')).toContainText('Foul 0/5');
    await page.getByTestId('foul-button-home').click();
    await expect(page.getByTestId('team-fouls-home')).toContainText('Foul 1/5');
  });

  test('@SL-101 @SL-102 neues Turnier ohne Foul-Grenze: das Cockpit zählt das Foul trotzdem und zeigt nur die Zahl, ohne „/5“', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await expect(page.getByTestId('team-fouls-home')).toContainText('Foul');
    await expect(page.getByTestId('team-fouls-home')).not.toContainText('/');
    await page.getByTestId('foul-button-home').click();
    await expect(page.getByTestId('team-fouls-home')).toHaveText(/^Foul\s*·?\s*1$/);
    await expect(page.getByTestId('team-fouls-home')).not.toContainText('/5');
  });
});
