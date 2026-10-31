/**
 * tests/e2e/cloud/monitor-sofort.cloud.spec.ts — R5 PR 1 „Sofort-Kanal“: ein angemeldetes Cockpit (Olli) trägt Tore ein,
 * ein NICHT angemeldeter Monitor folgt ohne Neuladen (zwei Browser-Kontexte, gemeinsame Uhr desselben Rechners).
 *
 * Szenarien (Testwerte aus dem Gherkin):
 * - @ZM-084 Zeile 1: „Tom trägt in Spiel 7 ein Tor für FC Nord ein → nach höchstens 1 Sekunde ohne Neuladen Stand 2:0“.
 * - @FU-001 (Monitor-Teil): „Wenn Tom nacheinander 20 Tore für das Heimteam einträgt / Und das Netz hat 300 ms
 *   Verzögerung und 5 % Paketverlust / Dann sieht der Hallenmonitor mindestens 19 der 20 Einträge innerhalb von 2 s /
 *   … alle 20 Einträge spätestens nach 10 Sekunden“.
 * - @ZM-083 Zeile Feld-Monitor: Tor-Einblendung und neuer Stand zugleich.
 * - Fall „Uhr“ (R5 PR 2): @ZM-176 „weicht die Uhr am Monitor höchstens 1 Sekunde von der Uhr auf Toms Gerät ab / Und sie
 *   springt nie zurück“; @ZM-084 Zeilen „Pause“ (Uhr steht beim Wert des Cockpits) und „Weiter“ (läuft von dort weiter).
 *
 * Messung: Zeitpunkt = `Date.now()` im jeweiligen Kontext, wenn sich die Anzeige ändert (MutationObserver): im Cockpit
 * die eigene Stand-Ziffer (Eintrag gespeichert), am Monitor `aria-label` „Heim: n“. Frist nach F6 (Daniel 29.10.):
 * CI 2 s (geteilte Runner), lokal/Generalprobe 1 s. Messwerte stehen als Anhang „messwerte“ und in der Ausgabe.
 * Paketverlust: CDP kennt keinen Verlust – nachgebildet durch Verwerfen jedes 20. Änderungssignals im WebSocket des
 * Monitors (`routeWebSocket`); die 300 ms Verzögerung setzt CDP `Network.emulateNetworkConditions` in beiden Kontexten
 * (wirkt auf HTTP-Abrufe, nicht auf den WebSocket – so dokumentiert).
 */
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { test, expect } from './fixtures';
import { engineCupTarget, expectEngineMatchRunningUi, expectSeededEngineMatch, newRoleContext, openCockpit } from './engineHelpers';
import { enterGoal } from './helpers';
import {
  E2E_MONSCHLECHT_MONITOR_ID,
  E2E_MONUHR_MONITOR_ID,
  E2E_MONSOFORT_EINGANG_MONITOR_ID,
  E2E_MONSOFORT_MONITOR_ID,
  engineCupIds,
} from './testData';

/** F6: CI prüft 2 s, lokal 1 s. */
const FRIST_MS = process.env.CI ? 2_000 : 1_000;
const TORE = 20;

interface Spur { t: number; wert: string }

/** Zeichnet jede Änderung von `lesen()` mit Zeitstempel auf (im Browser, ab jetzt). */
async function spurAufzeichnen(page: Page, name: string, selector: string, attr: string | null): Promise<void> {
  await page.evaluate(({ name, selector, attr }) => {
    const w = window as unknown as Record<string, Spur[]>;
    const lesen = (): string => {
      const el = document.querySelector(selector);
      return el === null ? '' : (attr === null ? el.textContent ?? '' : el.getAttribute(attr) ?? '');
    };
    w[name] = [{ t: Date.now(), wert: lesen() }];
    new MutationObserver(() => {
      const wert = lesen();
      const spur = w[name];
      if (spur[spur.length - 1].wert !== wert) { spur.push({ t: Date.now(), wert }); }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  }, { name, selector, attr });
}

async function spur(page: Page, name: string): Promise<Spur[]> {
  return page.evaluate((n) => (window as unknown as Record<string, Spur[]>)[n], name);
}

const erstes = (s: Spur[], wert: string): number | undefined => s.find((e) => e.wert === wert)?.t;

function median(werte: number[]): number {
  const sortiert = [...werte].sort((a, b) => a - b);
  return sortiert[Math.floor(sortiert.length / 2)];
}

async function berichte(testInfo: TestInfo, titel: string, latenzen: number[]): Promise<void> {
  const daten = { titel, frist_ms: FRIST_MS, latenzen_ms: latenzen, median_ms: median(latenzen), max_ms: Math.max(...latenzen) };
  await testInfo.attach('messwerte', { body: JSON.stringify(daten, null, 2), contentType: 'application/json' });
  testInfo.annotations.push({ type: 'messwerte', description: JSON.stringify(daten) });
  process.stdout.write(`[R5-Messwerte] ${JSON.stringify(daten)}\n`);
}

/** 20 Tore nacheinander; je Tor Latenz = Monitor-Änderung − Cockpit-Änderung (ms). */
async function zwanzigTore(cockpit: Page, monitor: Page, vorher: number): Promise<number[]> {
  await spurAufzeichnen(cockpit, '__cockpit', '[data-testid="scoreboard-box-links"]', null);
  await spurAufzeichnen(monitor, '__monitor', '[data-testid="live-box-home"]', 'aria-label');
  for (let i = 1; i <= TORE; i++) {
    await enterGoal(cockpit, 'home');
    await expect(monitor.locator('[data-testid="live-box-home"]')).toHaveAttribute('aria-label', `Heim: ${vorher + i}`, { timeout: 15_000 });
  }
  const c = await spur(cockpit, '__cockpit');
  const m = await spur(monitor, '__monitor');
  return Array.from({ length: TORE }, (_, k) => {
    const n = vorher + k + 1;
    const eintrag = erstes(c, String(n));
    const anzeige = erstes(m, `Heim: ${n}`);
    if (eintrag === undefined || anzeige === undefined) {
      throw new Error(`Tor ${n}: Zeitpunkt fehlt (Cockpit ${eintrag}, Monitor ${anzeige})`);
    }
    return anzeige - eintrag;
  });
}

/** Öffnet einen Monitor im nicht angemeldeten Kontext und wartet, bis `bereit` sichtbar ist. */
async function anonymerMonitor(context: BrowserContext, tournamentId: string, monitorId: string, bereit = '[data-testid="live-box-home"]'): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`/#/display/${tournamentId}/${monitorId}`);
  await expect(page.locator(bereit).first()).toBeVisible({ timeout: 15_000 });
  return page;
}

test.describe('R5 Sofort-Kanal: Monitor ohne Anmeldung folgt dem Cockpit', () => {
  // Playwright verlangt syntaktisch ein Destrukturierungs-Muster als erstes Argument.
  // eslint-disable-next-line no-empty-pattern
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!testInfo.project.name.includes('desktop'), 'Engine-Cups nur auf cloud-desktop (kein gleichzeitiger Mobil-Lauf auf demselben Cup).');
  });

  test('@ZM-084 @FU-001 @ZM-083 normales Netz: 20 Tore, jedes am Monitor innerhalb der Frist, Einblendung mit dem Stand', async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const ids = engineCupIds('MONSOFORT');
    await expectSeededEngineMatch(engineCupTarget('MONSOFORT'));
    const olli = await newRoleContext(browser, 'owner');
    const halle = await browser.newContext(); // nicht angemeldet
    try {
      await openCockpit(olli.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(olli.page);
      const monitor = await anonymerMonitor(halle, ids.tournamentId, E2E_MONSOFORT_MONITOR_ID);
      const eingang = await anonymerMonitor(halle, ids.tournamentId, E2E_MONSOFORT_EINGANG_MONITOR_ID, 'text=Willkommen');
      await expect(monitor.locator('[data-testid="live-box-home"]')).toHaveAttribute('aria-label', 'Heim: 1');

      // @ZM-083: ein Tor – der Feld-Monitor (Live-Folie) blendet ein und zeigt zugleich 2, der Eingang blendet ein.
      await enterGoal(olli.page, 'home');
      await expect(monitor.locator('[data-testid="live-box-home"]')).toHaveAttribute('aria-label', 'Heim: 2', { timeout: FRIST_MS + 500 });
      await expect(monitor.getByText('TOR!')).toBeVisible({ timeout: 1_000 });
      await expect(eingang.getByText('TOR!')).toBeVisible({ timeout: FRIST_MS + 500 });
      await expect(monitor.getByText('TOR!')).toBeHidden({ timeout: 6_000 });
      await expect(monitor.locator('[data-testid="live-box-home"]')).toHaveAttribute('aria-label', 'Heim: 2');

      const latenzen = await zwanzigTore(olli.page, monitor, 2);

      await berichte(testInfo, 'normales Netz', latenzen);
      expect(latenzen.filter((ms) => ms > FRIST_MS), `alle 20 Tore innerhalb ${FRIST_MS} ms`).toEqual([]);
    } finally {
      await olli.context.close();
      await halle.close();
    }
  });

  test('@FU-001 Hallen-WLAN: 300 ms Verzögerung, jedes 20. Signal verloren -> mindestens 19 von 20 in 2 s, alle in 10 s', async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const ids = engineCupIds('MONSCHLECHT');
    await expectSeededEngineMatch(engineCupTarget('MONSCHLECHT'));
    const olli = await newRoleContext(browser, 'owner');
    const halle = await browser.newContext();
    let signale = 0;
    let verworfen = 0;
    await halle.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
      const server = ws.connectToServer();
      server.onMessage((nachricht) => {
        // realtime-js 2.x (Protokoll 2.0.0) bekommt Broadcasts als Binärrahmen; der Ereignisname steht als ASCII darin.
        const text = typeof nachricht === 'string' ? nachricht : nachricht.toString('latin1');
        if (text.includes('changed')) {
          signale += 1;
          if (signale % 20 === 0) { verworfen += 1; return; }
        }
        ws.send(nachricht);
      });
      ws.onMessage((nachricht) => { server.send(nachricht); });
    });
    try {
      const monitor = await anonymerMonitor(halle, ids.tournamentId, E2E_MONSCHLECHT_MONITOR_ID);
      await openCockpit(olli.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(olli.page);
      for (const page of [olli.page, monitor]) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: -1, uploadThroughput: -1 });
      }
      const latenzen = await zwanzigTore(olli.page, monitor, 1);
      await berichte(testInfo, `300 ms Verzögerung, ${verworfen} von ${signale} Signalen verworfen`, latenzen);
      expect(verworfen, 'mindestens ein Signal wurde verworfen (sonst prüft der Test den Rückfall nicht)').toBeGreaterThan(0);
      expect(latenzen.filter((ms) => ms <= 2_000).length, 'mindestens 19 von 20 innerhalb 2 s').toBeGreaterThanOrEqual(19);
      expect(latenzen.filter((ms) => ms > 10_000), 'alle 20 spätestens nach 10 s').toEqual([]);
    } finally {
      await olli.context.close();
      await halle.close();
    }
  });

  test('@ZM-176 @ZM-084 Uhr: Monitor weicht höchstens 1 s von der Cockpit-Uhr ab, steigt nie; Pause steht beim Cockpit-Wert, Weiter läuft', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const ids = engineCupIds('MONUHR');
    await expectSeededEngineMatch(engineCupTarget('MONUHR'));
    const olli = await newRoleContext(browser, 'owner');
    const halle = await browser.newContext(); // nicht angemeldet
    const sekunden = (text: string | null): number => {
      const m = /(\d{1,2}):(\d{2})/.exec(text ?? '');
      if (m === null) { throw new Error(`keine Uhrzeit in „${text ?? ''}“`); }
      return Number(m[1]) * 60 + Number(m[2]);
    };
    try {
      await openCockpit(olli.page, ids.tournamentId, ids.matchId);
      await expectEngineMatchRunningUi(olli.page);
      const monitor = await anonymerMonitor(halle, ids.tournamentId, E2E_MONUHR_MONITOR_ID, '[data-testid="monitor-clock"]');
      const cockpitUhr = olli.page.getByTestId('scoreboard-clock-rest');
      const monitorUhr = monitor.getByTestId('monitor-clock');

      // 30 s Laufzeit, alle 500 ms beide Uhren lesen
      const abweichungen: number[] = [];
      const monitorWerte: number[] = [];
      for (let i = 0; i < 60; i++) {
        const [c, m] = await Promise.all([cockpitUhr.textContent(), monitorUhr.textContent()]);
        abweichungen.push(Math.abs(sekunden(c) - sekunden(m)));
        monitorWerte.push(sekunden(m));
        await monitor.waitForTimeout(500);
      }
      const steigt = monitorWerte.filter((w, k) => k > 0 && w > monitorWerte[k - 1]);

      // Pause im Cockpit: der Monitor steht innerhalb der Frist beim selben Wert (± 1 s) mit „angehalten“
      await olli.page.getByTestId('match-pause-button').click();
      await expect(olli.page.getByTestId('scoreboard-clock')).toHaveAttribute('data-steht', 'true');
      const pauseBeginn = Date.now();
      await expect(monitor.getByTestId('clock-label')).toHaveText('angehalten', { timeout: FRIST_MS + 500 });
      const pauseLatenz = Date.now() - pauseBeginn;
      const beiPause = sekunden(await cockpitUhr.textContent());
      const monitorBeiPause = sekunden(await monitorUhr.textContent());
      await monitor.waitForTimeout(2_000);
      const monitorNachZweiSekunden = sekunden(await monitorUhr.textContent());

      // Weiter: der Monitor läuft vom Pausenwert weiter
      await olli.page.getByRole('button', { name: 'Weiter' }).click();
      await expect(monitor.getByTestId('clock-label')).toHaveText('Restzeit', { timeout: FRIST_MS + 500 });
      await expect.poll(async () => sekunden(await monitorUhr.textContent()), { timeout: 5_000 }).toBeLessThan(monitorBeiPause);

      const daten = {
        titel: 'Uhr Monitor gegen Cockpit', frist_ms: FRIST_MS, abweichung_max_s: Math.max(...abweichungen),
        abweichungen_s: abweichungen, pause_latenz_ms: pauseLatenz, cockpit_pause: beiPause, monitor_pause: monitorBeiPause,
      };
      await testInfo.attach('messwerte-uhr', { body: JSON.stringify(daten, null, 2), contentType: 'application/json' });
      process.stdout.write(`[R5-Messwerte] ${JSON.stringify(daten)}\n`);

      expect(Math.max(...abweichungen), 'Monitor weicht höchstens 1 s vom Cockpit ab').toBeLessThanOrEqual(1);
      expect(steigt, 'die Monitor-Uhr steigt nie (kein Rücksprung)').toEqual([]);
      expect(Math.abs(monitorBeiPause - beiPause), 'Pause: derselbe Wert wie im Cockpit (± 1 s)').toBeLessThanOrEqual(1);
      expect(monitorNachZweiSekunden, 'angehaltene Uhr steht').toBe(monitorBeiPause);
    } finally {
      await olli.context.close();
      await halle.close();
    }
  });
});
