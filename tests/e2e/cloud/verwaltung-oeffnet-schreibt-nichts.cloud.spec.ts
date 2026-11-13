/**
 * Befund C-VERWALTUNG-OEFFNEN-ERZEUGT-SPIELPLAN -- @W5-042 gegen den lokalen Stack. Szenarien: docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md.
 *
 * Aufbau wie im echten Ablauf: Das Turnier steht als Entwurf mit 6 Teams ohne Spiele am Server; dieses „Gerät“ öffnet es einmal
 * (lokale Kopie ohne Spiele, keine wartende Änderung). Danach stellt die Turnierleitung es anderswo fertig (Service-Rolle: 15 Spiele,
 * neuerer Stand). Öffnet das Gerät jetzt die Verwaltung und wartet, zeigt sie den Stand des Servers, am Server ändert sich nichts
 * (Teams, Spiele, Version, `updated_at`), und auf dem Gerät entsteht keine abgelehnte Änderung. Eigenes Wegwerf-Turnier, Aufräumen im `finally`.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, AUTH_DIR } from './fixtures';
import { getLocalServiceRoleClient, safeCleanup } from './helpers';
import { E2E_DRAFT_CUP_ID } from './testData';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../factories/supabase';

/** Die Anforderung nennt 15 Sekunden Wartezeit: länger als das Zeitlimit eines Cloud-Abrufs (8 s) und der Takt des Assistenten-Autosave (10 s), damit jeder späte Schreibversuch auffiele. */
const WARTEZEIT_MS = 15_000;
const TEAM_ANZAHL = 6;
const SPIELE_ANZAHL = 15;

async function rest(pathAndQuery: string, init: RequestInit = {}): Promise<Response> {
  const sr = getLocalServiceRoleClient();
  const response = await fetch(`${sr.url}${pathAndQuery}`, {
    ...init,
    headers: { ...sr.headers, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  if (!response.ok) { throw new Error(`${init.method ?? 'GET'} ${pathAndQuery}: ${response.status} ${await response.text()}`); }
  return response;
}

interface ServerState { teams: number; matches: number; version: number; changeRevision: number; updatedAt: string }

async function serverState(id: string): Promise<ServerState> {
  const teams = (await (await rest(`/rest/v1/teams?tournament_id=eq.${id}&select=id`)).json()) as unknown[];
  const matches = (await (await rest(`/rest/v1/matches?tournament_id=eq.${id}&select=id`)).json()) as unknown[];
  const row = ((await (await rest(`/rest/v1/tournaments?id=eq.${id}&select=updated_at,version,change_revision`)).json()) as Array<{ updated_at: string; version: number; change_revision: number }>)[0];
  return { teams: teams.length, matches: matches.length, version: row.version, changeRevision: row.change_revision, updatedAt: row.updated_at };
}

async function seedDraft(id: string, teamIds: string[]): Promise<void> {
  const owner = ((await (await rest(`/rest/v1/tournaments?id=eq.${E2E_DRAFT_CUP_ID}&select=owner_id`)).json()) as Array<{ owner_id: string }>)[0].owner_id;
  await rest('/rest/v1/tournaments', {
    method: 'POST',
    body: JSON.stringify(createTournamentRow({
      id, owner_id: owner, title: `W5042 ${id.slice(0, 6)}`, status: 'draft', lifecycle_status: 'draft',
      number_of_teams: TEAM_ANZAHL, number_of_groups: 2, number_of_fields: 1, date: '2030-01-01', config: {},
    })),
  });
  for (let i = 0; i < TEAM_ANZAHL; i++) { teamIds.push(randomUUID()); }
  await rest('/rest/v1/teams', {
    method: 'POST',
    body: JSON.stringify(teamIds.map((teamId, index) => createTeamRow({
      id: teamId, tournament_id: id, name: `W5042 Team ${index + 1}`, group_letter: index < 3 ? 'A' : 'B', sort_order: index,
      color_primary: '#e53935', color_secondary: '#ffffff',
    }))),
  });
}

/**
 * Die Turnierleitung stellt das Turnier anderswo fertig: 15 Spiele (jeder gegen jeden) kommen dazu und der Stand am Server wird neuer
 * (Titel, Version +1 wie bei einem Speichern der App; Spiele und Titel allein zählen der Server nicht hoch). Den Zustand „festgelegt“ setzt nur der Server (kein direktes Ändern per Service-Rolle); der Entwurf mit erzeugtem Spielplan
 * ist der Stand, den @W5-042 meint: Server mit 6 Teams und 15 Spielen, die lokale Kopie kennt keine Spiele.
 */
async function completeElsewhere(id: string, teamIds: string[], versionBefore: number): Promise<void> {
  const rows: Array<ReturnType<typeof createMatchRow>> = [];
  for (let a = 0; a < TEAM_ANZAHL; a++) {
    for (let b = a + 1; b < TEAM_ANZAHL; b++) {
      const index = rows.length;
      rows.push(createMatchRow({
        id: randomUUID(), tournament_id: id, round: 1, field: 1, slot: index, group_letter: 'A', match_number: index + 1,
        team_a_id: teamIds[a], team_b_id: teamIds[b], match_status: 'scheduled', phase: 'groupStage',
        scheduled_start: `${String(9 + Math.floor(index / 6)).padStart(2, '0')}:${String((index % 6) * 10).padStart(2, '0')}:00`,
      }));
    }
  }
  expect(rows).toHaveLength(SPIELE_ANZAHL);
  await rest('/rest/v1/matches', { method: 'POST', body: JSON.stringify(rows) });
  await rest(`/rest/v1/tournaments?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ title: `W5042 fertig ${id.slice(0, 6)}`, version: versionBefore + 1 }) }); // wie ein Speichern der App: Version +1
}

async function openCardOfDraft(page: Page, id: string): Promise<void> {
  await page.goto('/#/');
  const card = `[data-testid="tournament-card-${id}"]`;
  const section = page.locator('[data-testid^="section-"]', { has: page.locator(card) });
  const toggle = section.locator('[aria-expanded]').first();
  await expect(toggle).toBeVisible({ timeout: 15000 });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') { await toggle.click(); }
  await page.locator(card).click();
}

test.describe('@W5-042 das Öffnen der Verwaltung ändert nichts am Server und erzeugt keinen Spielplan', () => {
  test.describe.configure({ timeout: 90_000 });

  test('ältere lokale Kopie ohne Spiele, Server mit 6 Teams und 15 Spielen: Verwaltung zeigt den Server, nichts wird geschrieben', async ({ browser }) => {
    const id = randomUUID();
    const teamIds: string[] = [];
    try {
      await seedDraft(id, teamIds);
      const context = await browser.newContext({ storageState: path.join(AUTH_DIR, 'owner.json') });
      const page = await context.newPage();

      // 1. Das Gerät kennt das Turnier als Entwurf ohne Spiele (Öffnen über „Gespeicherte Entwürfe“ legt die lokale Kopie an)
      await openCardOfDraft(page, id);
      await expect(page).toHaveURL(new RegExp(`/tournament/${id}/edit`));
      await expect(page.locator('[aria-current="step"]')).toBeVisible({ timeout: 20_000 });
      await page.goto('/#/');

      // 2. Anderswo wird das Turnier fertiggestellt; der Stand am Server ist jetzt neuer als die Kopie dieses Geräts
      const alt = await serverState(id);
      await completeElsewhere(id, teamIds, alt.version);
      const before = await serverState(id);
      expect(before).toMatchObject({ teams: TEAM_ANZAHL, matches: SPIELE_ANZAHL });
      expect(before.version !== alt.version || before.changeRevision !== alt.changeRevision, 'der Server-Stand ist neuer als die lokale Kopie').toBe(true);

      // 3. Verwaltung öffnen, nichts eingeben, warten
      await page.goto(`/#/tournament/${id}/schedule`);
      await page.waitForTimeout(WARTEZEIT_MS);

      // 4. Sie zeigt den Stand des Servers; am Server ist nichts geändert; keine abgelehnte Änderung auf dem Gerät
      await expect(page.locator('[data-testid="schedule-missing-notice"]')).toHaveCount(0);
      await expect.poll(() => page.locator('[data-match-card]').count(), { timeout: 20_000, message: 'die Verwaltung zeigt die 15 Spiele des Servers' }).toBe(SPIELE_ANZAHL);
      expect(await serverState(id)).toEqual(before);
      await expect(page.locator('[data-testid="outbox-rejected-panel"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="sync-status-rejected"]')).toHaveCount(0);
    } finally { await safeCleanup('W5-042 Wegwerf-Turnier', async () => { await rest(`/rest/v1/tournaments?id=eq.${id}`, { method: 'DELETE' }); }); }
  });
});
