/**
 * E2E: Mannschaften des Veranstalters im Assistenten markieren, Eröffnung wählen, im schon veröffentlichten Turnier nachholen
 * (@W4-034, @W4-033, @W4-048, @W4-049, @W4-050). Weg: veröffentlichtes G-Turnier (ohne Markierung, kein Spiel begonnen) →
 * „Turnier bearbeiten“ → Schritt „Teams“ → Waging 1 und 2 ankreuzen → „Beide beginnen als Heim“ → Übersicht → „Neuplanung prüfen“
 * → bestätigen → erneut öffnen: Markierung und Art sind gespeichert, die Turnier-Adresse ist dieselbe.
 * Läuft nur im Projekt `desktop` (setzt die Fenstergröße selbst: 360, 390 und 1440). Bilder: VERAN_BILDER=<Ordner>.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/test-fixtures';
import { buildVisualTournament } from '../visual/helpers';

const NAMES = ['TSV Petting', 'SV Kirchanschöring', 'TSV Palling', 'DJK Otting', 'TSV Waging 1', 'TSV Waging 2'];
const ids = NAMES.map((_, i) => `00000000-0000-4000-8000-0000000000b${i + 1}`);
const [W1, W2] = [ids[4], ids[5]];
const BILDER = process.env.VERAN_BILDER;

/** Alle 15 Paarungen (Kreismethode ist hier egal: das Turnier ist nur der Ausgangsstand vor der Neuplanung). */
function paarungen(): Array<[number, number]> {
  const liste: Array<[number, number]> = [];
  for (let a = 0; a < 6; a++) { for (let b = a + 1; b < 6; b++) { liste.push([a, b]); } }
  return liste;
}

function g_turnier(): Record<string, unknown> {
  const matches = paarungen().map(([a, b], i) => ({
    id: `g-match-${i + 1}`, round: i + 1, teamA: ids[a], teamB: ids[b], field: 1, matchStatus: 'scheduled' as const,
    scheduledTime: `2026-11-28T${String(9 + Math.floor((i * 12) / 60)).padStart(2, '0')}:${String((i * 12) % 60).padStart(2, '0')}:00.000Z`,
  }));
  return buildVisualTournament({
    id: 'g1', title: 'G-Jugend Hallenturnier', matches,
    extra: {
      teams: NAMES.map((name, i) => ({ id: ids[i], name })), numberOfTeams: 6, ageClass: 'G',
      date: '2026-11-28', startDate: '2026-11-28', startTime: '10:00', groupPhaseBreakDuration: 2,
      publishedAt: '2026-11-15T10:00:00.000Z', shareCode: 'G4ABCD', isPublic: true, status: 'published',
    },
  });
}

async function bild(page: Page, name: string, breite: number, thema: string): Promise<void> {
  if (!BILDER) { return; }
  // Einblend-Animation (Dialog) bis zum Ende abwarten, keine feste Wartezeit
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: join(BILDER, `${name}-${breite}-${thema}.png`), fullPage: false });
}

const GROESSEN = [
  { breite: 360, hoehe: 800, thema: 'light' as const },
  { breite: 390, hoehe: 844, thema: 'light' as const },
  { breite: 390, hoehe: 844, thema: 'dark' as const },
  { breite: 1440, hoehe: 900, thema: 'light' as const },
];

test.describe('@W4-034 @W4-048 @W4-049 Mannschaften des Veranstalters im Assistenten', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop' || browserName !== 'chromium', 'setzt Fenstergröße selbst');
  });

  for (const { breite, hoehe, thema } of GROESSEN) {
    test(`${breite} × ${hoehe} ${thema}: markieren, Eröffnung wählen, Übersicht, Neuplanung, gespeichert`, async ({ page, seedIndexedDB }) => {
      await page.setViewportSize({ width: breite, height: hoehe });
      await page.emulateMedia({ colorScheme: thema });
      await seedIndexedDB({ tournaments: [g_turnier()] });
      await page.goto('/#/tournament/g1/edit?step=5');

      // Schritt „Teams“: Ankreuzfelder, anfangs keine Wahl
      const feld = (id: string) => page.getByTestId(`wizard-host-team-${id}`);
      await expect(feld(W1)).toBeVisible();
      await expect(feld(W1)).not.toBeChecked();
      await expect(page.getByTestId('wizard-host-choice')).toHaveCount(0);
      const box = await feld(W1).boundingBox();
      const zeile = await feld(W1).locator('xpath=ancestor::label').boundingBox();
      expect(box).not.toBeNull();
      expect(zeile?.height ?? 0).toBeGreaterThanOrEqual(44);
      await feld(W1).scrollIntoViewIfNeeded();
      await bild(page, '1-teams-ankreuzfelder', breite, thema);

      // eine Markierte: nur der Hinweis
      await feld(W1).check();
      await expect(page.getByTestId('wizard-host-hint')).toContainText('TSV Waging 1 bestreitet das erste Spiel als Heimmannschaft');
      await expect(page.getByTestId('wizard-host-choice')).toHaveCount(0);

      // zwei Markierte: die Wahl mit drei Arten, Voreinstellung „Veranstalter gegen einen Gast“
      await feld(W2).check();
      await expect(page.getByTestId('wizard-host-choice')).toBeVisible();
      await expect(page.getByTestId('wizard-opening-guest-opening')).toHaveAttribute('aria-checked', 'true');
      await page.getByTestId('wizard-host-choice').scrollIntoViewIfNeeded();
      await bild(page, '2-teams-wahl-vorgabe', breite, thema);
      await page.getByTestId('wizard-opening-both-home').click();
      await expect(page.getByTestId('wizard-opening-both-home')).toHaveAttribute('aria-checked', 'true');
      await bild(page, '3-teams-wahl-beide-heim', breite, thema);

      // Übersicht nennt Mannschaften, Art, Spiel des Vereinsduells und die Folgen
      await page.getByTestId('wizard-footer-bar').getByRole('button', { name: 'Weiter' }).click();
      await expect(page.getByTestId('step5-host')).toBeVisible();
      await expect(page.getByTestId('host-summary-teams')).toHaveText('TSV Waging 1, TSV Waging 2');
      await expect(page.getByTestId('host-summary-mode')).toHaveText('Eröffnung: Beide beginnen als Heim');
      await expect(page.getByTestId('host-summary-duel')).toContainText('Das Vereinsduell ist Spiel');
      await expect(page.getByTestId('host-summary-follows')).toContainText('direkt');
      await page.getByTestId('step5-host').scrollIntoViewIfNeeded();
      await bild(page, '4-uebersicht', breite, thema);

      // Fenster „Neuplanung prüfen“ nennt dieselben Angaben
      await page.getByTestId('wizard-show-preview').click();
      await expect(page.getByTestId('replan-panel')).toBeVisible();
      await expect(page.getByTestId('replan-host')).toContainText('TSV Waging 1, TSV Waging 2');
      await expect(page.getByTestId('replan-host')).toContainText('Beide beginnen als Heim');
      await bild(page, '5-neuplanung-pruefen', breite, thema);

      // bestätigen: veröffentlicht neu; dieselbe Adresse, Markierung und Art sind gespeichert
      await page.getByTestId('replan-confirm').click();
      await expect(page.getByTestId('replan-panel')).toHaveCount(0);
      await page.goto('/#/tournament/g1/edit?step=5');
      await expect(feld(W1)).toBeChecked();
      await expect(feld(W2)).toBeChecked();
      await expect(page.getByTestId('wizard-opening-both-home')).toHaveAttribute('aria-checked', 'true');
      await expect(feld(ids[0])).not.toBeChecked();
    });
  }

  test('Gegenbeispiel: nach dem Anpfiff wird die Neuplanung nicht angeboten und der Grund genannt (@W4-049)', async ({ page, seedIndexedDB }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const begonnen = g_turnier();
    (begonnen.matches as Array<Record<string, unknown>>)[0].matchStatus = 'running';
    await seedIndexedDB({ tournaments: [begonnen] });
    await page.goto('/#/tournament/g1/edit?step=5');
    await page.getByTestId(`wizard-host-team-${W1}`).check();
    await page.getByTestId(`wizard-host-team-${W2}`).check();
    await page.getByTestId('wizard-footer-bar').getByRole('button', { name: 'Weiter' }).click();
    await page.getByTestId('wizard-show-preview').click();
    await expect(page.getByTestId('replan-blocked')).toBeVisible();
    await expect(page.getByTestId('replan-reason')).toContainText(/begonnen|angepfiffen|Anpfiff/i);
    await expect(page.getByTestId('replan-confirm')).toBeDisabled();
  });
});
