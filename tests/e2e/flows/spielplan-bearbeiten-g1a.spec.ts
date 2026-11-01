/**
 * Spielplan bearbeiten (Paket G1a), offline (Gast):
 * - @ZP-100 Tauschen per Ziehen am Handy mit echten Touch-Ereignissen (CDP Input.dispatchTouchEvent): Griff mit
 *   `touch-action: none`, kein `pointercancel`, Tausch erfolgt, Liste nach Uhrzeit, Meldung mit Spielnummern;
 *   „Tauschen mit …“ als Weg ohne Ziehen.
 * - @ZP-101 ein Tausch ist bis „Speichern“ nur Entwurf: eine zweite Seite (gleicher Speicher) sieht den alten Plan.
 * - @ZP-103 „Abbrechen“ fragt nach; „Verwerfen“ lässt den Spielplan wie vorher.
 * Vitest: src/features/tournament-management/hooks/__tests__/useScheduleDraft.test.tsx, ScheduleTab.entwurf.test.tsx.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';

const TOURNAMENT = 'g1a-bearbeiten-offline';
const TEAMS = ['FC Nord', 'SV Süd', 'TSV West', 'SC Ost', 'DJK Berg'];
const PAARUNGEN: [number, number][] = [[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 2], [1, 3], [2, 4], [3, 0], [4, 1]];
const teamId = (i: number) => `00000000-0000-4000-8000-00000000a1c${i}`;
const matchId = (n: number) => `00000000-0000-4000-8000-0000000a1b${String(n).padStart(2, '0')}`;

function turnier(): Record<string, unknown> {
  const date = new Date().toISOString().split('T')[0];
  const uhr = (n: number) => { const min = (n - 1) * 12; return `${String(10 + Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; };
  return {
    id: TOURNAMENT, status: 'published', sport: 'football', sportId: 'football-indoor', tournamentType: 'classic', mode: 'classic',
    numberOfFields: 1, numberOfTeams: 5, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, finalsConfig: { preset: 'none' },
    isKidsTournament: false, hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals',
    pointSystem: { win: 3, draw: 1, loss: 0 }, title: 'Hallencup Bearbeiten', ageClass: 'U12',
    date, timeSlot: '10:00 - 12:00', startDate: date, startTime: '10:00', location: { name: 'Halle Nord' },
    refereeConfig: { mode: 'none' },
    teams: TEAMS.map((name, i) => ({ id: teamId(i), name, group: 'A' })),
    matches: PAARUNGEN.map(([a, b], i) => ({
      id: matchId(i + 1), matchNumber: i + 1, round: i + 1, slot: i, field: 1, phase: 'groupStage', group: 'A',
      slotA: { kind: 'team', teamId: teamId(a) }, slotB: { kind: 'team', teamId: teamId(b) },
      scheduledTime: `${date}T${uhr(i + 1)}:00`, matchStatus: 'scheduled',
    })),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

/** Sichtbare Karten der Gruppenphase: Spielnummer (aus „Spiel n: …“) und Uhrzeit, in Anzeige-Reihenfolge */
async function karten(page: Page): Promise<{ nr: number; zeit: string }[]> {
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.group-stage-schedule [aria-label^="Spiel "]')]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => ({ nr: Number(/^Spiel (\d+)/.exec(el.getAttribute('aria-label') ?? '')?.[1]), zeit: /\b(\d{2}:\d{2})\b/.exec(el.innerText)?.[1] ?? '' }))
    .filter((k, i, alle) => k.nr > 0 && k.zeit !== '' && alle.findIndex((x) => x.nr === k.nr) === i));
}

const zeitVon = async (page: Page, nr: number) => (await karten(page)).find((k) => k.nr === nr)?.zeit;
const nachUhrzeit = (liste: { zeit: string }[]) => liste.every((k, i) => i === 0 || liste[i - 1].zeit <= k.zeit);

async function oeffnen(page: Page) {
  await page.goto(`/#/tournament/${TOURNAMENT}/schedule`);
  await expect(page.getByTestId('schedule-edit-start')).toBeVisible();
}

async function tauscheMit(page: Page, von: number, nach: number) {
  await page.getByTestId('schedule-edit-start').click();
  await page.getByTestId(`swap-with-${matchId(von)}`).filter({ visible: true }).first().click();
  await page.getByTestId('swap-with-select').selectOption(matchId(nach));
  await page.getByTestId('confirm-dialog-confirm').click();
}

test.describe('G1a Spielplan bearbeiten (offline)', () => {
  test.beforeEach(async ({ seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [turnier()] });
  });

  test('@ZP-100 am Handy: Spiel 6 am Griff auf Spiel 3 ziehen tauscht beide, ohne pointercancel, Liste nach Uhrzeit', async ({ page, browserName }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch || browserName !== 'chromium', 'echte Touch-Ereignisse über CDP nur im Chromium-Handy-Projekt');
    await oeffnen(page);
    await page.getByTestId('schedule-edit-start').click();
    const vorher = { s3: await zeitVon(page, 3), s6: await zeitVon(page, 6) };

    const griffe = page.getByLabel('Ziehen zum Verschieben', { exact: true }).filter({ visible: true });
    const griff6 = griffe.nth(5);
    await expect(griff6).toHaveCSS('touch-action', 'none');

    // Spiel 3 oben im Bild, damit Ziel und Griff gleichzeitig sichtbar sind
    const karte3 = page.locator('.group-stage-schedule [aria-label^="Spiel 3:"]').filter({ visible: true });
    await karte3.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => {
      const w = window as unknown as { __abbrueche: number };
      w.__abbrueche = 0;
      document.addEventListener('pointercancel', () => { w.__abbrueche += 1; }, true);
    });

    const von = (await griff6.boundingBox())!;
    const nach = (await karte3.boundingBox())!;
    const start = { x: von.x + von.width / 2, y: von.y + von.height / 2 };
    const ziel = { x: start.x, y: nach.y + nach.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    const punkt = (x: number, y: number) => [{ x, y, radiusX: 5, radiusY: 5, force: 1, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punkt(start.x, start.y) });
    for (let i = 1; i <= 20; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punkt(start.x, start.y + ((ziel.y - start.y) * i) / 20) });
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(150);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(page.getByText('Spiele 6 und 3 getauscht')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __abbrueche: number }).__abbrueche)).toBe(0);
    await expect.poll(() => zeitVon(page, 6)).toBe(vorher.s3);
    expect(await zeitVon(page, 3)).toBe(vorher.s6);
    expect(nachUhrzeit(await karten(page))).toBe(true);
    await expect(page.getByTestId('schedule-unsaved-count')).toHaveText('1 Änderung nicht gespeichert');
  });

  test('@ZP-100 am Handy: liegt das Ziel außerhalb des Bildschirms, scrollt die Liste beim Ziehen mit – gebremst', async ({ page, browserName }, testInfo) => {
    test.skip(!testInfo.project.use.hasTouch || browserName !== 'chromium', 'echte Touch-Ereignisse über CDP nur im Chromium-Handy-Projekt');
    await oeffnen(page);
    await page.getByTestId('schedule-edit-start').click();
    const griff10 = page.getByLabel('Ziehen zum Verschieben', { exact: true }).filter({ visible: true }).nth(9);
    await griff10.evaluate((el) => el.scrollIntoView({ block: 'end' }));
    const von = (await griff10.boundingBox())!;
    const start = { x: von.x + von.width / 2, y: von.y + von.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    const punkt = (x: number, y: number) => [{ x, y, radiusX: 5, radiusY: 5, force: 1, id: 1 }];
    const scrollY = () => page.evaluate(() => window.scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punkt(start.x, start.y) });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: punkt(start.x, start.y - ((start.y - 60) * i) / 10) });
      await page.waitForTimeout(16);
    }
    const oben = await scrollY();
    await page.waitForTimeout(1000); // Finger bleibt am oberen Rand
    const nachEinerSekunde = await scrollY();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const strecke = oben - nachEinerSekunde;
    expect(strecke).toBeGreaterThan(50); // die Liste scrollt mit
    expect(strecke).toBeLessThan(1000); // gebremst (vorher ≈ 2000 px/s, Review 01.11.)
    expect(nachUhrzeit(await karten(page))).toBe(true);
  });

  test('@ZP-100 ohne Ziehen: „Tauschen mit …“ an Spiel 6, Auswahl Spiel 3 – nach „Speichern“ Uhrzeiten getauscht, Liste nach Uhrzeit', async ({ page }) => {
    await oeffnen(page);
    const vorher = { s3: await zeitVon(page, 3), s6: await zeitVon(page, 6) };
    await tauscheMit(page, 6, 3);
    await expect(page.getByText('Spiele 6 und 3 getauscht')).toBeVisible();
    await page.getByTestId('schedule-edit-save').click();
    await expect(page.getByTestId('schedule-edit-start')).toBeVisible();
    // das gespeicherte Turnier kommt nach dem Speichern über den Speicher zurück (asynchron)
    await expect.poll(() => zeitVon(page, 6)).toBe(vorher.s3);
    expect(await zeitVon(page, 3)).toBe(vorher.s6);
    expect(nachUhrzeit(await karten(page))).toBe(true);
  });

  test('@ZP-101 der Tausch ist bis „Speichern“ Entwurf: eine zweite Seite sieht den alten Plan, nach „Speichern“ den neuen', async ({ page, context }) => {
    await oeffnen(page);
    const vorher = { s3: await zeitVon(page, 3), s6: await zeitVon(page, 6) };
    await tauscheMit(page, 6, 3);
    await expect(page.getByTestId('schedule-unsaved-count')).toHaveText('1 Änderung nicht gespeichert');

    const zweite = await context.newPage();
    await zweite.goto(`/#/tournament/${TOURNAMENT}/schedule`);
    await expect(zweite.getByTestId('schedule-edit-start')).toBeVisible();
    expect(await zeitVon(zweite, 6)).toBe(vorher.s6);

    await page.getByTestId('schedule-edit-save').click();
    await expect(page.getByTestId('schedule-edit-start')).toBeVisible();
    await zweite.goto('/#/');
    await oeffnen(zweite);
    await expect.poll(() => zeitVon(zweite, 6)).toBe(vorher.s3);
    expect(await zeitVon(zweite, 3)).toBe(vorher.s6);
  });

  test('@ZP-103 „Abbrechen“ fragt „1 Änderung verwerfen?“; „Verwerfen“ lässt den Spielplan wie vorher, auch nach Neuladen', async ({ page }) => {
    await oeffnen(page);
    const vorher = await karten(page);
    await tauscheMit(page, 6, 3);
    await page.getByTestId('schedule-edit-cancel').click();
    await expect(page.getByRole('dialog').getByText('1 Änderung verwerfen?')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Verwerfen' }).click();
    await expect(page.getByTestId('schedule-edit-start')).toBeVisible();
    expect(await karten(page)).toEqual(vorher);
    await page.goto('/#/');
    await oeffnen(page);
    await expect.poll(() => karten(page)).toEqual(vorher);
  });
});
