/**
 * tests/e2e/cloud/monitor-zeitstrafe.cloud.spec.ts — Zeitstrafe am Monitor und auf der Zuschauer-Seite über die ECHTE
 * Server-Antwort (@ZM-180-Muster: jeder Übertragungsweg wird über `public_payload` geprüft, nicht über Testdaten im Client).
 *
 * Olli (angemeldet) trägt im Cockpit eine Zeitstrafe für die Rückennummer 5 des Gastteams ein; ein NICHT angemeldeter
 * Hallenmonitor (Live-Folie Feld 1) und die Zuschauer-Seite am Handy (390 × 844) folgen ohne Neuladen.
 * - @ZM-182: am Kasten des Gastteams ein Kreis mit „5“, der Ring nimmt mit der Spielzeit ab; angehaltene Uhr → grauer Ring.
 * - @ZM-184: auf der Zuschauer-Seite beim Gastteam „Zeitstrafe #5 · m:ss“, die Restzeit zählt herunter.
 * - @ZM-183: „Ereignisse je Spiel“ aus bzw. Kindermodus → an keinem Kasten ein Kreis, kein Hinweis; wieder an → Kreis zurück.
 * - Der Eintrag trägt die Dauer der Regel (`durationSeconds` 120): Grundlage der Restzeit ohne öffentliche Spielregel.
 * Frist wie monitor-sofort (F6): CI 2 s, lokal 1 s – für das Erscheinen nach dem Eintrag; Schalter wirken über die nächste
 * Abfrage (großzügiger Takt).
 */
import type { BrowserContext, Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { engineCupTarget, expectEngineMatchRunningUi, expectSeededEngineMatch, fetchEngineRows, newRoleContext, openCockpit } from './engineHelpers';
import { serviceRest } from './restAsRole';
import { E2E_MONZEITSTRAFE_MONITOR_ID, E2E_MONZEITSTRAFE_SHARE_CODE, engineCupIds } from './testData';
import { wartePicker } from '../helpers/cockpitNeu';

/** F6: CI prüft 2 s, lokal 1 s (Sofort-Kanal); +500 ms Puffer wie monitor-sofort. */
const FRIST_MS = (process.env.CI ? 2_000 : 1_000) + 500;
/** Schalter des Turniers: erreichen Monitor und Zuschauer-Seite über Signal bzw. den 10-Sekunden-Takt. */
const SCHALTER_MS = 20_000;

async function patchConfig(tournamentId: string, change: Record<string, unknown>): Promise<void> {
  const row = await serviceRest('GET', `tournaments?id=eq.${tournamentId}&select=config`);
  const [current] = row.json as Array<{ config: Record<string, unknown> | null }>;
  const res = await serviceRest('PATCH', `tournaments?id=eq.${tournamentId}`, { config: { ...(current.config ?? {}), ...change } });
  expect(res.status, res.text).toBeLessThan(300);
}

async function anonymerMonitor(context: BrowserContext, tournamentId: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/#/display/${tournamentId}/${E2E_MONZEITSTRAFE_MONITOR_ID}`);
  await expect(page.locator('[data-position="home"]').first()).toBeVisible({ timeout: 15_000 });
  return page;
}

async function zuschauerSeite(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/#/live/${E2E_MONZEITSTRAFE_SHARE_CODE}`);
  await expect(page.locator('[data-match-card], [role="article"]').first()).toBeVisible({ timeout: 15_000 });
  return page;
}

const sekunden = (text: string | null): number => {
  const m = /(\d+):(\d{2})/.exec(text ?? '');
  if (m === null) { throw new Error(`keine Restzeit in „${text ?? ''}“`); }
  return Number(m[1]) * 60 + Number(m[2]);
};

test.describe('Zeitstrafe am Monitor und auf der Zuschauer-Seite (echte Server-Antwort)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop (kein gleichzeitiger Mobil-Lauf auf demselben Cup).');
  });

  test('@ZM-182 @ZM-184 @ZM-183 @ZM-192 Zeitstrafe #5: Kreis am Monitor, Restzeit beim Team; Schalter aus und Kindermodus verbergen sie', async ({ browser }) => {
    test.setTimeout(180_000);
    const ids = engineCupIds('MONZEITSTRAFE');
    await expectSeededEngineMatch(engineCupTarget('MONZEITSTRAFE'));
    const olli = await newRoleContext(browser, 'owner');
    const halle = await browser.newContext(); // nicht angemeldet
    const handy = await browser.newContext({ viewport: { width: 390, height: 844 } }); // nicht angemeldet
    try {
      await openCockpit(olli.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(olli.page);
      const monitor = await anonymerMonitor(halle, ids.tournamentId);
      const zuschauer = await zuschauerSeite(handy);
      const kreisGast = monitor.locator('[data-testid="live-penalties-away"] [data-zeitstrafe]');
      const hinweisGast = zuschauer.getByTestId(`match-time-penalty-${ids.matchId}-away`);
      // Gegenbeispiel vorab: ohne Strafe kein Kreis und kein Hinweis
      await expect(monitor.locator('[data-zeitstrafe]')).toHaveCount(0);
      await expect(zuschauer.getByTestId(`match-time-penalty-${ids.matchId}-home`)).toHaveCount(0);

      // Wenn Olli im Cockpit eine Zeitstrafe für die Rückennummer 5 des Gastteams einträgt
      await olli.page.getByTestId('penalty-button-away').click();
      await wartePicker(olli.page);
      await olli.page.getByTestId('number-picker').getByRole('button', { name: '5', exact: true }).click();
      await expect(olli.page.getByTestId('number-picker')).toBeHidden();

      // Dann zeigt der Monitor am Kasten des Gastteams einen Kreis mit „5“ (@ZM-182), innerhalb der Frist
      await expect(kreisGast).toHaveCount(1, { timeout: FRIST_MS });
      await expect(kreisGast).toHaveText('5');
      await expect(monitor.locator('[data-testid="live-penalties-home"]')).toHaveCount(0);
      // Und die Zuschauer-Seite beim Gastteam „Zeitstrafe #5 · m:ss“ (@ZM-184)
      await expect(hinweisGast).toHaveText(/^Zeitstrafe #5 · [12]:\d{2}$/, { timeout: SCHALTER_MS });

      // Der Eintrag trägt die Dauer der Regel (2 Minuten): Monitor und Zuschauer rechnen damit
      const strafen = (await fetchEngineRows(ids.matchId)).filter((row) => row.type === 'TIME_PENALTY');
      expect(strafen.map((row) => [row.payload.playerNumber, row.payload.durationSeconds])).toEqual([[5, 120]]);

      // Der Ring nimmt mit der Spielzeit ab, die Restzeit auf der Zuschauer-Seite zählt herunter
      const anteilVorher = Number(await kreisGast.getAttribute('data-anteil'));
      const restVorher = sekunden(await hinweisGast.textContent());
      await expect.poll(async () => Number(await kreisGast.getAttribute('data-anteil')), { timeout: 5_000 }).toBeLessThan(anteilVorher);
      await expect.poll(async () => sekunden(await hinweisGast.textContent()), { timeout: 5_000 }).toBeLessThan(restVorher);
      await expect(kreisGast).toHaveAttribute('data-steht', 'false');

      // @ZM-192: Olli hält die Uhr an → grauer Ring, der Ring steht; Weiter → läuft wieder
      await olli.page.getByTestId('match-pause-button').click();
      await expect(kreisGast).toHaveAttribute('data-steht', 'true', { timeout: FRIST_MS });
      await olli.page.getByRole('button', { name: 'Weiter' }).click();
      await expect(kreisGast).toHaveAttribute('data-steht', 'false', { timeout: FRIST_MS });

      // @ZM-183: „Ereignisse je Spiel“ aus → an keinem Kasten ein Kreis, kein Hinweis beim Team
      await patchConfig(ids.tournamentId, { publicEvents: false });
      await expect(monitor.locator('[data-zeitstrafe]')).toHaveCount(0, { timeout: SCHALTER_MS });
      await expect(hinweisGast).toHaveCount(0, { timeout: SCHALTER_MS });

      // @ZM-183: Kindermodus (Ereignisse wieder an) → ebenfalls kein Kreis
      await patchConfig(ids.tournamentId, { publicEvents: true, hideScoresForPublic: true });
      await monitor.waitForTimeout(SCHALTER_MS / 2);
      await expect(monitor.locator('[data-zeitstrafe]')).toHaveCount(0);
      await expect(hinweisGast).toHaveCount(0);

      // Gegenprobe: wieder normal → der Kreis ist zurück (der Schalter war die Ursache, die Strafe läuft noch)
      await patchConfig(ids.tournamentId, { hideScoresForPublic: false });
      await expect(kreisGast).toHaveCount(1, { timeout: SCHALTER_MS });
      await expect(hinweisGast).toHaveText(/^Zeitstrafe #5 · \d:\d{2}$/, { timeout: SCHALTER_MS });
    } finally {
      await olli.context.close();
      await halle.close();
      await handy.close();
    }
  });
});
