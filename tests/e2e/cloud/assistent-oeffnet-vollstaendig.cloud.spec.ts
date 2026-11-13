/**
 * Befund C-ENTWURF-WIEDEROEFFNEN-LOESCHT-TEAMS -- @W5-039 (Szenariogrundriss, Beispielzeilen), @W5-040 (Papierkorb und
 * Wiederherstellen) gegen den lokalen Stack. Szenarien: docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md.
 *
 * Je Beispielzeile: neuer Browser-Kontext (leerer lokaler Speicher, nur die Anmeldung des Eigentümers), Assistent über den
 * genannten Weg öffnen, die Autosave-Zeit abwarten, Schritt „Teams“ zeigt alle Teams, am Server stehen danach dieselben Teams und
 * Spiele und `updated_at` ist unverändert. Eigene Wegwerf-Turniere (Service-Rolle), Aufräumen im `finally`; die Saat-Cups bleiben unberührt.
 */
import { randomUUID } from 'node:crypto';
import type { Browser, Page } from '@playwright/test';
import { test, expect, AUTH_DIR } from './fixtures';
import path from 'node:path';
import { getLocalServiceRoleClient, safeCleanup } from './helpers';
import { E2E_DRAFT_CUP_ID } from './testData';
import { neuLaden } from '../helpers/neuLaden';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../factories/supabase';

/** Takt des Autosave im Assistenten (10 000 ms, TournamentCreationScreen); die Wartezeit liegt darüber, sonst würde ein fehlerhafter Autosave nicht auffallen. */
const AUTOSAVE_TAKT_MS = 10_000;
const WARTEZEIT_MS = AUTOSAVE_TAKT_MS + 3_000; // >= 12 s: der Prüfgegenstand ist, dass in dieser Zeit nichts geschrieben wird
const TEAM_PREFIX = 'W5039 Team';
const TEAM_ANZAHL = 6;

interface Cup { id: string; teamIds: string[]; matchIds: string[] }

async function rest(pathAndQuery: string, init: RequestInit = {}): Promise<Response> {
  const sr = getLocalServiceRoleClient();
  const response = await fetch(`${sr.url}${pathAndQuery}`, {
    ...init,
    headers: { ...sr.headers, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  if (!response.ok) { throw new Error(`${init.method ?? 'GET'} ${pathAndQuery}: ${response.status} ${await response.text()}`); }
  return response;
}

async function ownerId(): Promise<string> {
  const rows = (await (await rest(`/rest/v1/tournaments?id=eq.${E2E_DRAFT_CUP_ID}&select=owner_id`)).json()) as Array<{ owner_id: string }>;
  return rows[0].owner_id;
}

/** Wegwerf-Turnier des Eigentümers mit 6 Teams; veröffentlicht zusätzlich mit 3 Spielen (Anstoß in der Zukunft, nichts angepfiffen). */
async function seedCup(kind: 'draft' | 'published'): Promise<Cup> {
  const id = randomUUID();
  const owner = await ownerId();
  const published = kind === 'published';
  const config = published ? { publishedAt: '2026-11-01T08:00:00.000Z' } : {};
  await rest('/rest/v1/tournaments', {
    method: 'POST',
    body: JSON.stringify(createTournamentRow({
      id, owner_id: owner, title: `W5039 ${kind} ${id.slice(0, 6)}`, status: kind, lifecycle_status: published ? 'fixed' : 'draft',
      number_of_teams: TEAM_ANZAHL, number_of_groups: 2, number_of_fields: 1, date: '2030-01-01', config,
    })),
  });
  const teamIds = Array.from({ length: TEAM_ANZAHL }, () => randomUUID());
  await rest('/rest/v1/teams', {
    method: 'POST',
    body: JSON.stringify(teamIds.map((teamId, index) => createTeamRow({
      id: teamId, tournament_id: id, name: `${TEAM_PREFIX} ${index + 1}`, group_letter: index < 3 ? 'A' : 'B', sort_order: index,
      color_primary: '#e53935', color_secondary: '#ffffff',
    }))),
  });
  const matchIds: string[] = [];
  if (published) {
    const paare: Array<[number, number]> = [[0, 1], [2, 0], [1, 2]];
    const rows = paare.map(([a, b], index) => {
      const matchId = randomUUID();
      matchIds.push(matchId);
      return createMatchRow({
        id: matchId, tournament_id: id, round: 1, field: 1, slot: index, group_letter: 'A', match_number: index + 1,
        team_a_id: teamIds[a], team_b_id: teamIds[b], match_status: 'scheduled', phase: 'groupStage',
        scheduled_start: `2030-01-01T${String(9 + index).padStart(2, '0')}:00:00.000Z`,
      });
    });
    await rest('/rest/v1/matches', { method: 'POST', body: JSON.stringify(rows) });
  }
  return { id, teamIds, matchIds };
}

async function dropCup(cup: Cup): Promise<void> {
  await rest(`/rest/v1/matches?tournament_id=eq.${cup.id}`, { method: 'DELETE' });
  await rest(`/rest/v1/teams?tournament_id=eq.${cup.id}`, { method: 'DELETE' });
  await rest(`/rest/v1/tournaments?id=eq.${cup.id}`, { method: 'DELETE' });
}

interface ServerState { teams: number; matches: number; updatedAt: string; deletedAt: string | null }

async function serverState(cup: Cup): Promise<ServerState> {
  const teams = (await (await rest(`/rest/v1/teams?tournament_id=eq.${cup.id}&select=id`)).json()) as unknown[];
  const matches = (await (await rest(`/rest/v1/matches?tournament_id=eq.${cup.id}&select=id`)).json()) as unknown[];
  const row = ((await (await rest(`/rest/v1/tournaments?id=eq.${cup.id}&select=updated_at,deleted_at`)).json()) as Array<{ updated_at: string; deleted_at: string | null }>)[0];
  return { teams: teams.length, matches: matches.length, updatedAt: row.updated_at, deletedAt: row.deleted_at };
}

/** Neues „Gerät“: leerer lokaler Speicher, nur die Anmeldung des Eigentümers. */
async function freshOwnerPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: path.join(AUTH_DIR, 'owner.json') });
  return context.newPage();
}

async function expectAllTeamsInStepTeams(page: Page): Promise<void> {
  await expect.poll(
    () => page.evaluate((prefix) => Array.from(document.querySelectorAll('input')).filter((input) => input.value.startsWith(prefix)).length, TEAM_PREFIX),
    { timeout: 20_000, message: 'Schritt „Teams“ zeigt alle Teams' },
  ).toBe(TEAM_ANZAHL);
}

async function openCardOfDraft(page: Page, cup: Cup): Promise<void> {
  await page.goto('/#/');
  const card = `[data-testid="tournament-card-${cup.id}"]`;
  const section = page.locator('[data-testid^="section-"]', { has: page.locator(card) });
  const toggle = section.locator('[aria-expanded]').first();
  await expect(toggle).toBeVisible({ timeout: 15000 });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') { await toggle.click(); }
  await page.locator(card).click();
}

async function expectUnchangedAfterWaiting(page: Page, cup: Cup, before: ServerState): Promise<void> {
  await expectAllTeamsInStepTeams(page);
  await page.waitForTimeout(WARTEZEIT_MS);
  await expectAllTeamsInStepTeams(page);
  expect(await serverState(cup)).toEqual(before);
}

test.describe('@W5-039 der Assistent öffnet ein Turnier mit allen Teams und ändert am Server nichts', () => {
  test.describe.configure({ timeout: 90_000 });

  test('Entwurf, kein lokaler Stand, „Gespeicherte Entwürfe“ der Startseite', async ({ browser }) => {
    const cup = await seedCup('draft');
    try {
      const before = await serverState(cup);
      const page = await freshOwnerPage(browser);
      await openCardOfDraft(page, cup);
      await expect(page).toHaveURL(new RegExp(`/tournament/${cup.id}/edit`));
      await page.goto(`/#/tournament/${cup.id}/edit?step=4`); // Schritt „Teams“, Hash-Wechsel ohne Neuladen
      await expectUnchangedAfterWaiting(page, cup, before);
    } finally { await safeCleanup('W5-039 Entwurf Startseite', () => dropCup(cup)); }
  });

  test('Entwurf, kein lokaler Stand, die Adresse des Assistenten direkt', async ({ browser }) => {
    const cup = await seedCup('draft');
    try {
      const before = await serverState(cup);
      const page = await freshOwnerPage(browser);
      await page.goto(`/#/tournament/${cup.id}/edit?step=4`);
      await expectUnchangedAfterWaiting(page, cup, before);
    } finally { await safeCleanup('W5-039 Entwurf Adresse', () => dropCup(cup)); }
  });

  test('Entwurf, lokale Kopie ohne wartende Änderung, „Gespeicherte Entwürfe“ im selben Browser', async ({ browser }) => {
    const cup = await seedCup('draft');
    try {
      const before = await serverState(cup);
      const page = await freshOwnerPage(browser);
      await page.goto(`/#/tournament/${cup.id}`); // legt die lokale Kopie an (Verwaltung lädt das Turnier)
      await page.waitForLoadState('networkidle');
      await neuLaden(page);
      await openCardOfDraft(page, cup);
      await page.goto(`/#/tournament/${cup.id}/edit?step=4`);
      await expectUnchangedAfterWaiting(page, cup, before);
    } finally { await safeCleanup('W5-039 Entwurf lokale Kopie', () => dropCup(cup)); }
  });

  test('veröffentlichtes Turnier vor dem Anpfiff, Neuladen der Seite bei geöffnetem Assistenten', async ({ browser }) => {
    const cup = await seedCup('published');
    try {
      const before = await serverState(cup);
      expect(before.matches).toBe(3);
      const page = await freshOwnerPage(browser);
      await page.goto(`/#/tournament/${cup.id}/edit?step=4`);
      await expectAllTeamsInStepTeams(page);
      await neuLaden(page);
      await expectUnchangedAfterWaiting(page, cup, before);
    } finally { await safeCleanup('W5-039 veröffentlicht', () => dropCup(cup)); }
  });
});

test.describe('@W5-040 Papierkorb und Wiederherstellen lassen Teams und Spiele unverändert', () => {
  test.describe.configure({ timeout: 90_000 });

  test('Entwurf mit 6 Teams: in den Papierkorb und zurück, am Server bleiben alle Teams', async ({ browser }) => {
    const cup = await seedCup('draft');
    try {
      const before = await serverState(cup);
      const page = await freshOwnerPage(browser);
      await page.goto('/#/');
      const card = `[data-testid="tournament-card-${cup.id}"]`;
      const section = page.locator('[data-testid^="section-"]', { has: page.locator(card) });
      const toggle = section.locator('[aria-expanded]').first();
      await expect(toggle).toBeVisible({ timeout: 15000 });
      if ((await toggle.getAttribute('aria-expanded')) === 'false') { await toggle.click(); }
      await page.locator(`[data-testid="tournament-${cup.id}-actions-trigger"]`).click();
      await page.locator('[data-testid="action-menu-item-delete"]').click();
      await page.locator('[data-testid="confirm-dialog-confirm"]').click();

      await expect.poll(async () => (await serverState(cup)).deletedAt, { timeout: 20_000 }).not.toBeNull();
      expect((await serverState(cup)).teams).toBe(before.teams);

      await page.goto('/#/papierkorb');
      await page.locator(`[data-testid="trash-card-${cup.id}"]`).getByRole('button', { name: /Wiederherstellen/ }).click();
      await expect.poll(async () => (await serverState(cup)).deletedAt, { timeout: 20_000 }).toBeNull();

      const after = await serverState(cup);
      expect(after.teams).toBe(TEAM_ANZAHL);
      expect(after.matches).toBe(before.matches);
    } finally { await safeCleanup('W5-040 Papierkorb', () => dropCup(cup)); }
  });
});
