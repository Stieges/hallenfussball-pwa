/**
 * tests/e2e/cloud/helfer-team.cloud.spec.ts — GA5 A-18a „Team & Helfer“, zwei Rollen (Olli = owner, Maria = coadmin) und ein
 * Helfer-Gerät ohne Konto.
 *
 * Szenarien: @HE-001/@HE-105 (Zulassen mit Feld 2 in höchstens 3 Tipps, nur mit der Zahl des Handys), @HE-021 (Gegenbeispiel:
 * falsche Zahl ändert nichts), @HE-008/@HE-102 (Code erneuern mit offenen Anfragen: ablehnen → „Anfrage abgelehnt“, mit dem
 * neuen Code neue Anfrage möglich), @HE-055/@HE-080 (Maria entzieht Tom → innerhalb von 3 s „Du hast keinen Zugriff mehr“).
 *
 * Voraussetzung: lokaler Stack MIT der Migration `20261110_008_helper_join.sql` (A-16) und die Beitrittsseite `/join/:code`
 * (A-17b); die Anzeige am Helfer-Handy (Warteschirm → „Anfrage abgelehnt“, „Du hast keinen Zugriff mehr“) kommt mit A-17c.
 * Der lokale Stack hat _008 noch nicht (Einspielen = Sache des Fensters/Controllers; hier wird nie gestartet, gestoppt,
 * zurückgesetzt oder gesät). Darum `fixme` mit Grund, solange `E2E_STACK_HAS_008=1` fehlt.
 */
import { test, expect } from './fixtures';
import { restAsRole } from './restAsRole';
import { loginAsRole } from './helpers';
import { E2E_TEAM_HELFER_CUP_ID } from './testData';

const HAS_008 = process.env.E2E_STACK_HAS_008 === '1';
// Eigener Cup (nur diese Datei), der nie zurückgesetzt wird: Namen je Lauf UND je Test eindeutig, Tests nacheinander,
// offene Anfragen vor jedem Test abgelehnt.
const RUN = String(Date.now() % 100000);
let current = '';
let counter = 0;
/** Name je Test eindeutig: Vorname + Lauf + laufende Nummer des Tests + Wiederholung (`serial`: ein Worker, feste Reihenfolge). */
const nm = (name: string) => `${name}${RUN}${current}`;
const ADMIN = `/#/tournament/${E2E_TEAM_HELFER_CUP_ID}/admin/team-helpers`;

test.describe('Team & Helfer, zwei Rollen (A-18a)', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach((_fixtures, testInfo) => { counter += 1; current = `${counter}${testInfo.retry}`; });
  test.fixme(!HAS_008, 'Lokaler Stack ohne Migration _008 (helper_join). Mit E2E_STACK_HAS_008=1 gegen einen Stack mit _008 und mit A-17b/A-17c starten.');
  test.beforeEach(async () => {
    if (!HAS_008) { return; }
    const list = await restAsRole('owner', 'POST', 'rpc/list_helper_access', { p_tournament_id: E2E_TEAM_HELFER_CUP_ID });
    for (const r of (list.json as { requests?: { id: string }[] } | null)?.requests ?? []) {
      await restAsRole('owner', 'POST', 'rpc/decide_join_request', { p_request_id: r.id, p_accept: false });
    }
  });
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Ein Lauf genügt (cloud-desktop); mobil würde denselben Cup doppelt anfragen.');
  });

  const consent = { errorTracking: true, sessionReplay: false, timestamp: Date.now(), version: 1 };

  async function leaderPage(browser: import('@playwright/test').Browser, role: 'owner' | 'coadmin') {
    const context = await browser.newContext();
    await context.addInitScript((c) => localStorage.setItem('app:consent', JSON.stringify(c)), consent);
    const page = await context.newPage();
    await loginAsRole(page, role);
    await page.goto(ADMIN);
    await expect(page.getByTestId('helper-code-card')).toBeVisible({ timeout: 15000 });
    return page;
  }

  async function joinAs(browser: import('@playwright/test').Browser, code: string, name: string) {
    const context = await browser.newContext();
    // Datenschutz-Abfrage vorab beantwortet (wie `newDevice` in helfer-beitritt): sonst deckt ihr Dialog „Anfrage senden“ zu.
    await context.addInitScript((c) => localStorage.setItem('app:consent', JSON.stringify(c)), consent);
    const page = await context.newPage();
    await page.goto(`/#/join/${code}`);
    await page.getByTestId('join-name').fill(name);
    await page.getByTestId('join-submit').click();
    const shown = Number(await page.getByTestId('check-number').innerText());
    return { page, shown };
  }

  test('@HE-001 @HE-105 Zulassen mit Feld 2: Zulassen, Feld, Zahl = 3 Tipps; der Server lässt nur mit der Zahl des Handys zu', async ({ browser }) => {
    const olli = await leaderPage(browser, 'owner');
    const code = (await olli.getByTestId('helper-code').innerText()).trim();
    const { shown } = await joinAs(browser, code, nm('Tom'));

    await expect(olli.getByTestId('join-request').filter({ hasText: nm('Tom') })).toBeVisible({ timeout: 5000 });
    await expect(olli.getByTestId('join-request').first()).not.toContainText(String(shown)); // S-1: keine Zahl in der Zeile
    await olli.getByTestId('request-approve').first().click(); // Tipp 1
    await olli.getByTestId('approve-field-2').click(); // Tipp 2
    await olli.getByTestId(`approve-number-${shown}`).click(); // Tipp 3

    await expect(olli.getByTestId('helper-row').filter({ hasText: nm('Tom') })).toContainText('Feld 2');
  });

  test('@HE-105 Gegenbeispiel: falsche Zahl – „Zahl stimmt nicht“, kein Zugang, die Anfrage bleibt offen', async ({ browser }) => {
    const olli = await leaderPage(browser, 'owner');
    const code = (await olli.getByTestId('helper-code').innerText()).trim();
    const { shown } = await joinAs(browser, code, nm('Tom'));
    await olli.getByTestId('request-approve').first().click();
    const wrong = olli.locator('[data-testid^="approve-number-"]').filter({ hasNotText: String(shown) }).first();
    await wrong.click();
    await expect(olli.getByTestId('check-number-mismatch')).toContainText('Zahl stimmt nicht – frag nach der Zahl auf dem Handy');
    const list = await restAsRole('owner', 'POST', 'rpc/list_helper_access', { p_tournament_id: E2E_TEAM_HELFER_CUP_ID });
    expect((list.json as { members: { name: string }[] }).members.filter((m) => m.name === nm('Tom'))).toHaveLength(0);
  });

  test('@HE-008 @HE-102 Erneuern mit 2 offenen Anfragen → „ablehnen“ → Geräte zeigen „Anfrage abgelehnt“, mit dem neuen Code neue Anfrage', async ({ browser }) => {
    const olli = await leaderPage(browser, 'owner');
    const code = (await olli.getByTestId('helper-code').innerText()).trim();
    const lena = await joinAs(browser, code, nm('Lena'));
    await joinAs(browser, code, nm('Paul'));
    await olli.getByTestId('helper-code-renew').click();
    await expect(olli.getByTestId('renew-dialog')).toContainText('2 offene Anfragen behalten oder ablehnen?');
    await olli.getByTestId('renew-decline').click();
    await expect(lena.page.getByText('Anfrage abgelehnt')).toBeVisible({ timeout: 5000 });
    const newCode = (await olli.getByTestId('helper-code').innerText()).trim();
    expect(newCode).not.toBe(code);
    await lena.page.goto(`/#/join/${newCode}`);
    await lena.page.getByTestId('join-name').fill(nm('Lena'));
    await lena.page.getByTestId('join-submit').click();
    await expect(olli.getByTestId('join-request').filter({ hasText: nm('Lena') })).toBeVisible({ timeout: 5000 });
  });

  test('@HE-055 @HE-080 Maria entzieht Tom: sein Handy zeigt innerhalb von 3 Sekunden „Du hast keinen Zugriff mehr“', async ({ browser }) => {
    const olli = await leaderPage(browser, 'owner');
    const code = (await olli.getByTestId('helper-code').innerText()).trim();
    const tom = await joinAs(browser, code, nm('Tom'));
    await olli.getByTestId('request-approve').first().click();
    await olli.getByTestId('approve-field-2').click();
    await olli.getByTestId(`approve-number-${tom.shown}`).click();

    const maria = await leaderPage(browser, 'coadmin');
    await maria.getByTestId('helper-row').filter({ hasText: nm('Tom') }).getByTestId('helper-revoke').click();
    await maria.getByTestId('helper-revoke-confirm').click();
    await expect(tom.page.getByText('Du hast keinen Zugriff mehr')).toBeVisible({ timeout: 3000 });
    await expect(maria.getByTestId('helper-row').filter({ hasText: nm('Tom') })).toContainText('Zugang entzogen');
  });
});
