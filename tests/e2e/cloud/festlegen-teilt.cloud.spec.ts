/**
 * tests/e2e/cloud/festlegen-teilt.cloud.spec.ts — Defekt C-FESTLEGEN-TEILT-NICHT (@W1-020, @W1-037).
 *
 * Angemeldet und online: Nach dem ersten „Festlegen“ im Assistenten kann jeder mit dem Link zuschauen. Gepruft wird der
 * Weg eines echten Zuschauers: `/#/live/<code>` in einem frischen Kontext OHNE Anmeldung zeigt das Turnier. Den Code
 * liest der Test aus der Datenbank (Service-Role), nicht aus der Oberflaeche -- so ist belegt, dass der SERVER ihn kennt
 * (is_public = true, share_code gesetzt), nicht nur die lokale Kopie.
 * Laeuft nur auf cloud-desktop (eigenes Wegwerf-Turnier, aufgeraeumt im finally).
 */
import { test, expect } from './fixtures';
import { getLocalServiceRoleClient, newFreshContext, safeCleanup } from './helpers';
import { t } from '../helpers/i18n';

const FUTURE_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

interface TournamentRow { id: string; is_public: boolean; share_code: string | null }

async function fetchByTitle(title: string): Promise<TournamentRow | null> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/tournaments?title=eq.${encodeURIComponent(title)}&select=id,is_public,share_code`, { headers });
  if (!res.ok) { throw new Error(`tournaments-Abfrage fehlgeschlagen: ${res.status} ${await res.text()}`); }
  const rows = (await res.json()) as TournamentRow[];
  return rows[0] ?? null;
}

async function deleteByTournamentId(id: string): Promise<void> {
  const { url, headers } = getLocalServiceRoleClient();
  for (const table of ['matches', 'teams']) {
    await fetch(`${url}/rest/v1/${table}?tournament_id=eq.${id}`, { method: 'DELETE', headers });
  }
  const res = await fetch(`${url}/rest/v1/tournaments?id=eq.${id}`, { method: 'DELETE', headers });
  if (!res.ok) { throw new Error(`Loeschen fehlgeschlagen: ${res.status} ${await res.text()}`); }
}

test.describe('Festlegen teilt das Turnier (C-FESTLEGEN-TEILT-NICHT)', () => {
  test('@W1-020 nach dem ersten Festlegen zeigt /live/<code> ohne Anmeldung das Turnier', async ({ asRole, browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'cloud-desktop', 'eigenes Wegwerf-Turnier, nur auf cloud-desktop');
    const title = `Festlegen-Teilt-${Date.now()}`;
    const owner = await asRole('owner');
    let createdId: string | null = null;
    try {
      await owner.goto('/#/tournament/new');
      await owner.waitForLoadState('networkidle');

      await owner.locator(`input[placeholder*="${t('wizard:step3.tournamentNamePlaceholder')}"]`).first().fill(title);
      const location = owner.locator('input[placeholder*="Sporthalle"]');
      if (await location.count() > 0) { await location.first().fill('E2E Halle'); }
      await owner.locator('input[type="date"]').first().fill(FUTURE_DATE);
      await owner.locator('input[type="time"]').first().fill('09:00');
      const next = owner.getByRole('button', { name: 'Weiter', exact: true });
      await expect(next).toBeEnabled({ timeout: 5000 });
      await next.click();

      await expect(owner).toHaveURL(/\/tournament\/new\?step=2/, { timeout: 10000 });
      await owner.locator('[data-testid="wizard-type-classic"]').click();
      await next.click();
      await expect(owner).toHaveURL(/\/tournament\/new\?step=3/, { timeout: 10000 });
      await next.click();
      await expect(owner).toHaveURL(/\/tournament\/new\?step=4/, { timeout: 10000 });
      await next.click();
      await expect(owner).toHaveURL(/\/tournament\/new\?step=5/, { timeout: 10000 });

      const generate = owner.locator('[data-testid="wizard-generate-teams"]');
      if (await generate.count() > 0 && await generate.isVisible()) {
        await generate.click();
      } else {
        for (let i = 1; i <= 4; i++) {
          await owner.locator('[data-testid="wizard-add-team"]').click();
          await owner.locator(`input[placeholder="${t('wizard:step4.teamNamePlaceholder')}"]`).last().fill(`Team ${i}`);
        }
      }
      await next.click();
      await expect(owner).toHaveURL(/\/tournament\/new\?step=6/, { timeout: 10000 });
      await owner.locator('[data-testid="wizard-show-preview"]').click();

      // Die Vorschau kuendigt den Link an (nur angemeldet und online) -- dieselbe Entscheidung wie das Teilen.
      await expect(owner.getByTestId('publish-explanation')).toContainText(t('wizard:publish.explanationPublic'), { timeout: 15000 });
      await owner.locator('[data-testid="preview-publish"]').click();
      await expect(owner).not.toHaveURL(/\/tournament\/new/, { timeout: 30000 });

      // Server-Seite: oeffentlich, Code gesetzt (vorher wurde beides nie in die Cloud geschrieben).
      await expect.poll(async () => (await fetchByTitle(title))?.share_code ?? null, {
        message: 'der Server kennt den Teilen-Code', timeout: 30000,
      }).not.toBeNull();
      const row = await fetchByTitle(title);
      createdId = row?.id ?? null;
      expect(row?.is_public, 'is_public in der Cloud').toBe(true);

      // Der in der App angezeigte Code (Admin -> Sichtbarkeit, lokale Kopie der Turnierleitung) ist der Code der Datenbank,
      // nicht der lokal erzeugte (sonst zeigte die App einen toten Link/QR).
      await owner.goto(`/#/tournament/${row?.id ?? ''}/admin/visibility`);
      await owner.getByRole('button', { name: /Turnier-Sichtbarkeit/ }).click();
      await expect(owner.locator('input[readonly]').first()).toHaveValue(new RegExp(row?.share_code ?? 'KEIN-CODE'), { timeout: 15000 });

      // Ein Zuschauer ohne Anmeldung (frischer Kontext).
      const viewer = await newFreshContext(browser);
      try {
        await viewer.page.goto(`/#/live/${row?.share_code ?? ''}`);
        await expect(viewer.page.getByText(title).first()).toBeVisible({ timeout: 20000 });
      } finally {
        await viewer.context.close();
      }
    } finally {
      await safeCleanup('Wegwerf-Turnier Festlegen-Teilt', async () => {
        const id = createdId ?? (await fetchByTitle(title))?.id ?? null;
        if (id) { await deleteByTournamentId(id); }
      });
    }
  });
});
