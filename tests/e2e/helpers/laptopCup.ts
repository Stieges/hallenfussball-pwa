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

export interface CupOptionen { namen?: readonly string[]; farben?: readonly string[]; minuten?: number; perioden?: number; pause?: number; felder?: number }

export function cup({ namen = NAMEN, farben = FARBEN, minuten = 12, perioden = 2, pause = 1, felder = 1 }: CupOptionen = {}) {
  const date = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    id: ID, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: felder, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
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

/**
 * Legt `anzahl` wartende Einträge (noch nicht übertragen, „Ausgang“) für ein späteres Spiel des Turniers in die lokale Spielkopie
 * (IndexedDB `hallenfussball-matches`, Konto „guest“) – Testdaten im Format der App, kein Eingriff in den Produktivcode.
 * Danach neu laden: der Sender zählt beim Start (`OutboxStatusBook.countCopies`) und die Verbindungsanzeige nennt „N Einträge warten“.
 */
export async function wartendeEintraege(page: Page, anzahl: number): Promise<void> {
  const matchId = '00000000-0000-4000-8000-000000000915';
  await page.evaluate(({ matchId, teams, anzahl }) => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('hallenfussball-matches');
    req.onerror = () => { reject(new Error('Spielkopie nicht lesbar')); };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('matches', 'readwrite');
      const store = tx.objectStore('matches');
      const key = `guest|${matchId}`;
      const lese = store.get(key);
      lese.onsuccess = () => {
        const record = lese.result as { key: string; value: { pending: unknown[] } } | undefined;
        if (!record) { reject(new Error('Kopie des Spiels fehlt')); return; }
        record.value.pending = Array.from({ length: anzahl }, (_, i) => ({
          id: `00000000-0000-4000-8000-00000000a0${i}0`, type: 'FOUL', actor: 'leitung', at: Date.now() + i, section: 1, clockMs: 1000 * (i + 1),
          teamId: teams[0], targetId: null, payload: {},
        }));
        store.put(record);
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(new Error('Schreiben der Spielkopie fehlgeschlagen')); };
    };
  }), { matchId, teams: TEAMS, anzahl });
  await page.reload();
  await expect(page.getByTestId('match-pause-button')).toBeVisible();
  // Nach dem Neuladen ist der Ton wieder gesperrt (Abzeichen „Ton aus“ in der Tafel): wie Tom einmal antippen, damit die Tafel so hoch ist wie nach dem Anpfiff
  const ton = page.getByTestId('scoreboard-ton');
  if (await ton.count() > 0) { await ton.click(); await expect(ton).toHaveCount(0); }
  await expect(page.getByTestId('scoreboard-eintraege-warten')).toBeVisible();
}
