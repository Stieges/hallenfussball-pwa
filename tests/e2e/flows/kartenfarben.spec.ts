/**
 * E2E: Karten-Farben nur für Karten (Oberfläche E, Befund C-KARTE-GELB-ALS-WARNFARBE; Regel T2-UI).
 * Ablauf: Anpfiff -> Gelbe Karte, Gelb-Rote Karte und Rote Karte, Zeitstrafe und Foul -> im Verlauf je Karte das Kartensymbol in
 * Kartenfarbe (berechneter Hintergrund = aufgelöstes cardYellow/cardRed, hell und dunkel gleich), kein Farb-Emoji; Zeitstrafe ohne
 * Kartensymbol, Foul mit neutralem Text-Glyph statt gelbem Emoji (@SL-084).
 */
import { test, expect } from '../helpers/test-fixtures';
import type { Locator, Page } from '@playwright/test';
import { tippeKarte, tippeZeitstrafe } from '../helpers/cockpitNeu';

const ID = 'e2e-kartenfarben-cup';
const TEAMS = ['e1', 'e2', 'e3', 'e4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
const NAMEN = ['FC Nord', 'SV Süd', 'TSV Ost', 'FC West'];
const PAARE: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];

function cup() {
  const date = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    id: ID, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 12, groupPhaseBreakDuration: 2, gameDuration: 12, breakDuration: 2, gamePeriods: 2, halftimeBreak: 1,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'Kartenfarben-Cup', ageClass: 'U12', date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00',
    location: { name: 'Test-Halle' },
    teams: TEAMS.map((id, i) => ({ id, name: NAMEN[i], group: 'A' })),
    matches: PAARE.map(([a, b], i) => ({
      id: `00000000-0000-4000-8000-0000000009${i + 10}`, matchNumber: i + 1, round: i + 1, field: 1, group: 'A', phase: 'groupStage',
      slotA: { kind: 'team', teamId: TEAMS[a] }, slotB: { kind: 'team', teamId: TEAMS[b] }, matchStatus: 'scheduled',
      scheduledTime: `${date}T${String(10 + Math.floor(i / 5)).padStart(2, '0')}:${String((i % 5) * 12).padStart(2, '0')}:00.000Z`,
    })),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

/** Berechneter Hintergrund einer Fläche, die mit dem Token gefüllt ist (Token aufgelöst, nie eine zweite Zahl im Test). */
async function tokenFarbe(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${t})`;
    document.body.appendChild(probe);
    const farbe = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return farbe;
  }, token);
}

const sichtbar = (page: Page, art: string): Locator => page.getByTestId(`karten-symbol-${art}`).filter({ visible: true });

async function hintergrund(symbol: Locator): Promise<{ farbe: string; bild: string }> {
  return symbol.first().evaluate((el) => {
    const stil = getComputedStyle(el);
    return { farbe: stil.backgroundColor, bild: stil.backgroundImage };
  });
}

test.describe('Karten-Farben nur für Karten (Oberfläche E): Verlauf im Cockpit (Gast, lokal)', () => {
  test.beforeEach(async ({ page, seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie cockpit-s3.spec.ts)');
    test.skip(testInfo.project.name === 'tablet-portrait', 'Befund C-COCKPIT-TABLET-OHNE-PROTOKOLL: Verlauf dort nicht erreichbar');
    await seedIndexedDB({ tournaments: [cup()] });
    await expect(page.getByText('Kartenfarben-Cup')).toBeVisible({ timeout: 15000 });
  });

  test('@SL-084 Karten-Farben nur für Karten (Oberfläche E): Gelb cardYellow, Rot cardRed, Gelb-Rot beide; Zeitstrafe und Foul ohne Kartenfarbe', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/live`);
    await page.getByTestId('match-start-button').click({ timeout: 15000 });
    await expect(page.getByTestId('match-pause-button')).toBeVisible();

    await tippeKarte(page, 'home', 'Gelb', 9);
    await tippeKarte(page, 'away', 'Gelb-Rot', 5);
    await tippeKarte(page, 'home', 'Rot', 3);
    await tippeZeitstrafe(page, 'away');
    await page.getByTestId('foul-button-away').click();

    // Handy: der Verlauf liegt hinter dem Knopf „Ereignisse“; Desktop zeigt die Seitenleiste
    if ((page.viewportSize()?.width ?? 0) < 768) {
      await page.getByTestId('match-event-log-button').click();
    }

    for (const schema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: schema });
      const gelb = await tokenFarbe(page, '--color-card-yellow');
      const rot = await tokenFarbe(page, '--color-card-red');

      await expect(sichtbar(page, 'YELLOW')).toHaveCount(1, { timeout: 10_000 });
      expect((await hintergrund(sichtbar(page, 'YELLOW'))).farbe).toBe(gelb);

      await expect(sichtbar(page, 'RED')).toHaveCount(1);
      expect((await hintergrund(sichtbar(page, 'RED'))).farbe).toBe(rot);

      await expect(sichtbar(page, 'YELLOW_RED')).toHaveCount(1);
      const gelbRot = await hintergrund(sichtbar(page, 'YELLOW_RED'));
      expect(gelbRot.bild).toContain('linear-gradient');
      expect(gelbRot.bild).toContain(gelb);
      expect(gelbRot.bild).toContain(rot);
    }

    // Gegenbeispiele: genau drei Kartensymbole (Zeitstrafe und Foul haben keins), kein Farb-Emoji im Verlauf, Foul als neutrales Text-Glyph
    await expect(page.getByTestId(/^karten-symbol-/).filter({ visible: true })).toHaveCount(3);
    const text = (await page.locator('body').innerText());
    expect(text).not.toMatch(/\u{1F7E8}|\u{1F7E5}/u);
    // Die Foul-Zeile (Seitenleiste: Symbol und Text in einem Element, Handy: Symbol allein) trägt das neutrale Text-Glyph, nie das gelbe Emoji
    await expect(page.locator('span').filter({ hasText: '\u26A0\uFE0E' }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^\u26A0\uFE0F\s*Foul/ }).filter({ visible: true })).toHaveCount(0);
  });
});
