/**
 * tests/e2e/cloud/a36c-zeit.cloud.spec.ts — Paket A-36c, F-ZEIT (@ZM-111):
 * „Uhrzeiten erscheinen in der Ortszeit des Turniers“, egal in welcher Zeitzone das Gerät steht.
 *
 * Die Cloud-Zeile trägt den Anstoß als Wanduhr (`matches.scheduled_start`, „HH:MM:SS“). Das Gerät steht hier in
 * America/New_York (Turnier: Europe/Berlin); die Zuschauer-Seite muss trotzdem die Uhrzeit aus der Zeile zeigen.
 * Lokale (Gast-)Turniere tragen die Uhrzeit als Zeitpunkt in der Gerätezeit und sind deshalb kein Beleg für @ZM-111.
 */
import { test, expect } from './fixtures';
import { getLocalServiceRoleClient } from './helpers';
import { E2E_PUBLIC_CUP_ID, E2E_PUBLIC_CUP_SHARE_CODE } from './testData';

test.use({ timezoneId: 'America/New_York' });

test.describe('A-36c F-ZEIT (@ZM-111)', () => {
  test('@ZM-111 die Zuschauer-Seite zeigt den Anstoß aus der Cloud-Zeile, nicht die Gerätezeit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'cloud-desktop', 'ein Projekt reicht, die Zeitzone ist unabhängig von der Breite');
    const { url, headers } = getLocalServiceRoleClient();
    const res = await fetch(
      `${url}/rest/v1/matches?tournament_id=eq.${E2E_PUBLIC_CUP_ID}&scheduled_start=not.is.null&order=scheduled_start&select=id,scheduled_start&limit=1`,
      { headers },
    );
    expect(res.ok).toBe(true);
    const [zeile] = (await res.json()) as Array<{ id: string; scheduled_start: string }>;
    expect(zeile).toBeDefined();
    const erwartet = zeile.scheduled_start.slice(0, 5); // „HH:MM“ der Zeile

    await page.goto(`/#/live/${E2E_PUBLIC_CUP_SHARE_CODE}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Public-Cup', { exact: true }).first()).toBeVisible({ timeout: 15000 });
    const karte = page.locator('[data-match-card]', { has: page.getByTestId(`match-goals-${zeile.id}-home`) }).first();
    const zeile2 = page.getByRole('row', { name: /.+/ }).filter({ has: page.getByTestId(`match-circle-${zeile.id}`) }).first();
    // Handy-Karte (Kopfzeile) bzw. Desktop-Zeile: beide tragen die Uhrzeit des Spiels
    await expect(async () => {
      const sichtbar = (await karte.isVisible().catch(() => false)) ? karte : zeile2;
      await expect(sichtbar).toContainText(erwartet);
    }).toPass({ timeout: 15000 });
    // Gegenbeispiel: dieselbe Uhrzeit, in New York gerechnet (6 Stunden früher), steht nicht am Spiel
    const stunde = Number(erwartet.slice(0, 2));
    const verschoben = `${String((stunde + 18) % 24).padStart(2, '0')}${erwartet.slice(2)}`;
    await expect(page.locator(`text=${verschoben}`).first()).toHaveCount(0);
  });
});
