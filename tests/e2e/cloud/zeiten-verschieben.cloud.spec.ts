/**
 * tests/e2e/cloud/zeiten-verschieben.cloud.spec.ts — Befund C-ZEITVERSCHIEBUNG-NICHT-IN-CLOUD, Record
 * docs/anforderungen/2026-10-02_zeitplan-rueckt-nach.md: „Zeiten verschieben“ muss über die ECHTE Server-Antwort bei den
 * Zuschauern ankommen (@ZM-180-Prinzip), nicht nur auf dem Gerät der Turnierleitung.
 *
 * - Vor dem ersten Anpfiff (@ZP-089, @ZP-019, @ZP-091): Olli zieht ab Spiel 1 um 15 Minuten vor und übernimmt ohne
 *   Vorschau-Stufe. Danach steht in der Datenbank jede Anstoßzeit 15 Minuten früher, `original_start` bleibt leer
 *   (Planung, Spiel 1 liegt mehr als 30 Minuten entfernt), und die offene Zuschauer-Seite zeigt die neue Uhrzeit ohne
 *   „(war …)“ ohne Neuladen.
 * - Nach dem ersten Anpfiff (@ZP-004, @ZP-017): Spiel 1 läuft (Anpfiff über den Server), Olli verschiebt ab dem nächsten
 *   geplanten Spiel um 10 Minuten nach hinten mit Vorschau und Bestätigung. Danach tragen die verschobenen Spiele in der
 *   Datenbank `original_start` = alte Anstoßzeit, und die Zuschauer-Seite zeigt groß die neue Uhrzeit und klein
 *   „(war hh:mm)“.
 *
 * Eigene Kopie des Turniertag-Cups (neue Ids, Datum morgen: der Server-Wächter prüft „Vergangenheit“ nur am Turniertag),
 * öffentlich mit eigenem Code, am Ende gelöscht. Nur lokaler Stack (Service-Rolle sperrt gegen Produktion).
 */
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { appendAsRole, newRoleContext } from './engineHelpers';
import { deleteCup, svc } from './coadminEinsatz';
import { E2E_TURNIERTAG_CUP_ID } from './testData';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface Zeile { id: string; scheduled_start: string | null; original_start: string | null; match_number: number | null; field: number | null }

function morgen(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shareCode(): string {
  return Array.from({ length: 6 }, () => CODE_ZEICHEN[Math.floor(Math.random() * CODE_ZEICHEN.length)]).join('');
}

/** „hh:mm:ss“ ± Minuten als „hh:mm:ss“ (innerhalb eines Tages). */
function plus(zeit: string, minuten: number): string {
  const [h, m] = zeit.split(':').map(Number);
  const t = h * 60 + m + minuten;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00`;
}

/** Kopie des Turniertag-Cups: alle Spiele geplant, nie verschoben, öffentlich mit eigenem Code. */
async function kopie(label: string): Promise<{ id: string; code: string }> {
  const [source] = await svc('GET', `/rest/v1/tournaments?id=eq.${E2E_TURNIERTAG_CUP_ID}`);
  if (!source) { throw new Error('Turniertag-Cup fehlt -- npm run test:env:seed.'); }
  const teams = await svc('GET', `/rest/v1/teams?tournament_id=eq.${E2E_TURNIERTAG_CUP_ID}`);
  const matches = await svc('GET', `/rest/v1/matches?tournament_id=eq.${E2E_TURNIERTAG_CUP_ID}`);
  const ids = new Set([String(source.id), ...teams.map((r) => String(r.id)), ...matches.map((r) => String(r.id))].map((i) => i.toLowerCase()));
  const neu = new Map([...ids].map((id) => [id, randomUUID()]));
  const remap = <T,>(rows: T): T => JSON.parse(JSON.stringify(rows).replace(UUID, (hit) => neu.get(hit.toLowerCase()) ?? hit)) as T;
  const { change_revision: _drop, ...row } = remap(source);
  const id = String(row.id);
  const code = shareCode();
  await svc('POST', '/rest/v1/tournaments', [{
    ...row, title: `Zeiten ${label} ${randomUUID().slice(0, 6)}`, date: morgen(), is_public: true, share_code: code,
    share_code_created_at: new Date().toISOString(), version: 1, deleted_at: null,
  }]);
  try {
    await svc('POST', '/rest/v1/teams', remap(teams));
    await svc('POST', '/rest/v1/matches', remap(matches).map((m) => ({
      ...m, match_status: 'scheduled', score_a: null, score_b: null, live_state: null, original_start: null, actual_start: null,
    })));
  } catch (error) {
    await deleteCup(id);
    throw error;
  }
  return { id, code };
}

async function zeilen(tournamentId: string): Promise<Zeile[]> {
  return (await svc('GET', `/rest/v1/matches?tournament_id=eq.${tournamentId}&select=id,scheduled_start,original_start,match_number,field&order=match_number`)) as unknown as Zeile[];
}

/** Zeitzelle eines Spiels auf der Zuschauer-Seite: groß die Uhrzeit, klein ggf. „(war …)“ (Testkennung je Spiel). */
async function zuschauerZeile(page: Page, matchNumber: number) {
  const zeile = page.locator(`[aria-label^="Spiel ${matchNumber}:"]`).filter({ visible: true }).first();
  await zeile.scrollIntoViewIfNeeded();
  return zeile;
}

test.describe('Zeiten verschieben kommt über den Server bei den Zuschauern an (C-ZEITVERSCHIEBUNG-NICHT-IN-CLOUD)', () => {
  test('@ZP-089 @ZP-019 @ZP-091 vor dem ersten Anpfiff 15 Minuten vorziehen: Datenbank und offene Zuschauer-Seite ohne „(war …)“', async ({ browser }) => {
    test.setTimeout(120_000);
    const { id, code } = await kopie('vorher');
    const olli = await newRoleContext(browser, 'owner');
    const petraKontext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const vorher = await zeilen(id);
      const spiel1 = vorher[0];
      const petra = await petraKontext.newPage();
      await petra.goto(`/#/live/${code}`);
      await expect(await zuschauerZeile(petra, 1), 'Zuschauer-Seite vorher').toContainText(spiel1.scheduled_start!.slice(0, 5));

      const page = olli.page;
      await page.goto(`/#/tournament/${id}/schedule`);
      await page.getByTestId('schedule-shift-button').click();
      await page.getByTestId('time-shift-mode-match').click();
      await page.getByTestId('time-shift-from-match').selectOption(spiel1.id);
      await page.getByTestId('time-shift-direction-earlier').click();
      await page.getByTestId('time-shift-quick-15').click();
      const weiter = page.getByTestId('time-shift-proceed');
      await expect(weiter, 'vor dem ersten Anpfiff ohne Vorschau-Stufe (@ZP-019)').toHaveText(/Übernehmen/);
      await weiter.click();
      await expect(page.getByTestId('time-shift-strip')).toBeVisible();

      // Echte Server-Antwort: jede Anstoßzeit 15 Minuten früher, original_start leer (Planung, @ZP-049/@ZP-091)
      await expect.poll(async () => (await zeilen(id)).map((z) => [z.scheduled_start, z.original_start]), {
        message: 'die Verschiebung steht in der Datenbank', timeout: 20_000,
      }).toEqual(vorher.map((z) => [plus(z.scheduled_start!, -15), null]));

      // Zuschauer-Seite ohne Neuladen (@ZP-090: innerhalb von 10 Sekunden), ohne „(war …)“ (@ZP-091)
      const zeile = await zuschauerZeile(petra, 1);
      await expect(zeile, 'Zuschauer-Seite: neue Uhrzeit von Spiel 1').toContainText(plus(spiel1.scheduled_start!, -15).slice(0, 5), { timeout: 10_000 });
      await expect(petra.locator('[data-testid^="match-original-"]'), 'kein „(war …)“ bei Planung').toHaveCount(0);
    } finally {
      await olli.context.close();
      await petraKontext.close();
      await deleteCup(id);
    }
  });

  test('@ZP-004 @ZP-017 nach dem ersten Anpfiff 10 Minuten nach hinten: original_start in der Datenbank, Zuschauer-Seite „(war …)“', async ({ browser }) => {
    test.setTimeout(150_000);
    const { id, code } = await kopie('nachher');
    const olli = await newRoleContext(browser, 'owner');
    const petraKontext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      const vorher = await zeilen(id);
      const spiel1 = vorher[0];
      // Spiel 1 wird über den Server angepfiffen (append_match_events als Turnierleitung)
      const start = await appendAsRole('owner', spiel1.id, [{
        id: randomUUID(), type: 'MATCH_START', at: Date.now(), section: 1, clockMs: 0, teamId: null, targetId: null, payload: {},
      }], { feldFreigeben: true });
      expect(start.results.map((r) => r.status)).toEqual(['accepted']);

      const page = olli.page;
      await page.goto(`/#/tournament/${id}/schedule`);
      // Die Turnierleitung sieht das laufende Spiel (Stand aus der Cloud), sonst gälte „vor dem ersten Anpfiff“
      await expect(page.getByTestId('schedule-shift-button')).toBeVisible();
      await page.getByTestId('schedule-shift-button').click();
      const weiter = page.getByTestId('time-shift-proceed');
      await expect(weiter, 'ab dem ersten Anpfiff mit Vorschau (@ZP-017)').toHaveText(/Vorschau/, { timeout: 15_000 });
      await weiter.click();
      await expect(page.getByTestId('time-shift-preview')).toContainText('Noch nichts geändert');
      await page.getByTestId('time-shift-confirm').click();
      await expect(page.getByTestId('time-shift-strip')).toContainText('Zeiten um 10 Minuten verschoben');

      // Echte Server-Antwort: verschobene Spiele tragen original_start = alte Anstoßzeit, das laufende Spiel bleibt
      await expect.poll(async () => (await zeilen(id)).filter((z) => z.original_start !== null).length, {
        message: 'die Verschiebung steht in der Datenbank (matches.original_start)', timeout: 20_000,
      }).toBeGreaterThan(0);
      const nachher = await zeilen(id);
      const alt = new Map(vorher.map((z) => [z.id, z.scheduled_start]));
      const verschoben = nachher.filter((z) => z.original_start !== null);
      for (const z of verschoben) {
        expect(z.original_start, `Spiel ${z.match_number}: original_start = alte Anstoßzeit`).toBe(alt.get(z.id));
        expect(z.scheduled_start, `Spiel ${z.match_number}: 10 Minuten später`).toBe(plus(alt.get(z.id)!, 10));
      }
      expect(nachher[0].scheduled_start, 'das laufende Spiel 1 behält seine Uhrzeit').toBe(spiel1.scheduled_start);
      expect(nachher[0].original_start).toBeNull();

      // Zuschauer-Seite (frisch geöffnet, Stand des Servers): groß die neue Uhrzeit, klein „(war hh:mm)“
      const petra = await petraKontext.newPage();
      await petra.goto(`/#/live/${code}`);
      const erstes = verschoben[0];
      const zeile = await zuschauerZeile(petra, erstes.match_number!);
      await expect(zeile).toContainText(erstes.scheduled_start!.slice(0, 5));
      await expect(zeile.getByTestId(`match-original-${erstes.id}`)).toHaveText(`(war ${erstes.original_start!.slice(0, 5)})`);
    } finally {
      await olli.context.close();
      await petraKontext.close();
      await deleteCup(id);
    }
  });

  test('@ZP-004 Neuladen direkt nach dem Bestätigen: die Verschiebung kommt trotzdem in der Datenbank an', async ({ browser }) => {
    test.setTimeout(150_000);
    const { id } = await kopie('neuladen');
    const olli = await newRoleContext(browser, 'owner');
    try {
      const vorher = await zeilen(id);
      const start = await appendAsRole('owner', vorher[0].id, [{
        id: randomUUID(), type: 'MATCH_START', at: Date.now(), section: 1, clockMs: 0, teamId: null, targetId: null, payload: {},
      }], { feldFreigeben: true });
      expect(start.results.map((r) => r.status)).toEqual(['accepted']);
      const page = olli.page;
      await page.goto(`/#/tournament/${id}/schedule`);
      await page.getByTestId('schedule-shift-button').click();
      const weiter = page.getByTestId('time-shift-proceed');
      await expect(weiter).toHaveText(/Vorschau/, { timeout: 15_000 });
      await weiter.click();
      await page.getByTestId('time-shift-confirm').click();
      await expect(page.getByTestId('time-shift-strip')).toContainText('Zeiten um 10 Minuten verschoben');
      // Neustart, bevor das Speichern beim Server angekommen ist (@FU-007): die Warteschlange sendet aus dem Speicher
      await page.reload();
      await expect.poll(async () => (await zeilen(id)).filter((z) => z.original_start !== null).length, {
        message: 'nach dem Neuladen steht die Verschiebung in der Datenbank (matches.original_start)', timeout: 30_000,
      }).toBeGreaterThan(0);
      const nachher = await zeilen(id);
      const alt = new Map(vorher.map((z) => [z.id, z.scheduled_start]));
      for (const z of nachher.filter((r) => r.original_start !== null)) {
        expect([z.scheduled_start, z.original_start], `Spiel ${z.match_number}`).toEqual([plus(alt.get(z.id)!, 10), alt.get(z.id)]);
      }
      const abgelegt = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mutation_queue_failed_v1') && !k.endsWith(':cloud-copy'))
        .map((k) => `${k}=${(JSON.parse(localStorage.getItem(k) ?? '[]') as unknown[]).length}`));
      process.stdout.write(`\nDIAG-ABGELEGT ${abgelegt.join(' ')}\n`);
    } finally {
      await olli.context.close();
      await deleteCup(id);
    }
  });
});
