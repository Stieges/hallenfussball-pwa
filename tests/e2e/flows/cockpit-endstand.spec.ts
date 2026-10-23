/**
 * E2E: Endstand nach dem Abpfiff (B-10a, Befund C-COCKPIT-ENDSTAND-NACH-AUTOENDE; T2-UI (b)).
 * Ablauf: Anpfiff -> Tor FC Nord -> Abpfiff (von Hand, derselbe Weg zum Endstand wie das Ende von selbst) -> 30 Sekunden Endstand
 * mit dem nächsten Spiel darunter -> „Weiter“ wechselt sofort / nach 30 Sekunden von selbst / Neu laden hält den Rest der Frist.
 * Szenarien: @SL-073 (deutlich abgepfiffen, mit Endstand), @SL-152 (30 Sekunden, „Abgepfiffen · 1:0 gespeichert“, nie 0:0 neben „Ende“),
 * @SL-162 („Weiter“ sofort), @SL-049 (nach 30 Sekunden von selbst das nächste Spiel), @SL-116 (die Frist hängt am Abpfiff, nicht am Gerät), @SL-159 (kein Helfer-Hinweis für die Turnierleitung).
 * Gemessen wird in den Projekten desktop (1280×720) und cockpit-360x640 (Handy). Bilder nur, wenn B10A_BILDER gesetzt ist.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { wartePicker } from '../helpers/cockpitNeu';
import { abpfiffHalten } from '../helpers/abpfiff';

const ID = 'e2e-endstand-cup';
const TEAMS = ['e1', 'e2', 'e3', 'e4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
const NAMEN = ['FC Nord', 'SV Süd', 'TSV Ost', 'FC West'];
const PAARE: Array<[number, number]> = [[0, 1], [2, 3], [0, 2]];

function cup() {
  const date = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    id: ID, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 12, groupPhaseBreakDuration: 2, gameDuration: 12, breakDuration: 2, gamePeriods: 2, halftimeBreak: 1,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'Endstand-Cup', ageClass: 'U12', date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00',
    location: { name: 'Test-Halle' },
    teams: TEAMS.map((id, i) => ({ id, name: NAMEN[i], group: 'A' })),
    matches: PAARE.map(([a, b], i) => ({
      id: `00000000-0000-4000-8000-0000000009${i + 10}`, matchNumber: i + 1, round: i + 1, field: 1, group: 'A', phase: 'groupStage',
      slotA: { kind: 'team', teamId: TEAMS[a] }, slotB: { kind: 'team', teamId: TEAMS[b] }, matchStatus: 'scheduled',
      scheduledTime: `${date}T10:${String(i * 12).padStart(2, '0')}:00.000Z`,
    })),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

async function bild(page: Page, name: string, projekt: string): Promise<void> {
  const ordner = process.env.B10A_BILDER;
  if (ordner) { await page.screenshot({ path: `${ordner}/${name}-v2-${projekt}.png` }); }
}

/** B-10a2: Bilder der Tafel und Zusammenfassung nach dem Ende, nur wenn B10A2_BILDER gesetzt ist. */
async function bild2(page: Page, name: string, projekt: string): Promise<void> {
  const ordner = process.env.B10A2_BILDER;
  if (ordner) { await page.screenshot({ path: `${ordner}/${name}-${projekt}.png` }); }
}

/** Spiel 1 anpfeifen, ein Tor für FC Nord, von Hand abpfeifen: danach steht der Endstand 1:0. */
async function pfeifeAb(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}/live`);
  await page.getByTestId('match-start-button').click({ timeout: 15000 });
  await expect(page.getByTestId('match-pause-button')).toBeVisible();
  await page.getByTestId('goal-button-home').click();
  await expect(page.getByTestId('scoreboard-box-links')).toHaveText('1');
  await wartePicker(page);
  await page.keyboard.press('Escape');
  await abpfiffHalten(page);
}

async function pruefeEndstand(page: Page): Promise<void> {
  await expect(page.getByTestId('scoreboard-state')).toContainText('Ende');
  await expect(page.getByTestId('team-name-home')).toHaveText('FC Nord');
  await expect(page.getByTestId('scoreboard-score')).toHaveText('1:0');
  await expect(page.getByTestId('scoreboard-quittung')).toHaveText('Abgepfiffen · 1:0 gespeichert');
  // nie die Anstoßzeit oder 0:0 des nächsten Spiels neben „Ende“
  await expect(page.getByTestId('scoreboard-clock')).not.toContainText('Anstoß');
  await expect(page.getByTestId('scoreboard-box-links')).toHaveText('1');
  // @SL-159: die Turnierleitung (lokal der Eigentümer) sieht nicht den Helfer-Hinweis „Korrektur über die Turnierleitung“
  await expect(page.getByTestId('bar-finished')).toHaveCount(0);
  await expect(page.getByTestId('match-next-button')).toBeVisible();
  // darunter das nächste Spiel mit beiden Teams
  await expect(page.getByTestId('cockpit-naechstes')).toContainText('TSV Ost');
  await expect(page.getByTestId('cockpit-naechstes')).toContainText('FC West');
}

test.describe('Cockpit: Endstand nach dem Abpfiff (B-10a)', () => {
  test.beforeEach(async ({ seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
    await seedIndexedDB({ tournaments: [cup()] });
  });

  test('@SL-073 @SL-152 @SL-162 nach dem Abpfiff steht der Endstand mit dem nächsten Spiel darunter; „Weiter“ wechselt sofort', async ({ page }, testInfo) => {
    await pfeifeAb(page);
    await pruefeEndstand(page);
    await bild(page, 'endstand', testInfo.project.name);
    // die Seite bleibt stehen, bis jemand weitertippt (kein Wechsel nach 2 Sekunden)
    await page.waitForTimeout(2000);
    await pruefeEndstand(page);

    await page.getByTestId('match-next-button').click();
    await expect(page.getByTestId('team-name-home')).toHaveText('TSV Ost');
    await expect(page.getByTestId('team-name-away')).toHaveText('FC West');
    await expect(page.getByTestId('scoreboard-state')).toBeEmpty();
    await expect(page.getByTestId('scoreboard-quittung')).toHaveCount(0);
    await expect(page.getByTestId('match-start-button')).toBeVisible();
    await bild(page, 'weiter-naechstes', testInfo.project.name);
  });

  test('@SL-049 @SL-116 Neu laden hält den Rest der Frist; nach 30 Sekunden zeigt das Cockpit von selbst das nächste Spiel', async ({ page }) => {
    test.setTimeout(90_000);
    await pfeifeAb(page);
    await pruefeEndstand(page);
    await page.reload();
    await expect(page.getByTestId('scoreboard')).toBeVisible({ timeout: 15000 });
    await pruefeEndstand(page); // die Frist hängt am Abpfiff-Zeitpunkt, nicht an dieser Seite
    await expect(page.getByTestId('team-name-home')).toHaveText('TSV Ost', { timeout: 40_000 });
    await expect(page.getByTestId('scoreboard-state')).toBeEmpty();
    await expect(page.getByTestId('scoreboard-quittung')).toHaveCount(0);
    await expect(page.getByTestId('match-start-button')).toBeVisible();
  });

  // B-10a2: Zusammenfassung statt Tastenblöcke, Tafel mit „Gespielt … von …“, „Korrigieren“ für die Turnierleitung (lokal der Eigentümer)
  test('@SL-169 @SL-048 @SL-115 @SL-159 nach dem Ende: Tafel „Gespielt … von 12:00“, Zusammenfassung je Team, „Korrigieren“ öffnet die Korrektur', async ({ page }, testInfo) => {
    await pfeifeAb(page);
    await pruefeEndstand(page);
    // @SL-169: kein Abschnitt neben „Ende“, „Gespielt“ statt „Spielzeit“, vorzeitig mit „von 12:00“ (zwei Abschnitte zu 6 Minuten)
    await expect(page.getByTestId('scoreboard')).not.toContainText(/Halbzeit/);
    await expect(page.getByTestId('scoreboard-clock')).toContainText('Gespielt');
    await expect(page.getByTestId('scoreboard-clock-sub')).toHaveText('von 12:00');
    // @SL-048: Zusammenfassung statt Tasten
    await expect(page.getByTestId('team-summary-home')).toContainText('Tore (1)');
    await expect(page.getByTestId('team-summary-away')).toContainText('Tore (0): keine');
    await expect(page.getByTestId('team-summary-home')).toContainText('Fouls: 0');
    await expect(page.getByTestId('goal-button-home')).toHaveCount(0);
    await expect(page.getByTestId('foul-button-home')).toHaveCount(0);
    // @SL-159: „Korrigieren“ öffnet die Korrektur mit dem bisherigen Ergebnis; ohne Änderung bleibt „Weiter“ gesperrt
    await bild2(page, 'leitung-vorzeitig', testInfo.project.name);
    await page.getByTestId('match-correct-button').click();
    await expect(page.getByTestId('cockpit-korrektur-dialog')).toBeVisible();
    await expect(page.getByTestId('cockpit-korrektur-home')).toHaveValue('1');
    await expect(page.getByTestId('cockpit-korrektur-weiter')).toBeDisabled();
    await bild2(page, 'leitung-korrigieren-dialog', testInfo.project.name);
    await page.getByTestId('cockpit-korrektur-home').fill('0');
    await page.getByTestId('cockpit-korrektur-weiter').click();
    await expect(page.getByTestId('result-entry-reason-dialog')).toBeVisible(); // Grundpflicht: ohne Grund wird nichts gespeichert
    await bild2(page, 'leitung-korrigieren-grund', testInfo.project.name);
    await page.getByTestId('result-entry-cancel').click();
    await expect(page.getByTestId('scoreboard-score')).toHaveText('1:0'); // Abbruch ändert nichts
    // @SL-115: nach dem Neuladen steht die Zusammenfassung für den Rest der Frist wieder da
    await page.reload();
    await expect(page.getByTestId('scoreboard')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('team-summary-home')).toContainText('Tore (1)');
    await expect(page.getByTestId('match-correct-button')).toBeVisible();
  });

  test('@SL-169 Gegenbeispiel: im laufenden Spiel stehen die Tasten, kein „Gespielt“, keine Zusammenfassung, kein „Korrigieren“', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/live`);
    await page.getByTestId('match-start-button').click({ timeout: 15000 });
    await expect(page.getByTestId('match-pause-button')).toBeVisible();
    await expect(page.getByTestId('goal-button-home')).toBeVisible();
    await expect(page.getByTestId('team-summary-home')).toHaveCount(0);
    await expect(page.getByTestId('match-correct-button')).toHaveCount(0);
    await expect(page.getByTestId('scoreboard-clock')).not.toContainText('Gespielt');
  });
});
