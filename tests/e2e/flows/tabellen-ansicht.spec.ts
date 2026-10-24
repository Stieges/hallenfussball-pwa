/**
 * Reiter Tabellen bei „Jeder gegen jeden“ (Regel T2-UI): @W2A-075 die Tabelle steht sofort da, mit der Markierung „Gleichstand –
 * Entscheidung nötig“ und ohne „Dieses Turnier hat keine Gruppen“; die Ansicht steht in der Adresse, Neuladen zeigt dieselbe.
 * @W2A-076 solange der Gleichstand offen ist, trägt keines der betroffenen Teams eine Medaille. Daten: Saat `nikolaus-gleichstand`.
 * Läuft gegen den lokalen Dev-Server ohne Supabase; nie gegen die Produktion.
 */
import { test, expect } from '../helpers/test-fixtures';
// @ts-expect-error – .mjs ohne Typen; derselbe Lader wie bei `npm run visual:metrics --saat`
import { installiereSaat, leseSaat } from '../../../scripts/visual-metrics/saat/lader.mjs';

const ID = 'nikolaus-gleichstand';

interface SaatLike { datenbanken: { store: string; eintraege: { tournaments?: Array<Record<string, unknown>> } }[] }

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
});

test('@W2A-075 Tabelle sofort sichtbar mit Markierung, Ansicht in der Adresse, Neuladen behält sie; @W2A-076 keine Medaille bei offenem Gleichstand', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const saat = leseSaat(ID) as SaatLike; // Voreinstellung „nur Platz 1“ wie im Assistenten (@W2A-066)
  const turnier = saat.datenbanken.find((d) => d.store === 'cache')?.eintraege.tournaments?.[0];
  if (turnier) { turnier.placementsToPlayOut = [1]; turnier.version = 1; }
  await installiereSaat(page.context(), saat);
  await page.goto(`/#/tournament/${ID}/standings`);

  const marke = page.locator('[data-testid="tie-marker"]:visible').first(); // Tabelle und Handy-Karte tragen je eine, nur eine ist sichtbar
  await expect(marke).toBeVisible({ timeout: 25000 });
  await expect(marke).toContainText('Gleichstand – Entscheidung nötig');
  await expect(page.getByText('keine Gruppen')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tabelle', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Gesamtplatzierung' }).click();
  await expect(page).toHaveURL(/ansicht=platzierung/);
  await expect(page.getByTestId('place-medal').first()).toBeVisible();
  await expect(page.locator('[data-testid="place-medal"][data-medal="gold"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="place-medal"][data-medal="bronze"]')).toHaveCount(0); // Platz 3 ist offen (Petting, Otting)

  await page.reload();
  await expect(page.getByTestId('place-medal').first()).toBeVisible({ timeout: 25000 });
  await expect(page).toHaveURL(/ansicht=platzierung/);
  await expect(page.locator('[data-testid="place-medal"][data-medal="bronze"]')).toHaveCount(0);
});
