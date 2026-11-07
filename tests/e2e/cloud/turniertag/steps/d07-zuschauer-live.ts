/**
 * D7 Zuschauer live: @ZM-021 "Änderungen erscheinen ohne Neuladen nach höchstens 10 Sekunden" (Befund C-ZUSCHAUER-OHNE-NEULADEN,
 * behoben mit dem B-15-Anschluss: die Seite liest standardmäßig über public_tournament).
 * Besitzer: B-14 (Server `public_tournament`) / B-15 (Zuschauer-Seite). Soll: ein Tor, das die Turnierleitung einträgt, steht
 * nach höchstens 10 Sekunden auf der offenen Zuschauer-Seite, OHNE Neuladen, und die Seite holt es über die Server-Funktion
 * `public_tournament` (nicht mehr direkt aus den Tabellen).
 */
import { expect } from '@playwright/test';
import { getLocalServiceRoleClient } from '../../helpers';
import { E2E_TURNIERTAG_SHARE_CODE } from '../../testData';
import { appendOwner, eventOf } from './playViaRpc';
import { expectPageAnchor, fetchTurniertagBracket, fetchTurniertagMatches, fetchTurniertagTeams } from './shared';
import type { StepContext, TurniertagStep } from './types';

async function zuschauerLive({ anonPage }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const match = groupMatches[0]; // läuft seit D4
  await anonPage.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
  await expectPageAnchor(anonPage.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
  await anonPage.waitForLoadState('networkidle');
  await anonPage.evaluate(() => { (window as unknown as { __ohneNeuladen?: boolean }).__ohneNeuladen = true; });
  const vorher = await anonPage.locator('body').innerText();
  const anfrage = anonPage.waitForRequest((req) => req.url().includes('/rpc/public_tournament'), { timeout: 10_000 });
  const start = Date.now() - 600_000;
  const tor = await appendOwner(match.id, [eventOf('GOAL', Date.now(), start, { teamId: match.team_b_id })]);
  expect(tor.results.map((r) => r.status), 'Tor der Turnierleitung wird angenommen').toEqual(['accepted']);
  // Ohne Neuladen innerhalb von 10 Sekunden (@ZM-021): die Seite hat sich verändert, ohne dass sie neu geladen wurde.
  await expect.poll(async () => (await anonPage.locator('body').innerText()) !== vorher, { message: 'Tor erscheint auf der Zuschauer-Seite', timeout: 10_000 }).toBe(true);
  expect(await anonPage.evaluate(() => (window as unknown as { __ohneNeuladen?: boolean }).__ohneNeuladen), 'Seite wurde nicht neu geladen').toBe(true);
  await expect(anfrage, 'Abfrage über public_tournament').resolves.toBeTruthy();
}

/**
 * D7c (@ZM-020): Mama Petra öffnet die Zuschauer-Seite zum ersten Mal über den Link des QR-Codes (frischer Browser ohne gespeicherte
 * Einwilligung): kein Dialog liegt über der Seite, das laufende Spiel steht mit seinem Stand da, Filter und Blättern gehen sofort, und
 * die Seite spricht nur mit der App und dem eigenen Server (keine Reichweitenmessung, kein Dritter).
 */
async function qrEinstiegOhneDialog({ browser }: StepContext): Promise<void> {
  const { groupMatches } = await fetchTurniertagBracket();
  const laufend = (await fetchTurniertagMatches()).find((m) => m.id === groupMatches[0].id); // läuft seit D4, Tor aus D7
  const namen = new Map((await fetchTurniertagTeams()).map((team) => [team.id, team.name]));
  expect(typeof laufend?.score_a === 'number' && typeof laufend.score_b === 'number', 'Vorbedingung: das erste Gruppenspiel hat einen Stand').toBeTruthy();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    const hosts = new Set<string>();
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        hosts.add(url.host);
      }
    });
    await page.goto(`/#/live/${E2E_TURNIERTAG_SHARE_CODE}`);
    await expectPageAnchor(page.getByRole('heading', { level: 1 }).first(), 'Zuschauer-Seite');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[role="dialog"], [role="alertdialog"], [aria-modal="true"]'), 'kein Dialog über der Seite').toHaveCount(0);
    const heim = namen.get(laufend?.team_a_id ?? '') ?? '?';
    const gast = namen.get(laufend?.team_b_id ?? '') ?? '?';
    const karte = page.getByRole('article', { name: new RegExp(`^Spiel \\d+: ${heim} gegen ${gast}$`) });
    await expect(karte, `das laufende Spiel ${heim} gegen ${gast} steht da`).toBeVisible({ timeout: 10_000 });
    await expect(karte, 'mit seinem Stand').toHaveText(new RegExp(`${heim}\\s*${laufend?.score_a ?? ''}[\\s\\S]*${gast}\\s*${laufend?.score_b ?? ''}`));
    // sofort filtern ...
    const filter = page.getByTestId('public-filter-bar').getByRole('button', { name: 'Gruppe B', exact: true });
    await filter.click();
    await expect(filter, 'Filter „Gruppe B“ greift beim ersten Tipp').toHaveAttribute('aria-pressed', 'true');
    // ... und blättern
    const oben = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY), { message: 'die Seite lässt sich blättern' }).toBeGreaterThan(oben);
    const erlaubt = new Set([new URL(page.url()).host, new URL(getLocalServiceRoleClient().url).host]);
    expect([...hosts].filter((host) => !erlaubt.has(host)), 'keine Anfrage an Dritte (keine Reichweitenmessung)').toEqual([]);
  } finally {
    await context.close();
  }
}

export const steps: readonly TurniertagStep[] = [
  {
    id: 'D7', title: 'Tor erscheint auf der Zuschauer-Seite ohne Neuladen innerhalb von 10 s', scenarios: ['@ZM-021'],
    owner: 'B-14/B-15 (gebaut, B-15-Anschluss #360)', expectedFail: false, run: zuschauerLive,
  },
  {
    id: 'D7c', title: 'Zuschauer-Seite per QR-Code: kein Dialog, Spiel mit Stand, sofort filtern und blättern, nichts an Dritte', scenarios: ['@ZM-020'],
    owner: 'B-19a (keine Einwilligungsabfrage, @RE-001)', expectedFail: false, run: qrEinstiegOhneDialog,
  },
];
