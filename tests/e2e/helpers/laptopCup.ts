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
export async function wartendeEintraege(page: Page, anzahl: number, { tonBehalten = false }: { tonBehalten?: boolean } = {}): Promise<void> {
  const matchId = '00000000-0000-4000-8000-000000000915';
  // Die Kopien der anderen Spiele legt die App kurz nach dem Anpfiff an: warten, bis die des späteren Spiels da ist
  await expect.poll(() => page.evaluate(({ matchId, teams, anzahl }) => new Promise<boolean>((resolve, reject) => {
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
        if (!record) { resolve(false); return; }
        record.value.pending = Array.from({ length: anzahl }, (_, i) => ({
          id: `00000000-0000-4000-8000-00000000a0${i}0`, type: 'FOUL', actor: 'leitung', at: Date.now() + i, section: 1, clockMs: 1000 * (i + 1),
          teamId: teams[0], targetId: null, payload: {},
        }));
        store.put(record);
      };
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); reject(new Error('Schreiben der Spielkopie fehlgeschlagen')); };
    };
  }), { matchId, teams: TEAMS, anzahl }), { timeout: 15000 }).toBe(true);
  await page.reload();
  await expect(page.getByTestId('match-pause-button')).toBeVisible();
  // Nach dem Neuladen ist der Ton wieder gesperrt (Abzeichen „Ton aus“ in der Tafel). Üblich: wie Tom einmal antippen. Mit `tonBehalten`
  // (C-TAFEL-TON-UND-WARTEND-BRECHEN-ZEILE) bleibt das Abzeichen stehen: der echte Fall „Neuladen ohne Netz“ zeigt beide gleichzeitig
  const ton = page.getByTestId('scoreboard-ton');
  if (!tonBehalten) {
    if (await ton.count() > 0) { await ton.click(); await expect(ton).toHaveCount(0); }
  } else {
    await expect(ton).toBeVisible();
  }
  await expect(page.getByTestId('scoreboard-eintraege-warten')).toBeVisible();
}

export const SPALTEN_TASTEN = ['scoreboard', 'goal-button-home', 'foul-button-home', 'penalty-button-home', 'card-button-home', 'goal-button-away', 'foul-button-away', 'penalty-button-away', 'card-button-away'];

/** Fenster und Inhaltsbereich an den Anfang: gemessen wird, was die Turnierleitung nach dem Anpfiff ohne Zutun sieht. */
export async function anAnfangRollen(page: Page): Promise<void> {
  await page.evaluate(() => { window.scrollTo(0, 0); document.querySelectorAll('main').forEach((m) => { m.scrollTop = 0; }); });
}

/** Fensterhöhe, unter der die Tastenfläche am Handy scrollt (@SL-061, Record 24.10.): Tor bleibt sichtbar, Foul, Zeitstrafe und Karte folgen durch Scrollen. */
export const KLEINES_HANDY_HOEHE = 800;
export const NUR_TOR_UND_TAFEL = ['scoreboard', 'goal-button-home', 'goal-button-away'];

/**
 * Jede Taste beider Teams (und die Tafel) liegt ganz zwischen Unterkante des Kopfs und Oberkante der Leiste. Am Handy hoch unter 800 px
 * Fensterhöhe gilt das nur für Tafel und Tor (@SL-061): Foul, Zeitstrafe und Karte liegen in der scrollenden Tastenfläche.
 */
export async function pruefeZwischenKopfUndLeiste(page: Page): Promise<void> {
  const groesse = page.viewportSize();
  const kleinesHandy = (groesse?.width ?? 0) < 1024 && (groesse?.height ?? 0) < KLEINES_HANDY_HOEHE;
  const kopf = await page.getByTestId('cockpit-slim-header').boundingBox();
  const leiste = await page.getByRole('toolbar').boundingBox();
  if (!kopf || !leiste) { throw new Error('Kopf oder Leiste nicht sichtbar'); }
  const oben = Math.round(kopf.y + kopf.height);
  const unten = Math.round(leiste.y);
  for (const id of kleinesHandy ? NUR_TOR_UND_TAFEL : SPALTEN_TASTEN) {
    const box = await page.getByTestId(id).boundingBox();
    if (!box) { throw new Error(`${id} nicht sichtbar`); }
    expect(Math.round(box.y), `${id}: Oberkante unter dem Kopf`).toBeGreaterThanOrEqual(oben - 1);
    expect(Math.round(box.y + box.height), `${id}: Unterkante über der Leiste`).toBeLessThanOrEqual(unten + 1);
  }
}
