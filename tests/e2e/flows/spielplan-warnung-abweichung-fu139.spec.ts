/**
 * @FU-139 Warnung bei abweichendem Ergebnis, offline (Gast, lokale Engine; Vorbild spielplan-spiel-beenden.spec.ts).
 * Zwei Seiten im selben Browser: Seite A ist das Cockpit (Olli hat Spiel 1 angepfiffen und ein Tor von Nummer 7 für den Heim-Verein gebucht,
 * Stand 1:0), Seite B der Spielplan („Spiel beenden und Ergebnis eintragen“, 3:1).
 *  - Die Rückfrage nennt zusätzlich „Im Cockpit sind Tore gebucht, die nicht zu 3:1 passen (dort 1:0). …“ (ein Dialog, Warn-Symbol).
 *  - „Abbrechen“: Spiel läuft unverändert weiter (Cockpit zeigt „Live“ und 1:0). „Beenden“: 3:1 gilt, das gebuchte Tor bleibt im Protokoll.
 *  - Gegenbeispiele: Stand aus dem Cockpit (1:0) eingetragen → keine Warnung; keine Tore gebucht → keine Warnung.
 * Läuft in allen Breiten-Projekten; Rückfrage bei jeder Breite ohne Überlauf, Tasten ≥ 44 px, im Bild.
 * Bilder (nur mit `FU139_BILDER=<Ordner>`): Rückfrage mit Warnung je Projekt.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { animationenFertig } from '../helpers/animationenFertig';
import { wartePicker } from '../helpers/cockpitNeu';

const TOURNAMENT = 'fu139-warnung';
const NORD = '00000000-0000-4000-8000-0000000013b1';
const SUED = '00000000-0000-4000-8000-0000000013b2';
const WEST = '00000000-0000-4000-8000-0000000013b3';
const OST = '00000000-0000-4000-8000-0000000013b4';
const WARNUNG = 'Im Cockpit sind Tore gebucht, die nicht zu 3:1 passen (dort 1:0). Die Torschützenliste zählt nur die gebuchten Tore.';

function turnier(): Record<string, unknown> {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const date = d.toISOString().split('T')[0];
  return {
    id: TOURNAMENT, status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
    numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin', finals: { enabled: false }, matches: [],
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2, finalRoundDuration: 10,
    placementLogic: ['points', 'goalDifference', 'goalsFor'],
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 }, title: 'Hallencup Nord', ageClass: 'U12',
    date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00', location: { name: 'Halle Nord' },
    teams: [{ id: NORD, name: 'FC Nord' }, { id: SUED, name: 'SV Süd' }, { id: WEST, name: 'TSV West' }, { id: OST, name: 'SC Ost' }],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

/** Seite A: Cockpit, Spiel 1 angepfiffen; mit `tor` ein Tor von Nummer 7 für die Heim-Seite (Stand 1:0). */
async function anpfiff(page: Page, tor: boolean): Promise<void> {
  await page.goto(`/#/tournament/${TOURNAMENT}`);
  await page.getByText('Live').first().click({ force: true });
  await expect(page.getByTestId('scoreboard')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('match-start-button').click();
  await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
  if (tor) {
    await page.getByTestId('goal-button-home').click();
    await wartePicker(page);
    await page.getByTestId('number-picker').getByRole('button', { name: '7', exact: true }).click();
    await expect(page.getByTestId('number-picker')).toBeHidden();
    await expect(page.getByTestId('scoreboard-score')).toHaveText('1:0');
  }
}

/** Seite B: im Spielplan „Spiel beenden und Ergebnis eintragen“ wählen und den Stand eintragen. */
async function beendenImSpielplan(context: BrowserContext, heim: number, gast: number): Promise<Page> {
  const plan = await context.newPage();
  await plan.goto(`/#/tournament/${TOURNAMENT}/schedule`);
  await plan.waitForLoadState('networkidle');
  const zeile = plan.getByRole('article', { name: /^Spiel 1:/ });
  await expect(zeile).toBeVisible({ timeout: 15_000 });
  await zeile.click();
  await expect(plan.getByTestId('match-action-endAndEnter')).toBeVisible(); // die Aktionsauswahl ist da (kein fester Wartewert)
  await plan.getByTestId('match-action-endAndEnter').click();
  const blatt = plan.getByTestId('result-sheet');
  await expect(blatt).toBeVisible();
  await blatt.getByTestId('result-sheet-score-home').fill(String(heim));
  await blatt.getByTestId('result-sheet-score-away').fill(String(gast));
  await blatt.getByTestId('result-sheet-save').click();
  return plan;
}

async function bild(page: Page, name: string, projekt: string): Promise<void> {
  const ordner = process.env.FU139_BILDER;
  if (ordner) {
    await animationenFertig(page);
    await page.screenshot({ path: `${ordner}/${name}-${projekt}.png` });
  }
}

test.describe('@FU-139 Warnung bei abweichendem Ergebnis im Spielplan (offline, Gast)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(browserName !== 'chromium' || !['mobile-sm', 'mobile-md', 'tablet-portrait', 'desktop'].includes(testInfo.project.name), 'zwei Seiten, nur die vier CI-Breiten');
  });

  test('@FU-139 Tor gebucht (1:0), im Spielplan 3:1: Warnung wörtlich; „Abbrechen“ → Spiel läuft weiter; „Beenden“ → 3:1, Tor bleibt im Protokoll', async ({ page, context, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [turnier()] });
    await anpfiff(page, true);
    const plan = await beendenImSpielplan(context, 3, 1);

    const warnung = plan.getByTestId('result-entry-end-goals-warning');
    await expect(warnung).toBeVisible({ timeout: 10_000 });
    await expect(warnung).toHaveText(WARNUNG);
    await expect(plan.getByTestId('result-entry-end-message')).toHaveText(/^Spiel 1 läuft noch – Uhr zeigt \d{1,2}:\d{2} Restzeit\. Jetzt mit 3:1 beenden\?$/);
    await expect(plan.getByTestId('confirm-dialog-confirm')).toHaveCount(1); // die Warnung steht in der einen Rückfrage, kein zweiter Dialog
    await expect(plan.getByTestId('result-entry-end-message').locator('xpath=ancestor::*[@role="alertdialog" or @role="dialog"][1]').getByTestId('result-entry-end-goals-warning')).toHaveCount(1);
    await expect(plan.getByTestId('confirm-dialog-confirm')).toHaveText('Beenden');

    // Bei jeder Breite: nichts läuft waagerecht über, Warnung und Tasten im Bild, Tasten ≥ 44 px
    const breite = plan.viewportSize()!.width;
    expect(await plan.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const id of ['confirm-dialog-confirm', 'confirm-dialog-cancel']) {
      await plan.getByTestId(id).scrollIntoViewIfNeeded();
      const box = (await plan.getByTestId(id).boundingBox())!;
      expect(box.height, `${id} ≥ 44 px`).toBeGreaterThanOrEqual(44);
      expect(box.x >= 0 && box.x + box.width <= breite, `${id} im Bild`).toBe(true);
    }
    const wBox = (await warnung.boundingBox())!;
    expect(wBox.x >= 0 && wBox.x + wBox.width <= breite).toBe(true);
    expect(await warnung.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await warnung.locator('svg').count()).toBeGreaterThan(0); // Warn-Symbol, nie Farbe allein
    await bild(plan, 'rueckfrage-mit-warnung', testInfo.project.name);

    // „Abbrechen“: Spiel läuft unverändert weiter
    await plan.getByTestId('confirm-dialog-cancel').click();
    await expect(warnung).toHaveCount(0);
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
    await expect(page.getByTestId('scoreboard-score')).toHaveText('1:0');

    // Noch einmal, diesmal „Beenden“: das Blatt „Endergebnis“ ist offen geblieben (@SL-195)
    const blatt = plan.getByTestId('result-sheet');
    await expect(blatt).toBeVisible();
    await blatt.getByTestId('result-sheet-score-home').fill('3');
    await blatt.getByTestId('result-sheet-score-away').fill('1');
    await blatt.getByTestId('result-sheet-save').click();
    await expect(warnung).toBeVisible({ timeout: 10_000 });
    await plan.getByTestId('confirm-dialog-confirm').click();
    await expect(warnung).toHaveCount(0);

    // Cockpit: 3:1 gilt, das gebuchte Tor steht weiter im Protokoll
    await expect(page.getByTestId('scoreboard-state')).toContainText('Ende', { timeout: 15_000 });
    await expect(page.getByTestId('scoreboard-score')).toHaveText('3:1');
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await page.getByTestId('match-event-log-button').click();
    }
    await expect(page.locator('[data-event-type="GOAL"]').filter({ visible: true })).toHaveCount(1, { timeout: 10_000 });
  });

  test('@FU-139 Gegenbeispiel: Stand aus dem Cockpit (1:0) eingetragen → keine Warnung', async ({ page, context, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier()] });
    await anpfiff(page, true);
    const plan = await beendenImSpielplan(context, 1, 0);

    await expect(plan.getByTestId('result-entry-end-message')).toHaveText(/Jetzt mit 1:0 beenden\?$/, { timeout: 10_000 });
    await expect(plan.getByTestId('result-entry-end-goals-warning')).toHaveCount(0);
    await plan.getByTestId('confirm-dialog-cancel').click();
  });

  test('@FU-139 Gegenbeispiel: keine Tore gebucht → keine Warnung bei 3:1', async ({ page, context, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [turnier()] });
    await anpfiff(page, false);
    const plan = await beendenImSpielplan(context, 3, 1);

    await expect(plan.getByTestId('result-entry-end-message')).toHaveText(/Jetzt mit 3:1 beenden\?$/, { timeout: 10_000 });
    await expect(plan.getByTestId('result-entry-end-goals-warning')).toHaveCount(0);
    await bild(plan, 'rueckfrage-ohne-warnung', testInfo.project.name);
    await plan.getByTestId('confirm-dialog-cancel').click();
  });
});
