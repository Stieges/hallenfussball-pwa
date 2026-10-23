/**
 * tests/e2e/cloud/spielplan-lesen.cloud.spec.ts — A-08g: der Spielplan des Eigentümers und des Helfers zeigt
 * fremde Tore über die Abfrage, auch wenn die Live-Verbindung zu ist (@FU-087), und übernimmt Änderungen der
 * Co-Admin (@FU-089). Eigentümer-Fall wie im Plan A-08f3 "Ergänzung A-08g": ZUERST der Live-Tab (lädt die
 * Engine-Kopien, H-1), dann der Spielplan. Nur cloud-desktop (Engine-Cups werden verbraucht).
 */
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  appendAsRole,
  engineCupTarget,
  expectEngineMatchRunningUi,
  expectOutboxSettled,
  expectSeededEngineMatch,
  newRoleContext,
  openCockpit,
  type AppendAsRoleEvent,
} from './engineHelpers';
import { enterGoal, fetchMatchRow, vomLiveZumSpielplan } from './helpers';
import { restAsRole, serviceRest } from './restAsRole';
import { E2E_LIVE_CUP_ID, E2E_SPIELPLANOWNER_MONITOR_ID, engineCupIds, type EngineCupSlug } from './testData';

import { abpfiffHalten } from '../helpers/abpfiff';
/** Schließt alle Realtime-Kanäle der App (derselbe Client wie in der App, Vite-Dev-Modul). */
async function closeRealtimeChannels(page: Page): Promise<void> {
  await page.evaluate("import('/src/lib/supabase.ts').then((m) => m.supabase.removeAllChannels())");
  await page.waitForTimeout(1000);
  expect(await page.evaluate("import('/src/lib/supabase.ts').then((m) => m.supabase.getChannels().length)")).toBe(0);
}

async function openLiveThenSchedule(page: Page, slug: EngineCupSlug): Promise<void> {
  const ids = engineCupIds(slug);
  await openCockpit(page, ids.tournamentId, ids.matchId); // Live-Tab zuerst: lädt die Engine-Kopie
  await expectEngineMatchRunningUi(page);
  await vomLiveZumSpielplan(page); // Live-Bereich zeigt nur den schmalen Kopf: „Zurück“ führt zum Spielplan (@SL-140)
  await expect(page.locator(`[data-testid="match-circle-${ids.matchId}"]`)).toContainText('1:0', { timeout: 15000 });
}

function homeGoal(slug: EngineCupSlug, nth: number): AppendAsRoleEvent {
  return { id: randomUUID(), type: 'GOAL', at: Date.now(), section: 1, clockMs: 61000 + nth * 1000, teamId: engineCupIds(slug).homeTeamId, targetId: null, payload: {} };
}

async function tournamentVersion(tournamentId: string): Promise<number> {
  const rows = (await serviceRest('GET', `tournaments?id=eq.${tournamentId}&select=version`)).json as Array<{ version: number | null }>;
  return rows[0].version ?? 1; // Spalte kann NULL sein, zählt wie Version 1
}

test.describe('Spielplan liest fremde Tore', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop.');
  });

  // Merge I1 (Controller-Ruling 16.10., Variante A): @FU-087 verlangt Spielplan und Monitor, nichts zur Tabelle.
  // Die Tabelle zählt das laufende Spiel nach @TM-143 (Daniel 10.10.) NICHT, erst nach dem Abpfiff.
  test('@FU-087 @TM-143 Eigentümer, Kanal zu: Helfer-Tor erscheint in Spielplan und Monitor nach höchstens 10 s, ohne Hinweis; die Tabelle zählt erst nach dem Abpfiff', async ({ browser }) => {
    test.setTimeout(120_000);
    const ids = engineCupIds('SPIELPLANOWNER');
    await expectSeededEngineMatch(engineCupTarget('SPIELPLANOWNER'));
    const owner = await newRoleContext(browser, 'owner');
    const helper = await newRoleContext(browser, 'helper');
    try {
      await openLiveThenSchedule(owner.page, 'SPIELPLANOWNER');
      await closeRealtimeChannels(owner.page);
      await openCockpit(helper.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(helper.page);
      await enterGoal(helper.page, 'home');
      await expectOutboxSettled(helper.page);

      await expect(owner.page.locator(`[data-testid="match-circle-${ids.matchId}"]`)).toContainText('2:0', { timeout: 10000 });
      await expect(owner.page.locator('[data-testid="realtime-interrupted-hint"]')).toHaveCount(0);

      // @FU-087: auch der Monitor zeigt 2:0, solange das Spiel läuft, ohne Hinweis.
      // B-06: der Verwaltungs-Reiter „Monitor“ (alte Groß-Anzeige) entfiel (Daniel 10.10.); gleichwertig ist die
      // Monitor-Seite des Turniers, die der Eigentümer im selben Browser öffnet.
      const monitorPage = await owner.context.newPage();
      await monitorPage.goto(`/#/display/${ids.tournamentId}/${E2E_SPIELPLANOWNER_MONITOR_ID}`);
      await expect(monitorPage.locator('[data-testid="live-block-home"]')).toContainText('2', { timeout: 10000 });
      await expect(monitorPage.locator('[data-testid="live-block-away"]')).toContainText('0');
      await expect(monitorPage.locator('[data-testid="realtime-interrupted-hint"]')).toHaveCount(0);
      await monitorPage.close();

      // @TM-143 Gegenbeispiel: während das Spiel läuft, zählt es in der Tabelle nicht (0 Tore, kein 2:0).
      await owner.page.locator('[data-testid="desktop-tab-tabellen"]').click();
      await owner.page.getByText('Gesamtplatzierung').first().click();
      const homeRow = owner.page.getByRole('row').filter({ hasText: ids.homeTeamName });
      await expect(homeRow).toContainText('0:0', { timeout: 10000 });
      await expect(homeRow).not.toContainText('2:0');

      // @TM-143: nach dem Abpfiff zählt es (2:0 in der Tabelle des Eigentümers, Kanal weiter zu).
      await abpfiffHalten(helper.page);
      await expect.poll(() => fetchMatchRow(ids.matchId).then((row) => row.match_status), { timeout: 10000 }).toBe('finished');
      await expect(homeRow).toContainText('2:0', { timeout: 10000 });
      await expect(owner.page.locator('[data-testid="realtime-interrupted-hint"]')).toHaveCount(0);
    } finally {
      await owner.context.close();
      await helper.context.close();
    }
  });

  test('@FU-087 Eigentümer, Kanal offen: Helfer-Tor erscheint im Spielplan nach höchstens 3 s', async ({ browser }) => {
    // A-08f3b2 (C-SPIELPLAN-PUSH-KANAL-OFFEN behoben): die Bindung auf `tournaments` (nicht in der Publikation)
    // liess den Server den ganzen Kanal ablehnen, der Kanal blieb trotzdem "joined" -- kein Push, keine Abfrage.
    test.setTimeout(90_000);
    const ids = engineCupIds('SPIELPLANKANAL');
    await expectSeededEngineMatch(engineCupTarget('SPIELPLANKANAL'));
    const owner = await newRoleContext(browser, 'owner');
    const helper = await newRoleContext(browser, 'helper');
    try {
      await openLiveThenSchedule(owner.page, 'SPIELPLANKANAL');
      await owner.page.waitForTimeout(2000); // Kanal aufgebaut
      expect(await owner.page.evaluate("import('/src/lib/supabase.ts').then((m) => m.supabase.getChannels().length)")).toBeGreaterThan(0);
      await openCockpit(helper.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(helper.page);
      await enterGoal(helper.page, 'home');
      await expectOutboxSettled(helper.page); // ab hier hat der Server das Tor; die 3 s zählen ab dann
      await expect(owner.page.locator(`[data-testid="match-circle-${ids.matchId}"]`)).toContainText('2:0', { timeout: 3000 });
    } finally {
      await owner.context.close();
      await helper.context.close();
    }
  });

  test('@FU-087 Helfer-Fall: 10 Tore nacheinander, der Spielplan des Helfers bleibt nie stehen, tournaments.version bleibt <= 3', async ({ browser }) => {
    test.setTimeout(240_000);
    const ids = engineCupIds('SPIELPLANHELFER');
    await expectSeededEngineMatch(engineCupTarget('SPIELPLANHELFER'));
    const viewer = await newRoleContext(browser, 'helper');
    try {
      await openLiveThenSchedule(viewer.page, 'SPIELPLANHELFER');
      await closeRealtimeChannels(viewer.page);
      const circle = viewer.page.locator(`[data-testid="match-circle-${ids.matchId}"]`);
      for (let k = 1; k <= 10; k++) {
        const answer = await appendAsRole('helper', ids.matchId, [homeGoal('SPIELPLANHELFER', k)]);
        expect(answer.results[0].status).toBe('accepted');
        await expect(circle, `Tor ${k}`).toContainText(`${1 + k}:0`, { timeout: 10000 });
      }
      expect(await tournamentVersion(ids.tournamentId)).toBeLessThanOrEqual(3);
      await expect(viewer.page.locator('[data-testid="realtime-interrupted-hint"]')).toHaveCount(0);
    } finally {
      await viewer.context.close();
    }
  });

  // A-10: beide @FU-089-Fälle ändern Spiel 5 und setzen es im finally zurück -- nacheinander im selben Worker, sonst
  // überschreibt das Zurücksetzen des einen die Änderung des anderen (fullyParallel).
  test.describe('@FU-089 Anstoßzeit Spiel 5', () => {
    test.describe.configure({ mode: 'default' });

    test('@FU-089 Eine Änderung der Co-Admin erscheint nach einer eigenen Änderung des Eigentümers nach höchstens 10 s', async ({ browser }) => {
      test.setTimeout(120_000);
      // Stand-in: die Oberfläche kennt keinen Absetz-Einstieg (B-12) und keine Anstoßzeit-Eingabe im Spielplan. Die eigene
      // Änderung des Eigentümers ist eine gespeicherte Metadaten-Änderung (Ort). Die Änderung der Co-Admin geht mit ihrem
      // Schlüssel an die Spalte der Anstoßzeit und erhöht die Turnier-Version wie das Voll-Speichern der App
      // (`SupabaseRepository.save`: CAS auf `version`, dann +1) -- A-08f3e4c1c2 Fixrunde 1 (M-1/F-a).
      const matches = (await serviceRest('GET', `matches?tournament_id=eq.${E2E_LIVE_CUP_ID}&order=slot.asc,field.asc,id.asc&select=id,scheduled_start`)).json as Array<{ id: string; scheduled_start: string }>;
      const spiel5 = matches[4];
      const [{ location_name: originalLocation }] = (await serviceRest('GET', `tournaments?id=eq.${E2E_LIVE_CUP_ID}&select=location_name`)).json as Array<{ location_name: string }>;
      const owner = await newRoleContext(browser, 'owner');
      try {
        await owner.page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/settings`);
        await owner.page.waitForLoadState('networkidle');
        await owner.page.getByText('Metadaten bearbeiten').click();
        await owner.page.locator('input[type="text"]').nth(3).fill('Halle Zwei');
        await owner.page.getByRole('button', { name: 'Speichern' }).click();
        await expect.poll(async () => ((await serviceRest('GET', `tournaments?id=eq.${E2E_LIVE_CUP_ID}&select=location_name`)).json as Array<{ location_name: string }>)[0].location_name, {
          message: 'eigene Änderung des Eigentümers gespeichert',
          timeout: 10000,
        }).toBe('Halle Zwei');

        await owner.page.locator('[data-testid="desktop-tab-spielplan"]').click();
        await expect(owner.page.getByText('14:10').first()).toBeVisible({ timeout: 15000 });
        const res = await restAsRole('coadmin', 'PATCH', `matches?id=eq.${spiel5.id}`, { scheduled_start: '14:40:00' });
        expect(res.status, res.text).toBeLessThan(300);
        const version = await tournamentVersion(E2E_LIVE_CUP_ID);
        const bump = await restAsRole('coadmin', 'PATCH', `tournaments?id=eq.${E2E_LIVE_CUP_ID}&version=eq.${version}`, { version: version + 1 });
        expect(bump.status, bump.text).toBeLessThan(300);
        expect(bump.json, 'CAS der Co-Admin trifft genau eine Zeile').toHaveLength(1);
        await expect(owner.page.getByText('14:40').first()).toBeVisible({ timeout: 10000 });
      } finally {
        await serviceRest('PATCH', `matches?id=eq.${spiel5.id}`, { scheduled_start: spiel5.scheduled_start });
        await serviceRest('PATCH', `tournaments?id=eq.${E2E_LIVE_CUP_ID}`, { location_name: originalLocation });
        await owner.context.close();
      }
    });

    test('@FU-089 Eine Änderung der Co-Admin OHNE Versions-CAS erscheint beim Eigentümer nach höchstens 10 s', async ({ browser }) => {
      // A-10 Teil C (C-SLOT-UPDATE-OHNE-VERSION, Rest): die Co-Admin ändert nur die Anstoßzeit von Spiel 5 (wie die
      // Warteschlange per `updateMatches` ohne `baseVersion`), die Turnier-Version bleibt. Der Server zählt die Änderung in
      // `tournaments.change_revision`; Ollis Gerät übernimmt deshalb beim nächsten Takt die ganze Kopie.
      // Setzt 20261028_005 im lokalen Stack voraus (ohne die Migration: rot, 14:40 erscheint nie).
      test.setTimeout(120_000);
      const matches = (await serviceRest('GET', `matches?tournament_id=eq.${E2E_LIVE_CUP_ID}&order=slot.asc,field.asc,id.asc&select=id,scheduled_start`)).json as Array<{ id: string; scheduled_start: string }>;
      const spiel5 = matches[4];
      const owner = await newRoleContext(browser, 'owner');
      try {
        await owner.page.goto(`/#/tournament/${E2E_LIVE_CUP_ID}/schedule`);
        await owner.page.waitForLoadState('networkidle');
        await expect(owner.page.getByText('14:10').first()).toBeVisible({ timeout: 15000 });
        await expect(owner.page.getByText('14:40')).toHaveCount(0);
        const versionBefore = await tournamentVersion(E2E_LIVE_CUP_ID);
        const res = await restAsRole('coadmin', 'PATCH', `matches?id=eq.${spiel5.id}`, { scheduled_start: '14:40:00' });
        expect(res.status, res.text).toBeLessThan(300);
        expect(await tournamentVersion(E2E_LIVE_CUP_ID), 'kein Versions-CAS: Turnier-Version unverändert').toBe(versionBefore);
        await expect(owner.page.getByText('14:40').first()).toBeVisible({ timeout: 10000 });
      } finally {
        await serviceRest('PATCH', `matches?id=eq.${spiel5.id}`, { scheduled_start: spiel5.scheduled_start });
        await owner.context.close();
      }
    });
  });
});
