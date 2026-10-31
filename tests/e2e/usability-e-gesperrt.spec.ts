/**
 * Usability E (Handy 360×640 und 390×844, Prüfbericht 2026-10-30): @W5-036 gesperrte Felder nennen Grund und nur einen Weg, den es gibt;
 * @OB-043 Pause schreibgeschützt wie die Spielzeit. Vorher: „Diese Zeit lässt sich hier nicht ändern.“ ohne Grund und Weg; Struktur-Info
 * „können nicht mehr geändert werden“ auch vor dem Anpfiff. Bilder: Ordner aus UE_SCR (sonst im Testergebnis-Ordner). Nur Projekt `desktop`.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/test-fixtures';
import { buildVisualTournament } from './visual/helpers';

const ID = 'ue-tournament';
const GERAETE = [
  { name: 'handy-360x640', width: 360, height: 640 },
  { name: 'handy-390x844', width: 390, height: 844 },
] as const;
const TEAMS = ['FC Nordstadt', 'SV Südpark', 'TSV Westtal', 'BSC Ostring'].map((name, i) => ({ id: `00000000-0000-4000-8000-0000000000d${i + 1}`, name }));

const turnier = () => buildVisualTournament({
  id: ID,
  title: 'Hallencup Süd',
  matches: [{ id: 'ue-match-1', round: 1, teamA: TEAMS[0].id, teamB: TEAMS[1].id, field: 1, matchStatus: 'scheduled' as const, scheduledTime: '2026-03-14T09:00:00.000Z' }],
  extra: { teams: TEAMS, numberOfTeams: 4 },
});

async function bild(page: Page, name: string, outputDir: string) {
  const ordner = process.env.UE_SCR ?? outputDir;
  mkdirSync(ordner, { recursive: true });
  await page.screenshot({ path: join(ordner, `${name}.png`), fullPage: true });
}

const keinWaagerechtesScrollen = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe('Usability E: gesperrte Felder am Handy', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const g of GERAETE) {
    test(`@W5-036 @OB-043 ${g.name}: Spielzeit und Pause – Text am Feld nennt Grund und den Weg „Spielmodus ändern“`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier()] });
      await page.goto(`/#/tournament/${ID}/admin/settings`);
      await page.getByText('Spielzeiten').first().click();
      const grund = page.getByTestId('settings-locked-game-grund');
      await expect(grund).toContainText('weil der Spielplan auf ihr aufbaut');
      await expect(grund).toContainText('„Erweiterte Bearbeitung“ › „Spielmodus ändern“');
      await expect(grund).toContainText('Zeiten verschieben');
      await expect(page.getByTestId('settings-locked-break-grund')).toContainText('Spielmodus ändern');
      await expect(page.getByTestId('settings-locked-game')).toHaveAttribute('aria-describedby', /.+/);
      expect(await keinWaagerechtesScrollen(page)).toBe(true);
      await bild(page, `spielzeit-gesperrt-${g.name}-nachher`, testInfo.outputDir);
    });

    test(`@W5-036 @W5-005 ${g.name}: Struktur-Info vor dem Anpfiff nennt den Weg „Erweiterte Bearbeitung“, nicht „nicht mehr ändern“`, async ({ page, seedIndexedDB }, testInfo) => {
      await page.setViewportSize({ width: g.width, height: g.height });
      await seedIndexedDB({ tournaments: [turnier()] });
      await page.goto(`/#/tournament/${ID}/admin/metadata`);
      await page.getByText('Struktur-Info').first().click();
      await expect(page.getByText(/auf der Turnierseite unter Einstellungen › „Erweiterte Bearbeitung“/)).toBeVisible();
      await expect(page.getByText(/nicht mehr geändert werden/)).toHaveCount(0);
      expect(await keinWaagerechtesScrollen(page)).toBe(true);
      await bild(page, `struktur-info-${g.name}-nachher`, testInfo.outputDir);
    });
  }
});
