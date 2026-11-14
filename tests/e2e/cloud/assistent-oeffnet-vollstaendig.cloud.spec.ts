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
import { appendOwner, eventOf } from './turniertag/steps/playViaRpc';
import { createMatchRow, createTeamRow, createTournamentRow } from '../../factories/supabase';

/** Takt des Autosave im Assistenten (10 000 ms, TournamentCreationScreen); die Wartezeit liegt darüber, sonst würde ein fehlerhafter Autosave nicht auffallen. */
const AUTOSAVE_TAKT_MS = 10_000;
const WARTEZEIT_MS = AUTOSAVE_TAKT_MS + 3_000; // >= 12 s: der Prüfgegenstand ist, dass in dieser Zeit nichts geschrieben wird
const TEAM_PREFIX = 'W5039 Team';
const TEAM_ANZAHL = 6;
/** Schritt „Teams“ des Assistenten (Schritt 4 ist „Gruppen & Felder“). */
const SCHRITT_TEAMS = 5;

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

/** Spiele des festgelegten Wegwerf-Turniers: jeder gegen jeden bei 6 Teams (@W5-040: „6 Teams und 15 Spiele“). */
const SPIELE_ANZAHL = 15;

/**
 * Wegwerf-Turnier des Eigentümers mit 6 Teams; festgelegt zusätzlich mit 15 Spielen (Anstoß in der Zukunft, nichts angepfiffen,
 * auf Wunsch das erste Spiel beendet 2:1). Scheitert der Aufbau, wird das Halbfertige gleich wieder entfernt.
 */
async function seedCup(kind: 'draft' | 'published', mitErgebnis = false, mitSpielen = kind === 'published'): Promise<Cup> {
  const cup: Cup = { id: randomUUID(), teamIds: [], matchIds: [] };
  try {
    await seedInto(cup, kind, mitErgebnis, mitSpielen);
  } catch (error) {
    await safeCleanup('W5-039 halber Aufbau', () => dropCup(cup));
    throw error;
  }
  return cup;
}

async function seedInto(cup: Cup, kind: 'draft' | 'published', mitErgebnis: boolean, mitSpielen: boolean): Promise<void> {
  const id = cup.id;
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
  const teamIds = cup.teamIds;
  for (let i = 0; i < TEAM_ANZAHL; i++) { teamIds.push(randomUUID()); }
  await rest('/rest/v1/teams', {
    method: 'POST',
    body: JSON.stringify(teamIds.map((teamId, index) => createTeamRow({
      id: teamId, tournament_id: id, name: `${TEAM_PREFIX} ${index + 1}`, group_letter: index < 3 ? 'A' : 'B', sort_order: index,
      color_primary: '#e53935', color_secondary: '#ffffff',
    }))),
  });
  const matchIds = cup.matchIds;
  if (mitSpielen) {
    const paare: Array<[number, number]> = [];
    for (let a = 0; a < TEAM_ANZAHL; a++) { for (let b = a + 1; b < TEAM_ANZAHL; b++) { paare.push([a, b]); } }
    expect(paare).toHaveLength(SPIELE_ANZAHL);
    const rows = paare.map(([a, b], index) => {
      const matchId = randomUUID();
      matchIds.push(matchId);
      return createMatchRow({
        id: matchId, tournament_id: id, round: 1, field: 1, slot: index, group_letter: 'A', match_number: index + 1,
        team_a_id: teamIds[a], team_b_id: teamIds[b], match_status: 'scheduled', phase: 'groupStage',
        scheduled_start: `${String(9 + Math.floor(index / 6)).padStart(2, '0')}:${String((index % 6) * 10).padStart(2, '0')}:00`, // Uhrzeit-Spalte (time), das Datum steht am Turnier
      });
    });
    await rest('/rest/v1/matches', { method: 'POST', body: JSON.stringify(rows) });
    if (mitErgebnis) {
      // Ergebnis auf dem sicheren Weg des Turniertags: Anpfiff, Tore, Abpfiff über append_match_events als Turnierleitung
      const start = Date.now() - 600_000;
      const ereignisse = [
        eventOf('MATCH_START', start, start),
        eventOf('GOAL', start + 1000, start, { teamId: teamIds[0] }),
        eventOf('GOAL', start + 2000, start, { teamId: teamIds[0] }),
        eventOf('GOAL', start + 3000, start, { teamId: teamIds[1] }),
        eventOf('MATCH_END', start + 4000, start),
      ];
      const antwort = await appendOwner(matchIds[0], ereignisse);
      const stati = antwort.results.map((r) => r.status);
      if (stati.some((status) => status !== 'accepted')) { throw new Error(`Ergebnis konnte nicht angelegt werden: ${JSON.stringify(antwort.results)}`); }
    }
  }
}

/** Eine DELETE-Anweisung auf die Turnierzeile reicht (Kaskade, auch mit Spielen und Ereignissen; Muster protect-matches-with-events). */
async function dropCup(cup: Cup): Promise<void> {
  await rest(`/rest/v1/tournaments?id=eq.${cup.id}`, { method: 'DELETE' });
}

interface ServerState { teams: number; matches: number; results: string; updatedAt: string; deletedAt: string | null }

async function serverState(cup: Cup): Promise<ServerState> {
  const teams = (await (await rest(`/rest/v1/teams?tournament_id=eq.${cup.id}&select=id`)).json()) as unknown[];
  const matches = (await (await rest(`/rest/v1/matches?tournament_id=eq.${cup.id}&select=id,match_status,score_a,score_b&order=id.asc`)).json()) as Array<{ id: string; match_status: string | null; score_a: number | null; score_b: number | null }>;
  const row = ((await (await rest(`/rest/v1/tournaments?id=eq.${cup.id}&select=updated_at,deleted_at`)).json()) as Array<{ updated_at: string; deleted_at: string | null }>)[0];
  return { teams: teams.length, matches: matches.length, results: matches.map((m) => `${m.id}:${m.match_status ?? '-'}:${m.score_a ?? '-'}:${m.score_b ?? '-'}`).join('|'), updatedAt: row.updated_at, deletedAt: row.deleted_at };
}

/** Neues „Gerät“: leerer lokaler Speicher, nur die Anmeldung des Eigentümers. */
async function freshOwnerPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ storageState: path.join(AUTH_DIR, 'owner.json') });
  return context.newPage();
}

async function expectAllTeamsInStepTeams(page: Page, adresse?: string): Promise<void> {
  if (adresse !== undefined) { await page.goto(adresse); }
  // Anker zuerst: steht wirklich Schritt „Teams“ da? Sonst wäre ein Fehlschlag der Zählung ein Selektor-, kein Produktfehler.
  await expect(page.locator('[aria-current="step"]')).toHaveAttribute('aria-label', new RegExp(`^Schritt ${SCHRITT_TEAMS}:`), { timeout: 20_000 });
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
      await page.goto(`/#/tournament/${cup.id}/edit?step=${SCHRITT_TEAMS}`); // Schritt „Teams“, Hash-Wechsel ohne Neuladen
      await expectUnchangedAfterWaiting(page, cup, before);
    } finally { await safeCleanup('W5-039 Entwurf Startseite', () => dropCup(cup)); }
  });

  test('Entwurf, kein lokaler Stand, die Adresse des Assistenten direkt', async ({ browser }) => {
    const cup = await seedCup('draft');
    try {
      const before = await serverState(cup);
      const page = await freshOwnerPage(browser);
      await page.goto(`/#/tournament/${cup.id}/edit?step=${SCHRITT_TEAMS}`);
      await expectUnchangedAfterWaiting(page, cup, before);
    } finally { await safeCleanup('W5-039 Entwurf Adresse', () => dropCup(cup)); }
  });

  test('Entwurf, lokale Kopie ohne wartende Änderung, „Gespeicherte Entwürfe“ im selben Browser', async ({ browser }) => {
    const cup = await seedCup('draft');
    try {
      const before = await serverState(cup);
      const page = await freshOwnerPage(browser);
      // Erstes Öffnen über „Gespeicherte Entwürfe“ legt die lokale Kopie an; danach zurück zur Startseite und neu laden: im selben Browser
      // liegt jetzt eine Kopie ohne wartende Änderung vor (wie im echten Ablauf, ohne Umweg über die Verwaltung).
      await openCardOfDraft(page, cup);
      await expectAllTeamsInStepTeams(page, `/#/tournament/${cup.id}/edit?step=${SCHRITT_TEAMS}`);
      await page.goto('/#/');
      await neuLaden(page);
      await openCardOfDraft(page, cup);
      await page.goto(`/#/tournament/${cup.id}/edit?step=${SCHRITT_TEAMS}`);
      await expectUnchangedAfterWaiting(page, cup, before);
    } finally { await safeCleanup('W5-039 Entwurf lokale Kopie', () => dropCup(cup)); }
  });

  test('veröffentlichtes Turnier vor dem Anpfiff, Neuladen der Seite bei geöffnetem Assistenten', async ({ browser }) => {
    const cup = await seedCup('published');
    try {
      const before = await serverState(cup);
      expect(before.matches).toBe(SPIELE_ANZAHL);
      const page = await freshOwnerPage(browser);
      await page.goto(`/#/tournament/${cup.id}/edit?step=${SCHRITT_TEAMS}`);
      await expectAllTeamsInStepTeams(page);
      await neuLaden(page);
      await expectUnchangedAfterWaiting(page, cup, before);
    } finally { await safeCleanup('W5-039 veröffentlicht', () => dropCup(cup)); }
  });

  test('veröffentlichtes Turnier mit Ergebnissen, Neuladen der Seite bei geöffnetem Assistenten', async ({ browser }) => {
    const cup = await seedCup('published', true);
    try {
      const before = await serverState(cup);
      expect(before.results).toContain(':finished:2:1'); // das Ergebnis steht am Server, bevor der Assistent öffnet
      const page = await freshOwnerPage(browser);
      await page.goto(`/#/tournament/${cup.id}/edit?step=${SCHRITT_TEAMS}`);
      await expectAllTeamsInStepTeams(page);
      await neuLaden(page);
      await expectUnchangedAfterWaiting(page, cup, before);
    } finally { await safeCleanup('W5-039 veröffentlicht mit Ergebnis', () => dropCup(cup)); }
  });
});

test.describe('@W5-039 „Im Wizard bearbeiten“ in den Einstellungen der Verwaltung öffnet vollständig und ändert am Server nichts', () => {
  test.describe.configure({ timeout: 90_000 });

  for (const lokal of ['keine Kopie', 'eine Kopie ohne wartende Änderung'] as const) {
    test(`veröffentlichtes Turnier vor dem Anpfiff, ${lokal}`, async ({ browser }) => {
      const cup = await seedCup('published');
      try {
        const before = await serverState(cup);
        const page = await freshOwnerPage(browser);
        if (lokal !== 'keine Kopie') {
          await page.goto(`/#/tournament/${cup.id}`); // die Verwaltung legt die lokale Kopie an, ohne etwas zu ändern
          // geladen ist die Verwaltung, sobald der Spielplan des Turniers steht (nur sichtbare Karten: Handy- und Desktop-Ansicht liegen beide im DOM)
          await expect(page.locator('[data-match-card]:visible').first()).toBeVisible({ timeout: 20_000 });
        }
        await page.goto(`/#/tournament/${cup.id}/settings`);
        await page.getByTestId('wizard-edit-edit-teams').click();
        await page.getByTestId('confirm-dialog-confirm').click();
        await expect(page).toHaveURL(new RegExp(`/tournament/${cup.id}/edit\\?step=${SCHRITT_TEAMS}`));
        await expectUnchangedAfterWaiting(page, cup, before);
      } finally { await safeCleanup('W5-039 Im Wizard bearbeiten', () => dropCup(cup)); }
    });
  }
});

async function openActionsOfCard(page: Page, cup: Cup): Promise<void> {
  await page.goto('/#/');
  const card = `[data-testid="tournament-card-${cup.id}"]`;
  const section = page.locator('[data-testid^="section-"]', { has: page.locator(card) });
  const toggle = section.locator('[aria-expanded]').first();
  await expect(toggle).toBeVisible({ timeout: 15000 });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') { await toggle.click(); }
  await page.locator(`[data-testid="tournament-${cup.id}-actions-trigger"]`).click();
}

/** In den Papierkorb und wieder heraus, auf einem Gerät ohne lokale Kopie; Teams, Spiele und Ergebnisse bleiben am Server unverändert. */
async function trashAndRestore(browser: Browser, cup: Cup): Promise<void> {
  const before = await serverState(cup);
  const page = await freshOwnerPage(browser);
  await openActionsOfCard(page, cup);
  await page.locator('[data-testid="action-menu-item-delete"]').click();
  await page.locator('[data-testid="confirm-dialog-confirm"]').click();

  await expect.poll(async () => (await serverState(cup)).deletedAt, { timeout: 20_000 }).not.toBeNull();
  const inKorb = await serverState(cup);
  expect({ teams: inKorb.teams, matches: inKorb.matches, results: inKorb.results }).toEqual({ teams: before.teams, matches: before.matches, results: before.results });

  await page.goto('/#/papierkorb');
  await page.locator(`[data-testid="trash-card-${cup.id}"]`).getByRole('button', { name: /Wiederherstellen/ }).click();
  await expect.poll(async () => (await serverState(cup)).deletedAt, { timeout: 20_000 }).toBeNull();

  const after = await serverState(cup);
  expect({ teams: after.teams, matches: after.matches, results: after.results }).toEqual({ teams: before.teams, matches: before.matches, results: before.results });
}

test.describe('@W5-040 Papierkorb und Wiederherstellen lassen Teams und Spiele unverändert', () => {
  test.describe.configure({ timeout: 90_000 });

  // Ein festgelegtes Turnier bietet die Startseite nicht zum Löschen an (@LZ-003, Karte ohne geladene Spiele); der Entwurf mit
  // erzeugtem Spielplan (6 Teams, 15 Spiele) ist der Weg, auf dem Teams UND Spiele in den Papierkorb gelangen.
  test('Entwurf mit 6 Teams und 15 Spielen: in den Papierkorb und zurück, am Server bleibt alles', async ({ browser }) => {
    const cup = await seedCup('draft', false, true);
    try {
      expect(await serverState(cup)).toMatchObject({ teams: TEAM_ANZAHL, matches: SPIELE_ANZAHL });
      await trashAndRestore(browser, cup);
    } finally { await safeCleanup('W5-040 Papierkorb Entwurf mit Spielen', () => dropCup(cup)); }
  });

  test('Entwurf mit 6 Teams: in den Papierkorb und zurück, am Server bleiben alle Teams', async ({ browser }) => {
    const cup = await seedCup('draft');
    try {
      await trashAndRestore(browser, cup);
    } finally { await safeCleanup('W5-040 Papierkorb Entwurf', () => dropCup(cup)); }
  });
});
