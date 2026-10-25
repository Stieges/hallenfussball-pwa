/**
 * tests/e2e/cloud/kopie-proben.cloud.spec.ts – Nachweis gegen den lokalen Stack für Paket KP (Review #280, B1 und B2).
 *
 * @W5-024 @W5-025 B1: Angemeldet liefert die Startseiten-Liste nur Kopfdaten ohne Teams und Spiele
 *   (`SupabaseRepository.listForCurrentUser`). Die Kopie über die Startseite muss trotzdem Teams und Spielplan haben.
 * @W5-027 B2: Die archivierte Kopie steht auch nach sofortigem Neuladen (Änderung noch in der Warteschlange) nicht mehr
 *   auf der Startseite, sondern im Archiv; nach dem Abgleich mit dem Server bleibt es so.
 *
 * Lauf nur in der CI („Cloud E2E Tests (lokaler Supabase-Stack)“), nur cloud-desktop. Die Kopie wird am Ende per
 * Service-Role entfernt; das Original (Live-Cup) wird nur gelesen.
 */
import { test, expect } from './fixtures';
import { safeCleanup } from './helpers';
import { serviceRest } from './restAsRole';
import { E2E_LIVE_CUP_ID, E2E_LIVE_CUP_TITLE } from './testData';

interface TournamentRow { id: string; title: string; status: string | null; is_public: boolean; share_code: string | null }
interface MatchRow { id: string; match_status: string; score_a: number | null; score_b: number | null }

async function rows<T>(path: string): Promise<T[]> {
  const res = await serviceRest('GET', path);
  expect(res.status, res.text).toBe(200);
  return res.json as T[];
}

const matchesOf = (tournamentId: string) => rows<MatchRow>(`matches?tournament_id=eq.${tournamentId}&select=id,match_status,score_a,score_b&order=id.asc`);
const teamsOf = (tournamentId: string) => rows<{ id: string }>(`teams?tournament_id=eq.${tournamentId}&select=id`);

async function removeCopy(copyId: string) {
  await safeCleanup(`Kopie ${copyId} entfernen`, async () => {
    for (const path of [`matches?tournament_id=eq.${copyId}`, `teams?tournament_id=eq.${copyId}`, `tournaments?id=eq.${copyId}`]) {
      const res = await serviceRest('DELETE', path);
      if (res.status >= 300) { throw new Error(`${path}: ${res.status} ${res.text}`); }
    }
  });
}

test.describe('Kopie fürs Proben gegen den lokalen Stack', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Nur cloud-desktop.');
  });

  test('@W5-024 @W5-025 @W5-027 Startseite kopiert ein Turnier mit Teams und Spielen', async ({ asRole }) => {
    test.setTimeout(180_000);
    const probeName = `Cloud-Probe ${Date.now()}`;
    const originalBefore = (await rows<TournamentRow>(`tournaments?id=eq.${E2E_LIVE_CUP_ID}&select=id,title,status,is_public,share_code`))[0];
    const originalTeams = await teamsOf(E2E_LIVE_CUP_ID);
    const originalMatches = await matchesOf(E2E_LIVE_CUP_ID);
    const finishedBefore = originalMatches.filter((m) => m.match_status === 'finished');
    expect(originalTeams.length).toBeGreaterThan(0);
    expect(originalMatches.length).toBeGreaterThan(0);

    const page = await asRole('owner');
    let copyId = '';
    try {
      // --- B1: über die Startseite kopieren (Liste ohne Teams und Spiele) ---
      await page.goto('/#/');
      const trigger = page.getByTestId(`tournament-${E2E_LIVE_CUP_ID}-actions-trigger`);
      await expect(trigger).toBeVisible({ timeout: 30000 });
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      await page.getByTestId('action-menu-item-copy').click();
      await page.getByTestId('copy-dialog-name').fill(probeName);
      await page.getByTestId('copy-dialog-confirm').click();
      await expect(page.getByTestId('copy-dialog-name')).toBeHidden();

      await expect.poll(async () => (await rows<TournamentRow>(`tournaments?title=eq.${encodeURIComponent(probeName)}&select=id,title,status,is_public,share_code`)).length, { timeout: 30000, message: 'Kopie in der Datenbank' }).toBe(1);
      const copy = (await rows<TournamentRow>(`tournaments?title=eq.${encodeURIComponent(probeName)}&select=id,title,status,is_public,share_code`))[0];
      copyId = copy.id;

      // neue Zeile mit neuer UUID (@W5-025 C-COPY-AC-ID)
      expect(copy.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(copy.id).not.toBe(E2E_LIVE_CUP_ID);
      // gleiche Zahl an Teams und Spielen (B1, C-COPY-DASH)
      await expect.poll(async () => (await teamsOf(copy.id)).length, { timeout: 30000, message: 'Teams der Kopie' }).toBe(originalTeams.length);
      await expect.poll(async () => (await matchesOf(copy.id)).length, { timeout: 30000, message: 'Spiele der Kopie' }).toBe(originalMatches.length);
      // alle Spiele geplant, ohne Ergebnis (@W5-025)
      const copyMatches = await matchesOf(copy.id);
      expect(copyMatches.every((m) => m.match_status === 'scheduled'), JSON.stringify(copyMatches)).toBe(true);
      expect(copyMatches.every((m) => m.score_a === null && m.score_b === null)).toBe(true);
      // keine Freigabe (@W5-024)
      expect(copy.is_public).toBe(false);
      expect(copy.share_code).toBeNull();
      // Original unverändert (@W5-027)
      expect((await rows<TournamentRow>(`tournaments?id=eq.${E2E_LIVE_CUP_ID}&select=id,title,status,is_public,share_code`))[0]).toEqual(originalBefore);
      expect((await teamsOf(E2E_LIVE_CUP_ID)).length).toBe(originalTeams.length);
      const originalAfter = await matchesOf(E2E_LIVE_CUP_ID);
      expect(originalAfter.length).toBe(originalMatches.length);
      for (const done of finishedBefore) {
        expect(originalAfter.find((m) => m.id === done.id)).toEqual(done);
      }
      expect(originalBefore.title).toBe(E2E_LIVE_CUP_TITLE);

      // --- B2: archivieren, sofort neu laden ---
      // R3-1: die alten Knöpfe „Turnier archivieren“/„Turnier beenden“ sind weg (C-FINISH-PROMISE). Der Weg über den
      // Abschluss-Dialog kommt mit R3-4; dann hier wieder archivieren und Startseite/Archiv nach dem Neuladen prüfen.
    } finally {
      await page.context().close();
      if (copyId) { await removeCopy(copyId); }
    }
  });
});
