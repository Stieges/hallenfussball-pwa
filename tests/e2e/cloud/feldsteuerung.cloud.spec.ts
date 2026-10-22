/**
 * tests/e2e/cloud/feldsteuerung.cloud.spec.ts -- B-49 Steuer je Feld mit zwei Geräten gegen den lokalen Stack (Review #341 A2,
 * Regel T2-UI). Setzt `20261110_003_field_control.sql` (A-34) voraus.
 *
 * Szenarien: @FU-030 (Anpfiff beansprucht das freie Feld), @FU-026 (zweites Gerät nur lesend mit Hinweis), @HE-049 (Halter mit
 * Gerät), @FU-027 (die Turnierleitung übernimmt, das alte Gerät wird lesend).
 *
 * Aufbau: eigene Kopie des Freigabe-Cup (`cloneReleaseCup`, neue Ids, privat, Datum heute) mit Heiko (Helfer) als Mitglied, im
 * `finally` gelöscht. Zwei Browser-Kontexte = zwei Geräte mit je eigener Geräte-ID. Diese Datei gibt das Feld nie über die
 * Service-Rolle frei (anders als die Vorbedingungen in `appendAsRole`). Nur cloud-desktop.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { expectEngineMatchRunningUi, fetchUserIdByEmail, newRoleContext, openCockpit } from './engineHelpers';
import { getLocalServiceRoleClient } from './helpers';
import { addMember, cloneReleaseCup, deleteCup } from './coadminEinsatz';
import { E2E_USERS } from './testData';

interface FieldControlRow { field: number; epoch: number; holder_user_id: string | null; holder_device_id: string | null; holder_device_label: string | null }

async function feldStand(tournamentId: string): Promise<FieldControlRow[]> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/field_control?tournament_id=eq.${tournamentId}&select=field,epoch,holder_user_id,holder_device_id,holder_device_label`, { headers });
  if (!res.ok) {
    throw new Error(`field_control nicht lesbar: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as FieldControlRow[];
}

async function geraeteId(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem('hallenfussball:deviceId'));
}

test.describe('B-49 Steuer je Feld (zwei Geräte, lokaler Stack)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Eigene Turnierkopie je Fall, nur auf cloud-desktop.');
  });

  test('@FU-030 @FU-026 @HE-049 @FU-027 Heiko pfeift an und steuert das Feld; Ollis Cockpit ist nur lesend mit Hinweis; Olli übernimmt, Heikos Gerät wird lesend', async ({ browser }, testInfo) => {
    test.setTimeout(150_000);
    const cup = await cloneReleaseCup('b49', { withCoAdmin: false });
    const heiko = await newRoleContext(browser, 'helper');
    const olli = await newRoleContext(browser, 'owner');
    try {
      const heikoId = await fetchUserIdByEmail(E2E_USERS.helper.email);
      const olliId = await fetchUserIdByEmail(E2E_USERS.owner.email);
      await addMember(cup.id, heikoId, 'collaborator', cup.ownerId);

      // 1. @FU-030: Heiko pfeift auf dem freien Feld an – sein Gerät steuert (Epoche 1, seine Geräte-ID)
      await openCockpit(heiko.page, cup.id, cup.matchId);
      await heiko.page.locator('[data-testid="match-start-button"]').click();
      await expectEngineMatchRunningUi(heiko.page);
      const heikoGeraet = await geraeteId(heiko.page);
      expect(heikoGeraet, 'Heikos Gerät hat eine Geräte-ID').toMatch(/^[0-9a-f-]{36}$/);
      await expect.poll(() => feldStand(cup.id), { timeout: 15000 }).toEqual([
        expect.objectContaining({ epoch: 1, holder_user_id: heikoId, holder_device_id: heikoGeraet }),
      ]);
      // @HE-049: die Bezeichnung wird nachgetragen (Anspruch per Anpfiff setzt keine)
      await expect.poll(async () => (await feldStand(cup.id))[0]?.holder_device_label, { timeout: 15000 }).toBe('computer');

      // 2. @FU-026: Olli öffnet dasselbe Spiel – nur lesend, mit Halter und „Spielleitung übernehmen“, kein Berechtigungs-Banner
      await openCockpit(olli.page, cup.id, cup.matchId);
      await expect(olli.page.getByTestId('leiste-leitet')).toHaveText(/^Feld 1 wird von Heiko Helfer \(Laptop\) gesteuert$/, { timeout: 15000 });
      await expect(olli.page.locator('[data-testid="match-pause-button"]')).toHaveCount(0);
      await expect(olli.page.locator('[data-testid="goal-button-home"]')).toHaveCount(0);
      await expect(olli.page.getByTestId('cockpit-readonly-banner')).toHaveCount(0);
      await testInfo.attach('olli-nur-lesend', { body: await olli.page.screenshot({ fullPage: true }), contentType: 'image/png' });

      // 3. @FU-027: Rückfrage mit Halter und Folge, dann bestätigen
      await olli.page.getByTestId('leiste-uebernehmen').click();
      await expect(olli.page.getByTestId('takeover-halter')).toHaveText('Feld 1 wird gerade von Heiko Helfer (Laptop) gesteuert');
      await testInfo.attach('olli-rueckfrage', { body: await olli.page.screenshot({ fullPage: true }), contentType: 'image/png' });
      await olli.page.getByTestId('takeover-confirm').click();
      await expectEngineMatchRunningUi(olli.page);
      const olliGeraet = await geraeteId(olli.page);
      await expect.poll(() => feldStand(cup.id), { timeout: 15000 }).toEqual([
        expect.objectContaining({ epoch: 2, holder_user_id: olliId, holder_device_id: olliGeraet }),
      ]);

      // 4. Heikos Gerät wird lesend: „Die Spielleitung hat jetzt Olli …“, keine Steuer-Tasten mehr (Takt 5 s)
      await expect(heiko.page.getByTestId('leiste-leitet')).toHaveText(/^Die Spielleitung hat jetzt Olli Owner/, { timeout: 15000 });
      await expect(heiko.page.locator('[data-testid="match-pause-button"]')).toHaveCount(0);
      await expect(heiko.page.getByTestId('leiste-uebernehmen'), 'bei laufendem Spiel übernimmt ein Helfer nicht (@FU-120)').toHaveCount(0);
      await testInfo.attach('heiko-verloren', { body: await heiko.page.screenshot({ fullPage: true }), contentType: 'image/png' });
    } finally {
      await heiko.context.close();
      await olli.context.close();
      await deleteCup(cup.id);
    }
  });
});
