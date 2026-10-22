/**
 * tests/e2e/cloud/helfer-beitritt.cloud.spec.ts — GA5 A-17b „Einstieg per QR“.
 *
 * Szenarien: @HE-001 (Scan → Name → gleiche Prüfzahl → Zulassen → Feld), @HE-089 (Konto scannt → Rückfrage → der Laptop-Kontext
 * bleibt angemeldet), @HE-015 (Gegenbeispiel: Hallen-WLAN ohne Internet → „Für den Einstieg brauchst du Netz“, Name bleibt).
 *
 * Voraussetzung: lokaler Stack MIT der Migration `20261110_008_helper_join.sql` (A-16). Dieser Stack hat sie noch nicht
 * (Einspielen = Sache des Fensters/Controllers; hier wird nie zurückgesetzt oder gesät). Darum läuft der Block erst mit
 * `E2E_STACK_HAS_008=1` und ist sonst `fixme` mit Grund. Die Leitungs-Seite (Team & Helfer, A-18a) gibt es noch nicht:
 * Zulassen läuft deshalb über die Schnittstelle `decide_join_request` mit der Prüfzahl des Helfer-Handys (S-1).
 */
import { test, expect } from './fixtures';
import { restAsRole } from './restAsRole';
import { E2E_LIVE_CUP_ID } from './testData';

const HAS_008 = process.env.E2E_STACK_HAS_008 === '1';

test.describe('Helfer-Beitritt per QR (A-17b)', () => {
  test.fixme(!HAS_008, 'Lokaler Stack ohne Migration _008 (helper_join): join_code_info/request_helper_access fehlen. Mit E2E_STACK_HAS_008=1 gegen einen Stack mit _008 starten.');
  test.beforeEach(({ browserName: _browserName }, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Ein Lauf genügt (cloud-desktop); mobil würde denselben Cup doppelt anfragen.');
  });

  async function helperCode(): Promise<string> {
    const res = await restAsRole('owner', 'POST', 'rpc/ensure_helper_code', { p_tournament_id: E2E_LIVE_CUP_ID });
    expect(res.status).toBe(200);
    return (res.json as { code: string }).code;
  }

  test('@HE-001 Scan → Name → Prüfzahl → Zulassen mit Feld 2 → Feld 2 öffnet', async ({ browser }) => {
    const code = await helperCode();
    const helper = await (await browser.newContext()).newPage();
    await helper.goto(`/#/join/${code}`);
    await helper.getByTestId('join-name').fill('Tom');
    await helper.getByTestId('join-submit').click();
    const shown = Number(await helper.getByTestId('check-number').innerText());
    expect(shown).toBeGreaterThanOrEqual(10);

    const list = await restAsRole('owner', 'POST', 'rpc/list_helper_access', { p_tournament_id: E2E_LIVE_CUP_ID });
    const request = (list.json as { requests: { id: string; name: string; checkNumber: number }[] }).requests.find((r) => r.name === 'Tom');
    expect(request?.checkNumber).toBe(shown);
    const decided = await restAsRole('owner', 'POST', 'rpc/decide_join_request', { p_request_id: request?.id, p_accept: true, p_field: 2, p_check_number: shown });
    expect(decided.status).toBe(200);

    // Gleicher QR noch einmal: zugelassen → Feld 2, keine zweite Anfrage (@HE-095).
    await helper.goto(`/#/join/${code}`);
    await expect(helper).toHaveURL(/\/live\?f=2/);
  });

  test('@HE-089 Konto scannt: Rückfrage; „Weiter“ meldet nur diesen Kontext ab, der Laptop bleibt angemeldet', async ({ asRole }) => {
    const code = await helperCode();
    const laptop = await asRole('coadmin');
    const phone = await asRole('coadmin');
    await phone.goto(`/#/join/${code}`);
    await expect(phone.getByTestId('join-account-continue')).toBeVisible();
    await phone.getByTestId('join-account-continue').click();
    await expect(phone.getByTestId('join-submit')).toBeVisible();
    await laptop.goto('/#/');
    await expect(laptop.getByTestId('join-account-continue')).toHaveCount(0);
    await expect(laptop.getByText(/Anmelden/)).toHaveCount(0);
  });

  test('@HE-015 Gegenbeispiel: ohne Internet „Für den Einstieg brauchst du Netz“, nicht „Code ungültig“, Name bleibt', async ({ browser }) => {
    const code = await helperCode();
    const context = await browser.newContext();
    const helper = await context.newPage();
    await helper.goto(`/#/join/${code}`);
    await helper.getByTestId('join-name').fill('Tom');
    await context.route('**/rest/v1/rpc/**', (route) => route.abort());
    await context.route('**/auth/v1/**', (route) => route.abort());
    await helper.getByTestId('join-submit').click();
    await expect(helper.getByTestId('join-offline')).toContainText('Für den Einstieg brauchst du Netz');
    await expect(helper.getByTestId('join-name')).toHaveValue('Tom');
    await expect(helper.getByText('nicht gültig')).toHaveCount(0);
  });
});
