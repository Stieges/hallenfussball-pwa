/**
 * tests/e2e/cloud/leibchen.cloud.spec.ts — Leibchen 2b-2 über die ECHTE Server-Antwort (lokaler Stack, Regel „beendet bleibt beendet“:
 * jeder Übertragungsweg zu Monitor und Zuschauer braucht einen Test über den Server). Blau gegen Blau, je Fall ein eigener Cup
 * (`engineCups.ts`: LEIBCHENA/B/C untouched, LEIBCHENLIVE läuft), Feld-Monitor und Zuschauer-Seite mit festem Share-Code.
 *
 * - @SL-206 @SL-202 @ZM-200 @ZM-201 (A): „Bestätigen“ → `match_kit_set` → die Zeile steht auf dem Server (kit_decision bib, Heim) →
 *   nach dem Anpfiff zeigen Hallenmonitor und Zuschauer-Seite die Weste am Heim-Team (und nur dort).
 * - @SL-150 @ZM-153 (B): „Keine Leibchen“ → kit_decision none; Monitor und Zuschauer zeigen keine Weste.
 * - @SL-229 @SL-237 (C): hält ein anderes Gerät das Feld, bedient nur dieses die Wahl – die Karte ist lesend, der Server weist die Wahl
 *   dieses Geräts mit NOT_CONTROLLER (OTHER_DEVICE) ab, die Zeile bleibt unberührt.
 * - @SL-150 @SL-229 (LIVE): im laufenden Spiel trägt die Leitung nach (Mehr → Leibchen nachtragen → Speichern), der Helfer bekommt
 *   LEAD_ONLY und ändert nichts.
 */
import type { BrowserContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import { engineCupTarget, expectEngineMatchRunningUi, expectSeededEngineMatch, fetchUserIdByEmail, newRoleContext, openCockpit } from './engineHelpers';
import { restAsRole, serviceRest } from './restAsRole';
import { E2E_LEIBCHEN_SHARE_CODES, E2E_USERS, engineCupIds, leibchenMonitorId, type LeibchenCupSlug } from './testData';

interface SpielZeile { kit_decision: string | null; bib_side: string | null; match_status: string; team_a_id: string; team_b_id: string }

async function zeile(matchId: string): Promise<SpielZeile> {
  const res = await serviceRest('GET', `matches?id=eq.${matchId}&select=kit_decision,bib_side,match_status,team_a_id,team_b_id`);
  expect(res.status, res.text).toBe(200);
  return (res.json as SpielZeile[])[0];
}

async function monitor(context: BrowserContext, slug: LeibchenCupSlug): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/#/display/${engineCupIds(slug).tournamentId}/${leibchenMonitorId(slug)}`);
  await expect(page.locator('[data-position="home"]').first()).toBeVisible({ timeout: 20_000 });
  return page;
}

async function zuschauer(context: BrowserContext, slug: LeibchenCupSlug): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/#/live/${E2E_LEIBCHEN_SHARE_CODES[slug]}`);
  await expect(page.getByRole('article').first()).toBeVisible({ timeout: 20_000 });
  return page;
}

/** Der Server-Aufruf wie ihn die App schickt, mit dem JWT einer Rolle. */
async function wahlAlsRolle(role: 'owner' | 'helper', matchId: string, z: SpielZeile, extra: { deviceId?: string } = {}): Promise<{ status?: string; code?: string; detail?: { reason?: string } }> {
  const res = await restAsRole(role, 'POST', 'rpc/match_kit_set', {
    p_match_id: matchId, p_decision: 'bib', p_kit: { bibSide: 'b', bibColor: '#FFEB3B', teamA: z.team_a_id, teamB: z.team_b_id },
    p_device_id: extra.deviceId ?? randomUUID(), p_control_epoch: null,
  });
  expect(res.status, res.text).toBe(200);
  return res.json as { status?: string; code?: string; detail?: { reason?: string } };
}

test.describe('Leibchen: Wahl, Server und Anzeige (zwei Kontexte, lokaler Stack)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop (kein gleichzeitiger Mobil-Lauf auf demselben Cup).');
  });

  test('@SL-206 @SL-202 @ZM-200 @ZM-201 Bestätigen: der Server hält die Wahl, nach dem Anpfiff zeigen Monitor und Zuschauer die Weste am Heim-Team', async ({ browser }) => {
    test.setTimeout(150_000);
    const ids = engineCupIds('LEIBCHENA');
    await expectSeededEngineMatch(engineCupTarget('LEIBCHENA'));
    const olli = await newRoleContext(browser, 'owner');
    const halle = await browser.newContext();
    try {
      await openCockpit(olli.page, ids.tournamentId, ids.matchId);
      await olli.page.getByTestId('leibchen-bestaetigen').click({ timeout: 20_000 });
      await expect(olli.page.getByTestId('leibchen-zeile')).toBeVisible();
      await expect.poll(async () => (await zeile(ids.matchId)).kit_decision, { timeout: 20_000, message: 'der Server hat die Wahl gespeichert' }).toBe('bib');
      expect((await zeile(ids.matchId)).bib_side, 'Vorschlag: das Heim-Team zieht das Leibchen').toBe('a');
      await expect(olli.page.getByTestId('leibchen-status')).toHaveAttribute('data-status', 'sent', { timeout: 20_000 });

      await olli.page.getByTestId('match-start-button').click();
      await expectEngineMatchRunningUi(olli.page);

      const feld = await monitor(halle, 'LEIBCHENA');
      await expect(feld.getByTestId('live-box-home-bib')).toBeVisible({ timeout: 20_000 });
      await expect(feld.getByTestId('live-box-away-bib')).toHaveCount(0);
      const tafel = await zuschauer(halle, 'LEIBCHENA');
      await expect(tafel.getByTestId('public-current').getByTestId(/^match-box-.*-home-bib$/)).toBeVisible({ timeout: 25_000 });
      await expect(tafel.getByTestId('public-current').getByTestId(/^match-box-.*-away-bib$/)).toHaveCount(0);
    } finally {
      await olli.context.close();
      await halle.close();
    }
  });

  test('@SL-150 @ZM-153 Keine Leibchen: der Server hält „none“, Monitor und Zuschauer zeigen keine Weste', async ({ browser }) => {
    test.setTimeout(150_000);
    const ids = engineCupIds('LEIBCHENB');
    await expectSeededEngineMatch(engineCupTarget('LEIBCHENB'));
    const olli = await newRoleContext(browser, 'owner');
    const halle = await browser.newContext();
    try {
      await openCockpit(olli.page, ids.tournamentId, ids.matchId);
      await olli.page.getByTestId('leibchen-keine').click({ timeout: 20_000 });
      await expect.poll(async () => (await zeile(ids.matchId)).kit_decision, { timeout: 20_000 }).toBe('none');
      expect((await zeile(ids.matchId)).bib_side).toBeNull();

      await olli.page.getByTestId('match-start-button').click();
      await expectEngineMatchRunningUi(olli.page);

      const feld = await monitor(halle, 'LEIBCHENB');
      await expect(feld.getByTestId('live-box-home-bib')).toHaveCount(0);
      await expect(feld.getByTestId('live-box-away-bib')).toHaveCount(0);
      const tafel = await zuschauer(halle, 'LEIBCHENB');
      await expect(tafel.getByTestId('public-current').getByTestId(/^match-box-.*-bib$/)).toHaveCount(0);
      expect((await zeile(ids.matchId)).kit_decision, 'der Anpfiff überschreibt „Keine Leibchen“ nicht').toBe('none');
    } finally {
      await olli.context.close();
      await halle.close();
    }
  });

  test('@SL-229 @SL-237 anderes Gerät hält das Feld: die Karte ist lesend, der Server weist die Wahl mit NOT_CONTROLLER ab', async ({ browser }) => {
    test.setTimeout(120_000);
    const ids = engineCupIds('LEIBCHENC');
    await expectSeededEngineMatch(engineCupTarget('LEIBCHENC'));
    const fremd = await fetchUserIdByEmail(E2E_USERS.helper.email);
    const feld = await serviceRest('POST', 'field_control', [{
      tournament_id: ids.tournamentId, field: 1, epoch: 1, holder_user_id: fremd, holder_device_id: randomUUID(), holder_device_label: 'Fremdes Gerät',
    }]);
    expect(feld.status, feld.text).toBeLessThan(300);
    const olli = await newRoleContext(browser, 'owner');
    try {
      const vorher = await zeile(ids.matchId);
      await openCockpit(olli.page, ids.tournamentId, ids.matchId);
      await expect(olli.page.getByTestId('leibchen-karte')).toBeVisible({ timeout: 20_000 });
      await expect(olli.page.getByTestId('leibchen-bestaetigen'), 'lesend: keine Wahl-Taste').toHaveCount(0);
      await expect(olli.page.getByTestId('leibchen-nur-lesen')).toBeVisible();

      const antwort = await wahlAlsRolle('owner', ids.matchId, vorher);
      expect(antwort.status).toBe('rejected');
      expect(antwort.code).toBe('NOT_CONTROLLER');
      expect(antwort.detail?.reason).toBe('OTHER_DEVICE');
      expect((await zeile(ids.matchId)).kit_decision, 'die Zeile bleibt unberührt').toBeNull();
    } finally {
      await olli.context.close();
      await serviceRest('DELETE', `field_control?tournament_id=eq.${ids.tournamentId}`);
    }
  });

  test('@SL-150 @SL-229 im laufenden Spiel: die Leitung trägt nach, der Helfer bekommt LEAD_ONLY und ändert nichts', async ({ browser }) => {
    test.setTimeout(150_000);
    const ids = engineCupIds('LEIBCHENLIVE');
    await expectSeededEngineMatch(engineCupTarget('LEIBCHENLIVE'));
    const vorher = await zeile(ids.matchId);
    expect(vorher.match_status).toBe('running');

    const helfer = await wahlAlsRolle('helper', ids.matchId, vorher);
    expect(helfer.status).toBe('rejected');
    expect(helfer.code).toBe('LEAD_ONLY');
    expect((await zeile(ids.matchId)).kit_decision, 'der Helfer ändert nichts').toBe(vorher.kit_decision);

    const olli = await newRoleContext(browser, 'owner');
    const halle = await browser.newContext();
    try {
      await openCockpit(olli.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(olli.page);
      await olli.page.getByTestId('cockpit-more-button').click();
      await olli.page.getByTestId('mehr-leibchen-nachtragen').click();
      await olli.page.getByTestId('nachtrag-team-gast').click();
      await olli.page.locator('[data-testid^="nachtrag-farbe-"]:not([disabled])').first().click();
      await olli.page.getByTestId('nachtrag-speichern').click();
      await expect.poll(async () => (await zeile(ids.matchId)).kit_decision, { timeout: 20_000, message: 'der Server hat den Nachtrag gespeichert' }).toBe('bib');
      expect((await zeile(ids.matchId)).bib_side).toBe('b');

      const feld = await monitor(halle, 'LEIBCHENLIVE');
      await expect(feld.getByTestId('live-box-away-bib')).toBeVisible({ timeout: 25_000 });
      await expect(feld.getByTestId('live-box-home-bib')).toHaveCount(0);
    } finally {
      await olli.context.close();
      await halle.close();
    }
  });
});
