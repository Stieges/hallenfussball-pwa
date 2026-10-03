/**
 * Gemeinsame Bausteine der Durchstich-Schritte (A-23): Zugriff auf den Turniertag-Cup per
 * Service-Role (nur lokaler Stack) und der "Soll-Marker" für noch nicht gebaute Schritte.
 */
import { expect, type Page } from '@playwright/test';
import { getLocalServiceRoleClient } from '../../helpers';
import { e2eUuid } from '../../e2eUuid';
import { E2E_TURNIERTAG_CUP_ID } from '../../testData';

/** Kurze Zeitgrenze: ein noch nicht gebauter Schritt soll schnell und am Soll-Marker scheitern. */
export const SOLL_TIMEOUT_MS = 3000;

export const TURNIERTAG_ID = E2E_TURNIERTAG_CUP_ID;

export interface TurniertagMatch {
  id: string;
  slot: number;
  phase: string;
  group_letter: string | null;
  team_a_id: string | null;
  team_b_id: string | null;
  slot_a_source: { kind: string; rank?: number; group?: string; role?: string; matchId?: string } | null;
  slot_b_source: { kind: string; rank?: number; group?: string; role?: string; matchId?: string } | null;
  match_status: string | null;
  decided_by: string | null;
  score_a: number | null;
  score_b: number | null;
}

export interface TurniertagTeam {
  id: string;
  name: string;
  group_letter: string | null;
}

async function getRows<T>(query: string, label: string): Promise<T[]> {
  const { url, headers } = getLocalServiceRoleClient();
  const res = await fetch(`${url}/rest/v1/${query}`, { headers });
  if (!res.ok) {
    throw new Error(`${label} fehlgeschlagen: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

/** Alle Spiele des Turniertag-Cups in Spielplan-Reihenfolge (`slot`). */
export function fetchTurniertagMatches(): Promise<TurniertagMatch[]> {
  return getRows<TurniertagMatch>(
    `matches?tournament_id=eq.${TURNIERTAG_ID}&order=slot.asc,field.asc,id.asc&select=id,slot,phase,group_letter,team_a_id,team_b_id,slot_a_source,slot_b_source,match_status,decided_by,score_a,score_b`,
    'fetchTurniertagMatches'
  );
}

export function fetchTurniertagTeams(): Promise<TurniertagTeam[]> {
  return getRows<TurniertagTeam>(`teams?tournament_id=eq.${TURNIERTAG_ID}&select=id,name,group_letter&order=name.asc`, 'fetchTurniertagTeams');
}

/** Gruppenspiele in Spielplan-Reihenfolge (die ersten 12) und Finalrunde (HF1, HF2, Platz 3, Finale). */
export async function fetchTurniertagBracket(): Promise<{ groupMatches: TurniertagMatch[]; finals: TurniertagMatch[] }> {
  const matches = await fetchTurniertagMatches();
  return { groupMatches: matches.filter((m) => m.phase === 'groupStage'), finals: matches.filter((m) => m.phase !== 'groupStage') };
}

export function turniertagEventId(key: string): string {
  return e2eUuid(`event:turniertag-cup:${key}`);
}

/**
 * Soll-Marker eines noch nicht gebauten Schritts: das Bedienelement, das der Besitzer baut.
 * Der Besitzer präzisiert den Marker beim Bauen -- bis dahin scheitert der Schritt hier und ist
 * als `test.fail` markiert. Wird er unerwartet grün, meldet Playwright "Expected to fail".
 */
export async function expectSollMarker(page: Page, testId: string): Promise<void> {
  await expect(page.locator(`[data-testid="${testId}"]`)).toBeVisible({ timeout: SOLL_TIMEOUT_MS });
}

export async function openTurniertagPath(page: Page, pathSuffix: string): Promise<void> {
  await page.goto(`/#/tournament/${TURNIERTAG_ID}${pathSuffix}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Zeile eines Spiels im Spielplan der Turnierleitung (Grid): `role="row"` mit `aria-label`
 * "Spiel <n>: <Heim> gegen <Gast>"; die Zeile wird über den Kreis des Spiels (`match-circle-<id>`)
 * gefunden, nicht über die Anzeigenummer oder den Text.
 */
export function matchRow(page: Page, matchId: string) {
  return page.getByRole('row').filter({ has: page.locator(`[data-testid="match-circle-${matchId}"]`) });
}

/**
 * Öffnet den Spielplan der Turnierleitung gefiltert auf die Finalrunde. Die Liste rendert nur einen
 * Ausschnitt aller Spiele; mit dem Phasenfilter stehen genau die vier Finalrunden-Spiele im Dokument.
 */
export async function openSpielplanFinalrunde(page: Page): Promise<void> {
  await openTurniertagPath(page, '/schedule');
  await page.locator('[data-testid="filter-phase"]').selectOption({ label: 'Finalrunde' });
}
