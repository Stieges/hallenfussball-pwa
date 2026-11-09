/**
 * tests/e2e/cloud/ohne-netz-ruecknahme.cloud.spec.ts — @SL-047 über die ECHTE Server-Antwort bis zum Hallenmonitor
 * (Regel „Beendet bleibt beendet“: jeder Übertragungsweg zu Monitor und Zuschauern wird mit der Antwort des Servers geprüft,
 * nicht mit Testdaten im Client). Der Vitest-Test `MatchCommands.ohneNetzRuecknahme.sl047.test.ts` belegt die Reihenfolge im
 * Ausgang mit gefälschtem Netz; hier läuft dieselbe Lage gegen den lokalen Supabase-Stack.
 *
 * Szenario (docs/anforderungen/2026-10-02_spiel-leiten.md):
 *   Gegeben Toms Tablet hat kein Netz
 *   Und Tom hat ein Tor für FC Nord eingetragen und gleich wieder zurückgenommen
 *   Wenn Toms Tablet wieder Netz hat
 *   Dann zeigt der Hallenmonitor von Feld 1 den Stand ohne dieses Tor
 *
 * Tom = der Helfer des Engine-Cups, FC Nord = das Gastteam (Seed: Stand 1:0, Heim vorn). Der Monitor ist ein NICHT angemeldetes
 * Gerät in eigenem Browser-Kontext (Live-Folie Feld 1), er liest ausschließlich, was der Server ausliefert. Alle Anzeigewerte des
 * Monitors werden von Anfang an mitgeschrieben: Hätte er zwischendurch „Gast: 1“ gezeigt, steht es in der Spur.
 */
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { engineCupTarget, expectEngineMatchRunningUi, expectOutboxSettled, expectSeededEngineMatch, fetchEngineRows, newRoleContext, openCockpit } from './engineHelpers';
import { enterGoal, fetchMatchRow } from './helpers';
import { E2E_MONRUECKNAHME_MONITOR_ID, engineCupIds } from './testData';

/** Zeichnet jede Änderung der Beschriftung eines Kastens des Monitors auf (im Browser, ab jetzt). */
async function spurAufzeichnen(monitor: Page): Promise<void> {
  await monitor.evaluate(() => {
    const w = window as unknown as { __kasten: string[] };
    const lesen = (): string => ['home', 'away'].map((seite) => document.querySelector(`[data-position="${seite}"]`)?.getAttribute('aria-label') ?? '').join(' | ');
    w.__kasten = [lesen()];
    new MutationObserver(() => {
      const wert = lesen();
      if (w.__kasten[w.__kasten.length - 1] !== wert) { w.__kasten.push(wert); }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
}

const spur = (monitor: Page): Promise<string[]> => monitor.evaluate(() => (window as unknown as { __kasten: string[] }).__kasten);

test.describe('@SL-047 Ohne Netz zurückgenommen (echte Server-Antwort bis zum Hallenmonitor)', () => {
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop (kein gleichzeitiger Mobil-Lauf auf demselben Cup).');
  });

  test('@SL-047 Tor für FC Nord und Rücknahme ohne Netz: mit Netz kommen beide an, der Hallenmonitor zeigt den Stand ohne dieses Tor', async ({ browser }) => {
    test.setTimeout(150_000);
    const ids = engineCupIds('MONRUECKNAHME');
    const basisZeilen = await expectSeededEngineMatch(engineCupTarget('MONRUECKNAHME'));
    const tom = await newRoleContext(browser, 'helper');
    const halle = await browser.newContext(); // nicht angemeldet
    try {
      const monitor = await halle.newPage();
      await monitor.goto(`/#/display/${ids.tournamentId}/${E2E_MONRUECKNAHME_MONITOR_ID}`);
      await expect(monitor.locator('[data-position="home"]')).toHaveAttribute('aria-label', 'Heim: 1', { timeout: 15_000 });
      await expect(monitor.locator('[data-position="away"]')).toHaveAttribute('aria-label', 'Gast: 0');
      await spurAufzeichnen(monitor);

      await openCockpit(tom.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(tom.page);
      await expectOutboxSettled(tom.page);
      const syncStatus = tom.page.getByTestId('sync-status');
      const gastKasten = tom.page.getByTestId('scoreboard-box-rechts');

      // Gegeben Toms Tablet hat kein Netz, und Tom hat ein Tor für FC Nord eingetragen und gleich wieder zurückgenommen
      await tom.context.setOffline(true);
      await enterGoal(tom.page, 'away');
      await expect(gastKasten).toHaveText('1');
      await tom.page.getByTestId('match-undo-button').click();
      await expect(gastKasten).toHaveText('0');
      await expect(syncStatus).toHaveAttribute('data-pending', '2', { timeout: 5_000 });

      // Gegenbeispiel: ohne Netz hat der Server nichts bekommen, der Monitor zeigt weiter den alten Stand
      expect((await fetchEngineRows(ids.matchId)).length).toBe(basisZeilen);
      await expect(monitor.locator('[data-position="away"]')).toHaveAttribute('aria-label', 'Gast: 0');

      // Wenn Toms Tablet wieder Netz hat
      await tom.context.setOffline(false);
      await expect(syncStatus).toHaveAttribute('data-pending', '0', { timeout: 30_000 });

      // Dann hat der Server Tor und Rücknahme, in dieser Reihenfolge, und den Stand 1:0
      const zeilen = await fetchEngineRows(ids.matchId);
      expect(zeilen).toHaveLength(basisZeilen + 2);
      const [tor, ruecknahme] = zeilen.slice(-2);
      expect([tor.type, ruecknahme.type]).toEqual(['GOAL', 'RETRACT']);
      expect(ruecknahme.target_event_id).toBe(tor.id);
      await expect.poll(async () => { const m = await fetchMatchRow(ids.matchId); return `${String(m.score_a)}:${String(m.score_b)}`; }, { timeout: 10_000 }).toBe('1:0');

      // Und der Hallenmonitor zeigt den Stand ohne dieses Tor: Heim 1, Gast 0
      await expect(monitor.locator('[data-position="home"]')).toHaveAttribute('aria-label', 'Heim: 1');
      await expect(monitor.locator('[data-position="away"]')).toHaveAttribute('aria-label', 'Gast: 0');

      // Beleg, dass der Monitor den neuen Server-Stand wirklich liest (ein unverändertes „Gast: 0“ allein beweist das nicht):
      // ein weiteres Tor für FC Nord mit Netz, ohne Rücknahme. Wäre die Rücknahme verloren gegangen, stünde hier „Gast: 2“.
      await enterGoal(tom.page, 'away');
      await expect(monitor.locator('[data-position="away"]')).toHaveAttribute('aria-label', 'Gast: 1', { timeout: 15_000 });
      await expect(monitor.locator('[data-position="home"]')).toHaveAttribute('aria-label', 'Heim: 1');

      // Der Monitor hat zu keinem Zeitpunkt das zurückgenommene Tor gezeigt: nach „Gast: 0“ kommt als nächstes „Gast: 1“ (das zweite Tor)
      const werte = await spur(monitor);
      expect(werte.filter((w) => w.includes('Gast: 1')).length, `Spur des Monitors: ${werte.join(' → ')}`).toBe(1);
      expect(werte.some((w) => w.includes('Gast: 2') || w.includes('Heim: 2'))).toBe(false);
    } finally {
      await tom.context.close();
      await halle.close();
    }
  });
});
