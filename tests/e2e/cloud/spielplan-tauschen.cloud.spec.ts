/**
 * tests/e2e/cloud/spielplan-tauschen.cloud.spec.ts — Paket G1a, @ZP-100/@ZP-101 im Cloud-Turnier:
 * Olli tauscht im Bearbeiten-Modus zwei geplante Spiele (Desktop: „Tauschen mit …“, Handy: Ziehen am Griff mit echten
 * Touch-Ereignissen). Bis „Speichern“ bleibt die Datenbank unverändert (@ZP-101); danach haben beide Zeilen
 * `scheduled_start` und `field` getauscht, und ein zweites Gerät zeigt den Tausch nach dem Neuladen (@ZP-100).
 * Nach Neuladen und Abfrage-Takt bleibt es dabei (kein Zurückschreiben).
 *
 * Eigene Kopie des Turniertag-Cups (neue Ids, Datum morgen, damit der Server-Wächter kein Vorziehen in die
 * Vergangenheit ablehnt), wird am Ende gelöscht. Nur lokaler Stack (Service-Rolle sperrt gegen Produktion).
 */
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { newRoleContext } from './engineHelpers';
import { deleteCup, svc } from './coadminEinsatz';
import { E2E_TURNIERTAG_CUP_ID } from './testData';
import { neuLaden } from '../helpers/neuLaden';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

interface Zeile { id: string; scheduled_start: string | null; field: number | null; match_number: number | null; match_status: string | null }

function morgen(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Kopie des Turniertag-Cups: Turnier, Mannschaften, Spiele mit neuen Ids; Spiele alle geplant. */
async function kopie(): Promise<string> {
  const [source] = await svc('GET', `/rest/v1/tournaments?id=eq.${E2E_TURNIERTAG_CUP_ID}`);
  if (!source) { throw new Error('Turniertag-Cup fehlt -- npm run test:env:seed.'); }
  const teams = await svc('GET', `/rest/v1/teams?tournament_id=eq.${E2E_TURNIERTAG_CUP_ID}`);
  const matches = await svc('GET', `/rest/v1/matches?tournament_id=eq.${E2E_TURNIERTAG_CUP_ID}`);
  const ids = new Set([String(source.id), ...teams.map((r) => String(r.id)), ...matches.map((r) => String(r.id))].map((i) => i.toLowerCase()));
  const neu = new Map([...ids].map((id) => [id, randomUUID()]));
  const remap = <T,>(rows: T): T => JSON.parse(JSON.stringify(rows).replace(UUID, (hit) => neu.get(hit.toLowerCase()) ?? hit)) as T;
  const { change_revision: _drop, ...row } = remap(source);
  const id = String(row.id);
  await svc('POST', '/rest/v1/tournaments', [{
    ...row, title: `G1a Tausch ${randomUUID().slice(0, 6)}`, date: morgen(), is_public: false, share_code: null,
    share_code_created_at: null, version: 1, deleted_at: null,
  }]);
  try {
    await svc('POST', '/rest/v1/teams', remap(teams));
    await svc('POST', '/rest/v1/matches', remap(matches).map((m) => ({
      ...m, match_status: 'scheduled', score_a: null, score_b: null, live_state: null, original_start: null,
    })));
  } catch (error) {
    await deleteCup(id);
    throw error;
  }
  return id;
}

async function zeilen(tournamentId: string): Promise<Zeile[]> {
  return (await svc('GET', `/rest/v1/matches?tournament_id=eq.${tournamentId}&select=id,scheduled_start,field,match_number,match_status&order=match_number`)) as unknown as Zeile[];
}

/** Ziehen am Griff mit echten Touch-Ereignissen (CDP), wie am Handy */
async function ziehe(page: Page, vonNr: number, aufNr: number): Promise<void> {
  // Karten im Bearbeiten-Modus tragen ihre Spielnummer (Handy- und Desktop-Karte), der Griff liegt in der Karte
  const karte = (nr: number) => page.locator(`.group-stage-schedule [data-match-number="${nr}"]`).filter({ visible: true }).first();
  await karte(aufNr).evaluate((el) => el.scrollIntoView({ block: 'start' }));
  const griff = karte(vonNr).getByLabel('Ziehen zum Verschieben', { exact: true });
  await expect(griff).toHaveCSS('touch-action', 'none');
  const von = (await griff.boundingBox())!;
  const ziel = (await karte(aufNr).boundingBox())!;
  const start = { x: von.x + von.width / 2, y: von.y + von.height / 2 };
  const endY = ziel.y + ziel.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const punkt = (x: number, y: number) => [{ x, y, radiusX: 5, radiusY: 5, force: 1, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punkt(start.x, start.y) });
  for (let i = 1; i <= 20; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punkt(start.x, start.y + ((endY - start.y) * i) / 20) });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(150);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('G1a: Tausch im Cloud-Turnier erst mit „Speichern“', () => {
  test('@ZP-100 @ZP-101 Spiel tauschen: bis „Speichern“ unverändert, danach scheduled_start und field getauscht, zweites Gerät sieht es', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const handy = testInfo.project.name === 'cloud-mobile';
    const tournamentId = await kopie();
    const olli = await newRoleContext(browser, 'owner');
    const zweites = await newRoleContext(browser, 'owner');
    try {
      const vorher = await zeilen(tournamentId);
      // zwei geplante Spiele zu verschiedenen Zeiten, nah beieinander (am Handy beide im Bild): Spiel 3 und das nächste
      // Spiel mit anderer Anstoßzeit
      const a = vorher[2];
      const b = vorher.slice(3).find((z) => z.scheduled_start !== a.scheduled_start)!;
      expect(b).toBeDefined();

      const page = olli.page;
      await page.goto(`/#/tournament/${tournamentId}/schedule`);
      await page.getByTestId('schedule-edit-start').click();
      if (handy) {
        await ziehe(page, b.match_number!, a.match_number!);
      } else {
        await page.getByTestId(`swap-with-${b.id}`).filter({ visible: true }).first().click();
        await page.getByTestId('swap-with-select').selectOption(a.id);
        await page.getByTestId('confirm-dialog-confirm').click();
      }
      await expect(page.getByText(`Spiele ${b.match_number} und ${a.match_number} getauscht`)).toBeVisible();
      await expect(page.getByTestId('schedule-unsaved-count')).toHaveText('1 Änderung nicht gespeichert');

      // @ZP-101: nichts übertragen, solange nicht gespeichert
      await page.waitForTimeout(3000);
      expect(await zeilen(tournamentId)).toEqual(vorher);

      await page.getByTestId('schedule-edit-save').click();
      // @ZP-105: gefragt wird nur, wenn der Tausch selbst einen Konflikt auslöst (im Turniertag-Cup über zwei Felder
      // möglich, CI-Lauf 41337087128: Dialog blieb offen, DB unverändert) – dann bewusst „Trotzdem speichern“
      const konflikt = page.getByRole('dialog').filter({ hasText: 'Konflikte gefunden' });
      await expect(page.getByTestId('schedule-edit-start').or(konflikt)).toBeVisible();
      if (await konflikt.isVisible()) { await konflikt.getByTestId('confirm-dialog-confirm').click(); }
      await expect(page.getByTestId('schedule-edit-start')).toBeVisible();
      const getauscht = (z: Zeile[]) => {
        const [na, nb] = [z.find((r) => r.id === a.id)!, z.find((r) => r.id === b.id)!];
        return [na.scheduled_start, na.field, nb.scheduled_start, nb.field];
      };
      await expect.poll(async () => getauscht(await zeilen(tournamentId)), { timeout: 15000 })
        .toEqual([b.scheduled_start, b.field, a.scheduled_start, a.field]);

      // zweites Gerät nach dem Neuladen; danach Neuladen + Abfrage-Takt: bleibt getauscht
      await zweites.page.goto(`/#/tournament/${tournamentId}/schedule`);
      const zeit = (z: string | null) => (z ?? '').slice(0, 5);
      const karteB = zweites.page.locator(`.group-stage-schedule [aria-label^="Spiel ${b.match_number}:"]`).filter({ visible: true }).first();
      await expect(karteB).toContainText(zeit(a.scheduled_start), { timeout: 15000 });
      await neuLaden(page);
      await page.waitForTimeout(12000);
      expect(getauscht(await zeilen(tournamentId))).toEqual([b.scheduled_start, b.field, a.scheduled_start, a.field]);
      await expect(page.getByTestId('sync-status-rejected')).toHaveCount(0);
    } finally {
      await olli.context.close();
      await zweites.context.close();
      await deleteCup(tournamentId);
    }
  });
});
