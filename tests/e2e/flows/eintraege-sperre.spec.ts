/**
 * A-08f3e4 Fixrunde 1 (I-2, T2-UI b): Sperren und Hinweise im Gastmodus, Einträge entstehen über das Cockpit
 * (anpfeifen, Tor, abpfeifen). Szenarien `plattform/2026-09-24_fundament-gemeinsamer-stand.md`:
 * @FU-090 (Einstellungen „Ergebnisse zurücksetzen“ und Assistent „neu erzeugen“ mit Einträgen nicht ausgeführt, Text wörtlich),
 * @FU-091 (Wiederherstellen: Ergebnis von Spielen mit Einträgen bleibt, Hinweis „Bei 1 Spiel mit Einträgen …“).
 * Gegenbeispiele: dasselbe Turnier ohne Einträge → Rückfrage bzw. Neuplanung wie heute.
 * Bilder (nur mit `A08F3_BILDER=<Ordner>`): Vorher/Nachher je Fall, 360/1280, hell/dunkel.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { schliesseTorAuswahl } from '../helpers/cockpitNeu';

import { abpfiffHalten } from '../helpers/abpfiff';
const ID = 'e2e-eintraege-cup';
const SPERRE = /Spiel \d+ hat Einträge – nur über Spielplan auf Anfang setzen/;
const TEAMS = ['e1', 'e2', 'e3', 'e4'].map((n) => `00000000-0000-4000-8000-0000000000${n}`);
const PAARE: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];

function liveCup() {
  const date = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  return {
    id: ID, status: 'published', publishedAt: new Date().toISOString(), sport: 'football', sportId: 'football-indoor',
    tournamentType: 'classic', mode: 'classic', numberOfFields: 1, numberOfTeams: 4, numberOfGroups: 1, groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, gameDuration: 10, breakDuration: 2,
    placementLogic: ['points', 'goalDifference', 'goalsFor'], finals: { enabled: false }, isKidsTournament: false,
    hideScoresForPublic: false, hideRankingsForPublic: false, resultMode: 'goals', pointSystem: { win: 3, draw: 1, loss: 0 },
    title: 'Live-Cup Einträge', ageClass: 'U12', date, timeSlot: '10:00 - 14:00', startDate: date, startTime: '10:00',
    location: { name: 'Test-Halle' },
    teams: TEAMS.map((id, i) => ({ id, name: `FC Test ${'ABCD'[i]}`, group: 'A' })),
    // Gespeicherter Spielplan wie nach dem Veröffentlichen (Einträge hängen an echten Spiel-IDs)
    matches: PAARE.map(([a, b], i) => ({
      id: `00000000-0000-4000-8000-0000000009${i + 10}`, matchNumber: i + 1, round: i + 1, field: 1, group: 'A', phase: 'groupStage',
      slotA: { kind: 'team', teamId: TEAMS[a] }, slotB: { kind: 'team', teamId: TEAMS[b] }, matchStatus: 'scheduled',
      scheduledTime: `${date}T${String(10 + Math.floor(i / 5)).padStart(2, '0')}:${String((i % 5) * 12).padStart(2, '0')}:00.000Z`,
    })),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

async function bild(page: Page, name: string): Promise<void> {
  const dir = process.env.A08F3_BILDER;
  if (!dir) { return; }
  const size = page.viewportSize()?.width ?? 0;
  await page.waitForTimeout(800); // Einblend-Animation des Hinweises abwarten (nur für Bilder)
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.screenshot({ path: `${dir}/${name}-${size}-${scheme}.png` });
  }
  await page.emulateMedia({ colorScheme: 'light' });
}

/** Spiel 1 im Cockpit: anpfeifen, Tor für das Heimteam, abpfeifen (Gast: Einträge lokal bestätigt). */
async function spielMitEintraegen(page: Page): Promise<void> {
  await page.goto(`/#/tournament/${ID}/live`);
  await page.getByTestId('match-start-button').click({ timeout: 15000 });
  await expect(page.getByTestId('match-pause-button')).toBeVisible();
  await page.getByTestId('goal-button-home').click();
  await schliesseTorAuswahl(page);
  await page.getByTestId('match-pause-button').click();
  await abpfiffHalten(page);
  const confirm = page.locator('[role="dialog"] button').filter({ hasText: /Beenden|Bestätigen|Ja/i });
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) { await confirm.first().click(); }
  await expect(page.getByTestId('scoreboard-state')).toHaveText(/Abgepfiffen|Vor Anpfiff/i); // Tafel (Cockpit 2.4/2.5): nach dem Abpfiff steht Spiel 1 abgepfiffen oder die Tafel zeigt schon das nächste Spiel
}

test.describe('A-08f3e4 Sperren mit Einträgen (Gast)', () => {
  test.beforeEach(async ({ page, seedIndexedDB }, testInfo) => {
    test.skip(testInfo.project.name.includes('iPhone'), 'Safe-Area-Emulation verdeckt Tasten (wie live-cockpit.spec.ts)');
    await seedIndexedDB({ tournaments: [liveCup()] });
    await expect(page.getByText('Live-Cup Einträge')).toBeVisible({ timeout: 15000 });
  });

  test('@FU-090 Einstellungen „Spielplan zurücksetzen“ mit Einträgen → Hinweis wörtlich, keine Rückfrage', async ({ page }) => {
    await spielMitEintraegen(page);
    await page.goto(`/#/tournament/${ID}/admin/danger-zone`);
    await bild(page, 'dangerzone-vorher');
    await page.getByRole('button', { name: /Spielplan zurücksetzen/i }).first().click();

    await expect(page.getByText(SPERRE)).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await bild(page, 'dangerzone-sperre');
  });

  test('@FU-090 Gegenbeispiel: ohne Einträge öffnet die Rückfrage mit dem Bestätigungswort', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/admin/danger-zone`);
    await page.getByRole('button', { name: /Spielplan zurücksetzen/i }).first().click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(SPERRE)).toHaveCount(0);
  });

  test('@FU-090 Assistent „neu erzeugen“ (Neuplanung) mit Einträgen → Hinweis wörtlich, keine Neuplanung', async ({ page }) => {
    await spielMitEintraegen(page);
    await page.goto(`/#/tournament/${ID}/edit?step=6`);
    await bild(page, 'assistent-vorher');
    await page.getByTestId('wizard-show-preview').click({ timeout: 15000 });

    await expect(page.getByText(SPERRE)).toBeVisible();
    await expect(page.getByTestId('replan-end-time')).toHaveCount(0);
    await bild(page, 'assistent-sperre');
  });

  test('@FU-090 Gegenbeispiel: Assistent ohne Einträge → Neuplanung wie heute', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/edit?step=6`);
    await page.getByTestId('wizard-show-preview').click({ timeout: 15000 });

    await expect(page.getByText(SPERRE)).toHaveCount(0);
    await expect(page.locator('[data-testid="replan-end-time"], [data-testid^="replan-"]').first()).toBeVisible();
  });

  test('@FU-091 Sicherung wiederherstellen → Spiel mit Einträgen behält sein Ergebnis, Hinweis „Bei 1 Spiel …“', async ({ page }) => {
    await spielMitEintraegen(page);
    await page.goto(`/#/tournament/${ID}/admin/exports`);
    await bild(page, 'wiederherstellen-vorher');
    const sicherung = { version: '1.0', exportedAt: new Date().toISOString(), tournament: liveCup() };
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'sicherung.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sicherung)) });

    await expect(page.getByText('Bei 1 Spiel mit Einträgen wurde das Ergebnis nicht wiederhergestellt')).toBeVisible();
    await bild(page, 'wiederherstellen-hinweis');
  });

  test('@FU-091 Gegenbeispiel: ohne Einträge kein Hinweis', async ({ page }) => {
    await page.goto(`/#/tournament/${ID}/admin/exports`);
    const sicherung = { version: '1.0', exportedAt: new Date().toISOString(), tournament: liveCup() };
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'sicherung.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(sicherung)) });

    await expect(page.getByText('Turnier erfolgreich wiederhergestellt!')).toBeVisible();
    await expect(page.getByText(/mit Einträgen/)).toHaveCount(0);
  });
});
