/**
 * Saat und Hilfen für die Cockpit-Specs am Laptop und Handy (Plan LT-2/LT-3): Turnier „Cockpit-Cup Laptop“ mit vier Teams.
 */
import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect } from './test-fixtures';

export const ID = 'e2e-laptop-cup';
export const TEAMS = ['e1', 'e2', 'e3', 'e4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
export const NAMEN = ['FC Nord', 'SV Süd', 'TSV Ost', 'FC West'];
export const NAME_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
export const FARBEN = ['#FFD700', '#1E56D9', '#2E8B57', '#C0392B'];
const PAARE: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
export const BILDER = process.env.LT23_BILDER ?? '';

export interface CupOptionen { namen?: readonly string[]; farben?: readonly string[]; minuten?: number; perioden?: number; pause?: number }

export function cup({ namen = NAMEN, farben = FARBEN, minuten = 12, perioden = 2, pause = 1 }: CupOptionen = {}) {
  const date = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    id: ID, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: minuten, groupPhaseBreakDuration: 2, gameDuration: minuten, breakDuration: 2, gamePeriods: perioden, halftimeBreak: pause,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'Cockpit-Cup Laptop', ageClass: 'U12', date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00',
    location: { name: 'Test-Halle' },
    teams: TEAMS.map((id, i) => ({ id, name: namen[i], group: 'A', colors: { primary: farben[i] } })),
    matches: PAARE.map(([a, b], i) => ({
      id: `00000000-0000-4000-8000-0000000009${i + 10}`, matchNumber: i + 1, round: i + 1, field: 1, group: 'A', phase: 'groupStage',
      slotA: { kind: 'team', teamId: TEAMS[a] }, slotB: { kind: 'team', teamId: TEAMS[b] }, matchStatus: 'scheduled',
      scheduledTime: `${date}T${String(10 + Math.floor(i / 5)).padStart(2, '0')}:${String((i % 5) * 12).padStart(2, '0')}:00.000Z`,
    })),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

export async function bild(page: Page, name: string): Promise<void> {
  if (BILDER !== '') { writeFileSync(`${BILDER}/${name}.png`, await page.screenshot()); }
}

export async function anpfeifen(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}/live`);
  await page.getByTestId('match-start-button').click({ timeout: 15000 });
  await expect(page.getByTestId('match-pause-button')).toBeVisible();
}

/** Unterkante eines Elements (px von oben) – ohne Scrollen sichtbar heißt: höchstens die Höhe des Fensters. */
export async function unterkante(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) { throw new Error(`${testId} nicht sichtbar`); }
  return Math.round(box.y + box.height);
}
