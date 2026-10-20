/**
 * CA-5 (Befund C-LISTE-NUR-EIGENTUEMER) – Startseite der Co-Admin gegen den lokalen Stack.
 *
 * @HE-086 „Und das Nikolaus-Turnier steht nicht auf ihrer Startseite“ (vor dem Eintrag)
 * @HE-085 / NEU-CA1 (Vorschlag): nach dem Eintrag steht das Turnier mit der Angabe „Co-Admin“ da, sie kann es öffnen,
 *   „Löschen“ bietet die App nicht an.
 * @HE-087 „Und das Nikolaus-Turnier steht nach dem Neuladen nicht mehr auf ihrer Startseite“ – auch nicht als eigenes
 *   „nur lokales“ Turnier (Plan-Review Auflage 10a); das Turnier bleibt beim Eigentümer unverändert (nichts hochgeladen).
 * Gegenbeispiele: Eigentümer sieht sein Turnier ohne Marke und mit „Löschen“; ein Fremder sieht ein öffentliches
 *   fremdes Turnier nicht auf seiner Startseite (Liste nicht über die Lese-Regel allein).
 *
 * Eigenes Konto je Lauf (frisches Gerät, Mail `ca5-<zufall>@example.invalid`), Eintrag/Austragen wie die Betreiber-Vorlage
 * (INSERT mit `accepted_at`, DELETE der Zeile) per Service-Rolle; Aufräumen im `finally`.
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { getLocalServiceRoleClient, gotoLogin, newFreshContext, safeCleanup } from './helpers';
import { E2E_DRAFT_CUP_ID, E2E_PUBLIC_CUP_ID, E2E_RELEASE_CUP_ID, E2E_RELEASE_CUP_TITLE, E2E_TEST_PASSWORD } from './testData';

const CUP = E2E_RELEASE_CUP_ID;
/** Entwurf: hier bietet die Karte dem Eigentümer „Löschen“ an (ein festgelegtes Turnier ohne geladene Spiele nie, @LZ-003 F1). */
const DRAFT = E2E_DRAFT_CUP_ID;

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const sr = getLocalServiceRoleClient();
  const response = await fetch(`${sr.url}${path}`, {
    ...init,
    headers: { ...sr.headers, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  }
  return response;
}

async function createAccount(email: string): Promise<string> {
  const body = { email, password: E2E_TEST_PASSWORD, email_confirm: true, user_metadata: { full_name: 'Maria CA5' } };
  const created = (await (await rest('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify(body) })).json()) as { id: string };
  return created.id;
}

async function cupRow(): Promise<{ owner_id: string; title: string; deleted_at: string | null }> {
  const rows = (await (await rest(`/rest/v1/tournaments?id=eq.${CUP}&select=owner_id,title,deleted_at`)).json()) as Array<{ owner_id: string; title: string; deleted_at: string | null }>;
  return rows[0];
}

async function enterCoAdmin(tournamentId: string, userId: string, ownerId: string): Promise<void> {
  const row = { id: randomUUID(), tournament_id: tournamentId, user_id: userId, role: 'co-admin', invited_by: ownerId, accepted_at: new Date().toISOString(), team_ids: [] };
  await rest('/rest/v1/tournament_collaborators', { method: 'POST', body: JSON.stringify(row) });
}

async function removeCoAdmin(tournamentId: string, userId: string): Promise<void> {
  await rest(`/rest/v1/tournament_collaborators?tournament_id=eq.${tournamentId}&user_id=eq.${userId}&role=eq.co-admin`, { method: 'DELETE' });
}

const card = (id: string) => `[data-testid="tournament-card-${id}"]`;

/** Belegbilder (visuelle Prüfung): Karte der Co-Admin bei 360×640 und 1280×800, hell und dunkel, ins Test-Ausgabeverzeichnis. */
async function captureCard(page: import('@playwright/test').Page, id: string): Promise<void> {
  const original = page.viewportSize();
  for (const size of [{ width: 360, height: 640 }, { width: 1280, height: 800 }]) {
    await page.setViewportSize(size);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.locator(card(id)).scrollIntoViewIfNeeded();
      await page.screenshot({ path: test.info().outputPath(`ca5-coadmin-${size.width}x${size.height}-${colorScheme}.png`) });
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  if (original) { await page.setViewportSize(original); }
}

/** Abschnitte „Bevorstehend“ (zu, wenn ein Turnier läuft) und „Entwürfe“ (immer zu) aufklappen, bevor die Karte geprüft wird. */
async function openSection(page: import('@playwright/test').Page, section: 'upcoming' | 'draft'): Promise<void> {
  const toggle = page.locator(`[data-testid="section-${section}"] [aria-expanded]`).first();
  await expect(toggle).toBeVisible({ timeout: 15000 });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') {
    await toggle.click();
  }
}

/** Ids der lokalen Turnierkopien des Geräts (IndexedDB `hallenfussball`/`cache`, Schlüssel `tournaments`). */
async function localCopyIds(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(async () => new Promise<string[]>((resolve) => {
    const request = indexedDB.open('hallenfussball');
    request.onsuccess = () => {
      const read = request.result.transaction('cache', 'readonly').objectStore('cache').get('tournaments');
      read.onsuccess = () => resolve(((read.result as { value?: Array<{ id: string }> } | undefined)?.value ?? []).map((t) => t.id));
      read.onerror = () => resolve([]);
    };
    request.onerror = () => resolve([]);
  }));
}

test.describe('CA-5 Startseite der Co-Admin', () => {
  test('@HE-086 @HE-085 @HE-087 Maria: vorher nicht da, eingetragen mit „Co-Admin“ ohne „Löschen“, ausgetragen weg', async ({ browser }) => {
    const email = `ca5-${randomUUID().slice(0, 8)}@example.invalid`;
    const { context, page } = await newFreshContext(browser);
    let userId: string | null = null;
    try {
      userId = await createAccount(email);
      const before = await cupRow();
      // Anker: Maria ist von Anfang an Co-Admin im Entwurf-Cup – steht dessen Abschnitt da, ist die Liste geladen
      // (sonst bestünde „Karte fehlt“ schon vor dem Laden).
      await enterCoAdmin(DRAFT, userId, before.owner_id);

      // Frisches Gerät, Anmeldung mit Passwort über die Oberfläche
      await gotoLogin(page);
      await page.locator('[data-testid="login-email-input"]').fill(email);
      await page.locator('[data-testid="login-password-input"]').fill(E2E_TEST_PASSWORD);
      await page.locator('[data-testid="login-submit-button"]').click();
      await expect(page.locator('[data-testid="auth-avatar-button"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="section-draft"]')).toBeVisible({ timeout: 15000 });
      // @HE-086: im Freigabe-Cup nicht eingetragen → nicht auf der Startseite
      await expect(page.locator(card(CUP))).toHaveCount(0);

      // @HE-085: Betreiber trägt Maria ein → nach dem Neuladen Karte mit „Co-Admin“
      await enterCoAdmin(CUP, userId, before.owner_id);
      await page.reload();
      await openSection(page, 'upcoming');
      const cupCard = page.locator(card(CUP));
      await expect(cupCard).toBeVisible({ timeout: 15000 });
      await expect(cupCard.locator(`[data-testid="tournament-role-${CUP}"]`)).toHaveText('Co-Admin');
      await captureCard(page, CUP);

      // „Löschen“ fehlt – geprüft am Entwurf, wo der Eigentümer es angeboten bekommt (Gegenbeispiel unten)
      await openSection(page, 'draft');
      const draftCard = page.locator(card(DRAFT));
      await expect(draftCard.locator(`[data-testid="tournament-role-${DRAFT}"]`)).toHaveText('Co-Admin');
      await page.locator(`[data-testid="tournament-${DRAFT}-actions-trigger"]`).click();
      await expect(page.locator('[data-testid="action-menu-item-copy"]')).toBeVisible();
      await expect(page.locator('[data-testid="action-menu-item-delete"]')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-testid="action-menu-item-copy"]')).toHaveCount(0);

      // … und kann es öffnen
      await cupCard.click();
      await expect(page).toHaveURL(new RegExp(CUP), { timeout: 15000 });
      await expect(page.getByText(E2E_RELEASE_CUP_TITLE).first()).toBeVisible({ timeout: 15000 });
      // „hat es auf ihrem Tablet offen“: die lokale Kopie liegt auf dem Gerät (Voraussetzung für Auflage 10a)
      await expect.poll(() => localCopyIds(page), { timeout: 30000 }).toContain(CUP);

      // @HE-087: Betreiber trägt aus → nach dem Neuladen nicht mehr da, auch nicht als lokale Kopie
      await removeCoAdmin(CUP, userId);
      await page.goto('/#/');
      await page.reload();
      await expect(page.locator('[data-testid="section-draft"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator(card(CUP))).toHaveCount(0);
      await expect(page.locator('[data-testid="section-upcoming"]')).toHaveCount(0);
      expect(await localCopyIds(page)).toContain(CUP); // ausgeblendet, nicht gelöscht
      // nichts hochgeladen: Turnier gehört weiter Olli, Titel unverändert, nicht gelöscht
      expect(await cupRow()).toEqual(before);
    } finally {
      const id = userId;
      if (id !== null) {
        await safeCleanup('Mitgliedschaften entfernen', async () => { await removeCoAdmin(CUP, id); await removeCoAdmin(DRAFT, id); });
        await safeCleanup('Konto löschen', async () => { await rest(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }); });
      }
      await context.close();
    }
  });

  test('Gegenbeispiel Eigentümer: Karte ohne Marke, beim Entwurf wird „Löschen“ angeboten', async ({ asRole }) => {
    const page = await asRole('owner');
    await page.goto('/#/');
    await openSection(page, 'draft');
    const draftCard = page.locator(card(DRAFT));
    await expect(draftCard).toBeVisible({ timeout: 15000 });
    await expect(draftCard.locator(`[data-testid="tournament-role-${DRAFT}"]`)).toHaveCount(0);
    await page.locator(`[data-testid="tournament-${DRAFT}-actions-trigger"]`).click();
    await expect(page.locator('[data-testid="action-menu-item-delete"]')).toBeVisible();
  });

  test('Gegenbeispiel Fremder: ein öffentliches fremdes Turnier steht nicht auf seiner Startseite', async ({ asRole }) => {
    const page = await asRole('stranger');
    await page.goto('/#/');
    await expect(page.locator('[data-testid="auth-avatar-button"]')).toBeVisible({ timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await expect(page.locator(card(E2E_PUBLIC_CUP_ID))).toHaveCount(0);
  });
});
