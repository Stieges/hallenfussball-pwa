/**
 * E2E: Cockpit am Laptop, Tablet und Handy ohne Scrollen, Rahmen im laufenden Spiel, Zeile „Nächstes“ (Plan PR 3, T2-UI LT-2/LT-3).
 * Saat: Spiel 1 FC Nord – SV Süd, Spiel 2 TSV Ost – FC West, Foul-Grenze 5. Szenarien: @SL-061 (alle Haupttasten ohne Scrollen, Liste daneben),
 * @SL-140 (schmaler Kopf, keine App-Navigation, keine Fußzeile, „Zurück“ zum Spielplan, Uhr läuft weiter), @SL-005/@SL-070 (Wiederanpfiff im
 * ersten Bildschirm), @SL-157/@SL-158 (Abpfiff halten, kurzer Tipp nicht), K2 (Offline-Hinweis verdeckt die Leiste nicht), K3 (Hinweis im Fluss
 * schiebt die Leiste nicht aus dem Bild), K4 (Tastenwiederholung der Haltetaste), K13 (fünf Knöpfe ≥ 44 px, nichts abgeschnitten),
 * @SL-155/@SL-156/@SL-160/@SL-161 (Zeile „Nächstes“).
 */
import { writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { tippeKarte, tippeZeitstrafe } from '../helpers/cockpitNeu';
import { abpfiffHaltenBisRueckfrage } from '../helpers/abpfiff';

const ID = 'e2e-laptop-cup';
const TEAMS = ['e1', 'e2', 'e3', 'e4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
const NAMEN = ['FC Nord', 'SV Süd', 'TSV Ost', 'FC West'];
const NAME_50 = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const FARBEN = ['#FFD700', '#1E56D9', '#2E8B57', '#C0392B'];
const PAARE: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
const BILDER = process.env.LT23_BILDER ?? '';

interface CupOptionen { namen?: readonly string[]; farben?: readonly string[]; minuten?: number; perioden?: number; pause?: number }

function cup({ namen = NAMEN, farben = FARBEN, minuten = 12, perioden = 2, pause = 1 }: CupOptionen = {}) {
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

async function bild(page: Page, name: string): Promise<void> {
  if (BILDER !== '') { writeFileSync(`${BILDER}/${name}.png`, await page.screenshot()); }
}

async function anpfeifen(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}/live`);
  await page.getByTestId('match-start-button').click({ timeout: 15000 });
  await expect(page.getByTestId('match-pause-button')).toBeVisible();
}

/** Unterkante eines Elements (px von oben) – ohne Scrollen sichtbar heißt: höchstens die Höhe des Fensters. */
async function unterkante(page: Page, testId: string): Promise<number> {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) { throw new Error(`${testId} nicht sichtbar`); }
  return Math.round(box.y + box.height);
}

const PFLICHT = ['scoreboard', 'goal-button-home', 'foul-button-home', 'penalty-button-home', 'card-button-home', 'goal-button-away', 'foul-button-away', 'penalty-button-away', 'card-button-away', 'match-pause-button', 'match-finish-button', 'match-undo-button'];

test.describe('Cockpit ohne Scrollen und im Rahmen (Gast, lokal)', () => {
  test.beforeEach(async ({ browserName: _b }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
  });

  test('@SL-061 schwerer Fall: Name mit 50 Zeichen, zwei Zeitstrafen je Team, Rote Karte – Uhr, Stand und alle Haupttasten ohne Scrollen, Liste daneben bzw. über „Ereignisse“', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ namen: [NAME_50, NAMEN[1], NAMEN[2], NAMEN[3]] })] });
    await anpfeifen(page);
    for (const seite of ['home', 'away'] as const) { await tippeZeitstrafe(page, seite); await tippeZeitstrafe(page, seite); }
    await tippeKarte(page, 'home', 'Rot', 7);
    await bild(page, `${testInfo.project.name}-schwer`);

    const hoehe = page.viewportSize()?.height ?? 0;
    for (const id of PFLICHT) { expect(await unterkante(page, id), `${id} liegt im Bild`).toBeLessThanOrEqual(hoehe); }
    const mass = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, ih: window.innerHeight, w: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(mass.h).toBeLessThanOrEqual(mass.ih);
    expect(mass.w).toBeLessThanOrEqual(mass.iw);
    // Die Leiste verdeckt keine Taste: die Tasten liegen über der Oberkante der Leiste
    const leiste = await page.getByRole('toolbar').boundingBox();
    for (const id of ['goal-button-home', 'foul-button-home', 'penalty-button-home', 'card-button-home']) {
      expect(await unterkante(page, id), `${id} unter der Leiste`).toBeLessThanOrEqual(Math.round((leiste?.y ?? 0) + 1));
    }
    const breit = (page.viewportSize()?.width ?? 0) >= 1024;
    if (breit) {
      await expect(page.getByTestId('match-event-log-button')).toHaveCount(0);
      await expect(page.getByTestId('cockpit-flaeche').getByText('Ereignisse', { exact: true })).toBeVisible();
    } else {
      await page.getByTestId('match-event-log-button').click();
      await expect(page.getByTestId('event-log-sheet')).toBeVisible();
    }
  });

  test('@SL-061 Laptop: der Inhaltsbereich selbst scrollt nicht (normaler Fall: Uhr, Stand, Tor-Knöpfe und Spalten stehen ohne Scrollen)', async ({ page, seedIndexedDB }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'nur Laptop-Anordnung');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await tippeZeitstrafe(page, 'home');
    const ueberstand = await page.locator('[data-testid="live-cockpit"] > main').evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(ueberstand, 'Inhaltsbereich scrollt nicht').toBeLessThanOrEqual(1);
  });

  test('@SL-061 Laptop, schwerer Fall: der Inhaltsbereich selbst scrollt nicht – C-COCKPIT-LAPTOP-SCROLLT-IM-SCHWERSTEN-FALL', async ({ page, seedIndexedDB }) => {
    // Befund C-COCKPIT-LAPTOP-SCROLLT-IM-SCHWERSTEN-FALL (Lösung nach #298/#288, spätestens im Cockpit-Abschluss): bei 1280 × 720 fehlen im schwersten Fall (50-Zeichen-Name in Tafel und Spalte, vier Zeitstrafen, Meldezeile) rund 40 px
    test.fail((page.viewportSize()?.height ?? 0) < 740, 'schwerster Fall passt bei 720 px Höhe noch nicht ganz ohne Scrollen des Inhaltsbereichs');
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'nur Laptop-Anordnung');
    await seedIndexedDB({ tournaments: [cup({ namen: [NAME_50, NAMEN[1], NAMEN[2], NAMEN[3]] })] });
    await anpfeifen(page);
    for (const seite of ['home', 'away'] as const) { await tippeZeitstrafe(page, seite); await tippeZeitstrafe(page, seite); }
    await tippeKarte(page, 'home', 'Rot', 7);
    const ueberstand = await page.locator('[data-testid="live-cockpit"] > main').evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(ueberstand, 'Inhaltsbereich scrollt nicht').toBeLessThanOrEqual(1);
  });

  test('@SL-005 @SL-070 Halbzeit: der Wiederanpfiff liegt im ersten Bildschirm, kein Abpfiff in der Pause', async ({ page, seedIndexedDB }, testInfo) => {
    test.setTimeout(120_000);
    await seedIndexedDB({ tournaments: [cup({ minuten: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('scoreboard-state')).toContainText('Halbzeit', { timeout: 60_000 });
    const wieder = page.getByTestId('match-wiederanpfiff-button');
    await expect(wieder).toBeVisible();
    expect(await unterkante(page, 'match-wiederanpfiff-button')).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
    await expect(page.getByTestId('match-finish-button')).toHaveCount(0);
    await bild(page, `${testInfo.project.name}-halbzeit`);
  });

  test('@SL-140 Rahmen: schmaler Kopf, keine App-Navigation, keine Fußzeile, keine Spielauswahl; „Zurück“ zeigt den Spielplan mit App-Navigation, die Uhr läuft weiter', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-slim-header')).toBeVisible();
    await expect(page.getByTestId('cockpit-turniername')).toHaveText('Cockpit-Cup Laptop');
    await expect(page.getByTestId('cockpit-verbindung')).toBeVisible();
    await expect(page.getByTestId('desktop-tab-spielplan')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: /Spiel/ })).toHaveCount(0);

    const rest = async () => (await page.getByTestId('scoreboard-clock-sub').textContent()) ?? '';
    const vorher = await rest();
    await page.getByTestId('cockpit-zurueck').click();
    await expect(page).toHaveURL(new RegExp(`/tournament/${ID}/schedule$`));
    await expect(page.getByTestId('cockpit-slim-header')).toHaveCount(0);
    await expect(page.locator('footer')).toBeVisible();
    await page.waitForTimeout(2500);
    await page.goto(`/#/tournament/${ID}/live`);
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await expect.poll(rest).not.toBe(vorher);
  });

  test('K2 ohne Netz verdeckt kein Hinweis die Leiste: Pause, Abpfiff und Rückgängig sind antippbar; im Spielplan bleibt der Hinweis', async ({ page, context, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await context.setOffline(true);
    await expect(page.getByTestId('cockpit-verbindung')).toHaveAttribute('data-online', 'false');
    await expect(page.getByTestId('offline-banner')).toHaveCount(0);
    for (const id of ['match-pause-button', 'match-finish-button', 'match-undo-button']) {
      const treffer = await page.getByTestId(id).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const oben = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return oben !== null && el.contains(oben);
      });
      expect(treffer, `${id} liegt frei`).toBe(true);
    }
    await page.getByTestId('cockpit-zurueck').click();
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await context.setOffline(false);
  });

  test('K3 ein Hinweis im Fluss über dem Cockpit schiebt die Leiste nicht aus dem Bild', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.evaluate(() => {
      const wurzel = document.getElementById('root')?.firstElementChild;
      const hinweis = document.createElement('div');
      hinweis.setAttribute('data-testid', 'sw-update-notice');
      hinweis.style.cssText = 'flex:none;height:56px;background:#fc0;color:#000';
      hinweis.textContent = 'Update verfügbar';
      wurzel?.prepend(hinweis);
    });
    await expect(page.getByTestId('sw-update-notice')).toBeVisible();
    const hoehe = page.viewportSize()?.height ?? 0;
    const leiste = await page.getByRole('toolbar').boundingBox();
    expect(Math.round((leiste?.y ?? 0) + (leiste?.height ?? 0))).toBeLessThanOrEqual(hoehe);
    const mass = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, ih: window.innerHeight }));
    expect(mass.h).toBeLessThanOrEqual(mass.ih);
  });

  test('K13 @SL-157 am Handy: fünf Leisten-Knöpfe je mindestens 44 px breit, „Abpfiff halten“ nicht abgeschnitten', async ({ page, seedIndexedDB }) => {
    test.skip((page.viewportSize()?.width ?? 0) > 400, 'nur Handy-Breite');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    const knoepfe = await page.getByRole('toolbar').getByRole('button').evaluateAll((els) => els.map((e) => ({ w: e.getBoundingClientRect().width, abgeschnitten: e.scrollWidth > e.clientWidth + 1 })));
    expect(knoepfe).toHaveLength(5);
    for (const k of knoepfe) { expect(k.w).toBeGreaterThanOrEqual(44); expect(k.abgeschnitten).toBe(false); }
  });

  test('@SL-157 @SL-158 Abpfiff halten fragt nach, ein kurzer Klick nicht; Weiterspielen beendet nichts', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.getByTestId('match-finish-button').click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await abpfiffHaltenBisRueckfrage(page);
    await expect(page.getByRole('alertdialog')).toContainText('Spiel 1 bei noch');
    await page.getByTestId('finish-confirm-weiter').click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
  });

  test('@SL-167 K4 Tastenwiederholung: Leertaste auf „Abpfiff“ halten, die Rückfrage erscheint und bleibt trotz weiter gedrückter Taste offen', async ({ page, seedIndexedDB }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Tastatur am Laptop');
    await seedIndexedDB({ tournaments: [cup()] });
    await anpfeifen(page);
    await page.getByTestId('match-finish-button').focus();
    await page.keyboard.down(' ');
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 3000 });
    await page.waitForTimeout(600);
    await page.keyboard.down(' '); // Wiederholung des Betriebssystems
    await page.keyboard.up(' ');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByTestId('scoreboard-state')).toContainText('Live');
  });

  test('@SL-156 vor den letzten drei Minuten bleibt die Zeile „Nächstes“ ruhig', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ minuten: 4, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).toHaveAttribute('data-modus', 'normal');
  });

  test('@SL-155 Restzeit 3:00: der Rahmen der Zeile „Nächstes“ ist hervorgehoben und blinkt, Uhr und Stand bleiben unverdeckt', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ minuten: 3, perioden: 1 })] });
    await anpfeifen(page);
    const zeile = page.getByTestId('cockpit-naechstes');
    await expect(zeile).toHaveAttribute('data-modus', 'vorwarnung');
    await expect(zeile).toHaveAttribute('data-blinken', 'true');
    await expect(zeile).toHaveCSS('border-top-width', '2px');
    const tafel = await page.getByTestId('scoreboard').boundingBox();
    const z = await zeile.boundingBox();
    expect((tafel?.y ?? 0) + (tafel?.height ?? 0)).toBeLessThanOrEqual((z?.y ?? 0) + 1);
    await bild(page, `${testInfo.project.name}-vorwarnung`);
  });

  test('@SL-156 „Bewegung reduzieren“: ab 3:00 hervorgehoben, ohne zu blinken', async ({ page, seedIndexedDB }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedIndexedDB({ tournaments: [cup({ minuten: 3, perioden: 1 })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).toHaveAttribute('data-modus', 'vorwarnung');
    await expect(page.getByTestId('cockpit-naechstes')).not.toHaveAttribute('data-blinken', 'true');
  });

  test('@SL-160 Rot/Weiß: zwei Farbpunkte, kein Leibchen-Zeichen', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ farben: [FARBEN[0], FARBEN[1], '#C62828', '#FFFFFF'] })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes')).toContainText('TSV Ost');
    await expect(page.getByTestId('cockpit-naechstes-punkt-0')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-punkt-1')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toHaveCount(0);
  });

  test('@SL-160 Blau/Navy: Leibchen-Zeichen ohne Text', async ({ page, seedIndexedDB }, testInfo) => {
    await seedIndexedDB({ tournaments: [cup({ farben: [FARBEN[0], FARBEN[1], '#1565C0', '#0D1B4C'] })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toHaveText('');
    await bild(page, `${testInfo.project.name}-leibchen`);
  });

  test('@SL-161 ohne festgelegte Trikotfarbe steht nur der Name', async ({ page, seedIndexedDB }) => {
    await seedIndexedDB({ tournaments: [cup({ farben: [FARBEN[0], FARBEN[1], '#C62828', ''] })] });
    await anpfeifen(page);
    await expect(page.getByTestId('cockpit-naechstes-punkt-0')).toBeVisible();
    await expect(page.getByTestId('cockpit-naechstes-punkt-1')).toHaveCount(0);
    await expect(page.getByTestId('cockpit-naechstes')).toContainText('FC West');
    await expect(page.getByTestId('cockpit-naechstes-leibchen')).toHaveCount(0);
  });
});
